"""
Step 5 — Final dataset creation + theme clustering + insights.

Pipeline (reads data/normalized.csv):
  exact dedup  ->  keyword relevance gate  ->  near-dup (cosine>0.92)  ->
  category labels (Claude if key present, else heuristic)  ->  outputs.

Writes:
  data/cleaned_dataset.csv   final rows
  data/summary_stats.json    counts per source + category, dedup stats
  data/sample_quotes.json    top ~50 representative reviews
  data/theme_clusters.json   KMeans clusters (top terms + example quotes)
"""
import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config  # noqa: E402
import classify  # noqa: E402
import dedupe  # noqa: E402

NORM = os.path.join(config.DATA, "normalized.csv")


def _wordcount(t):
    return len(str(t).split())


def _year_month(ts):
    """Best-effort YYYY-MM from varied timestamp formats; '' if unknown."""
    s = str(ts).strip()
    m = re.search(r"(\d{4})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    # reddit epoch seconds (e.g. '1700000000.0')
    if re.fullmatch(r"\d{9,10}(\.\d+)?", s):
        import datetime as _dt
        try:
            return _dt.datetime.utcfromtimestamp(float(s)).strftime("%Y-%m")
        except Exception:
            return ""
    return ""


def build():
    df = pd.read_csv(NORM, dtype=str).fillna("")
    rows = df.to_dict("records")
    log = {"input_normalized": len(rows)}

    # length floor
    rows = [r for r in rows if _wordcount(r["text"]) >= config.MIN_WORDS]
    log["after_min_words"] = len(rows)

    # exact dedup
    rows, exact_dropped = dedupe.exact_dedup(rows)
    log["exact_duplicates_removed"] = exact_dropped

    # relevance gate (keyword)
    relevant = [r for r in rows if classify.is_relevant(r["text"])]
    log["keyword_irrelevant_removed"] = len(rows) - len(relevant)
    log["relevant_after_keyword"] = len(relevant)

    # near-dup only if explicitly enabled; spec wants paraphrases preserved
    if getattr(config, "DEDUP_MODE", "exact") == "exact+near":
        relevant, near_dropped = dedupe.near_dedup(relevant, config.NEAR_DUP_THRESHOLD)
        log["near_duplicates_removed"] = near_dropped
    else:
        log["near_duplicates_removed"] = 0
        log["dedup_mode"] = "exact_only (paraphrases preserved)"

    # category labels
    if classify.claude_available():
        print("Using Claude classifier...")
        labels = classify.classify_claude(relevant)
        kept = []
        for i, r in enumerate(relevant):
            lab, cat = labels.get(i, ("relevant", classify.categorize_heuristic(r["text"])))
            if lab == "irrelevant":
                continue
            r["category"] = cat
            kept.append(r)
        relevant = kept
        log["classifier"] = "claude"
        log["claude_irrelevant_removed"] = len(labels) and \
            sum(1 for v in labels.values() if v[0] == "irrelevant")
    else:
        print("No API key — using transparent keyword heuristic classifier.")
        for r in relevant:
            r["category"] = classify.categorize_heuristic(r["text"])
        log["classifier"] = "heuristic"

    log["final_rows"] = len(relevant)

    # ---- write cleaned_dataset.csv ----
    cols = ["id", "source", "text", "rating", "timestamp", "country",
            "category", "metadata"]
    with open(config.CLEANED, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(relevant)

    # ---- summary_stats.json ----
    by_source = Counter(r["source"] for r in relevant)
    by_cat = Counter(r["category"] for r in relevant)
    by_source_cat = defaultdict(Counter)
    for r in relevant:
        by_source_cat[r["source"]][r["category"]] += 1
    summary = {
        "final_total": len(relevant),
        "by_source": dict(by_source),
        "by_category": dict(by_cat),
        "by_source_and_category": {s: dict(c) for s, c in by_source_cat.items()},
        "pipeline_log": log,
    }
    json.dump(summary, open(config.SUMMARY, "w"), indent=2)

    # ---- source_breakdown.json ----
    json.dump({
        "final_total": len(relevant),
        "by_source": dict(by_source),
        "by_source_and_category": {s: dict(c) for s, c in by_source_cat.items()},
        "funnel": log,
    }, open(config.SOURCE_BREAKDOWN, "w"), indent=2)

    # ---- country_distribution.json (dedup is global, so this is post-dedup) ----
    def _country(r):
        c = (r.get("country") or "").strip()
        if c:
            return c
        return {"reddit": "reddit", "forums": "forums"}.get(r["source"], "unknown")
    country_counts = Counter(_country(r) for r in relevant)
    country_by_source = defaultdict(Counter)
    for r in relevant:
        country_by_source[r["source"]][_country(r)] += 1
    json.dump({
        "by_country": dict(country_counts.most_common()),
        "by_source_and_country": {s: dict(c.most_common())
                                  for s, c in country_by_source.items()},
        "distinct_countries": len([k for k in country_counts
                                    if k not in ("reddit", "forums", "unknown")]),
    }, open(config.COUNTRY_DIST, "w"), indent=2)

    # ---- time_distribution.json (historical depth) ----
    ym = [_year_month(r["timestamp"]) for r in relevant]
    ym = [m for m in ym if m]
    time_counts = Counter(ym)
    time_by_source = defaultdict(Counter)
    for r in relevant:
        m = _year_month(r["timestamp"])
        if m:
            time_by_source[r["source"]][m] += 1
    months = sorted(time_counts)
    json.dump({
        "earliest_month": months[0] if months else None,
        "latest_month": months[-1] if months else None,
        "span_months": len(months),
        "by_month": dict(sorted(time_counts.items())),
        "by_source_and_month": {s: dict(sorted(c.items()))
                                for s, c in time_by_source.items()},
        "rows_without_date": len(relevant) - len(ym),
    }, open(config.TIME_DIST, "w"), indent=2)

    # ---- sample_quotes.json : ~50 representative, balanced across categories ----
    samples = []
    per_cat = max(1, 50 // max(1, len(by_cat)))
    for cat in by_cat:
        pool = sorted((r for r in relevant if r["category"] == cat),
                      key=lambda r: _wordcount(r["text"]), reverse=True)
        for r in pool[:per_cat]:
            samples.append({"source": r["source"], "category": cat,
                            "rating": r["rating"], "text": r["text"][:500]})
    json.dump(samples[:50], open(config.SAMPLE_QUOTES, "w"), indent=2, ensure_ascii=False)

    # ---- theme_clusters.json : KMeans on relevant texts ----
    themes = cluster_themes([r["text"] for r in relevant])
    json.dump(themes, open(config.THEMES_OUT, "w"), indent=2, ensure_ascii=False)

    # ---- segment_analysis.json ----
    json.dump(build_segments(relevant), open(config.SEGMENT_ANALYSIS, "w"),
              indent=2, ensure_ascii=False)

    json.dump(log, open(config.LOG, "w"), indent=2)
    _print_report(summary, themes)
    return summary


REGION = {
    "us": "North America", "ca": "North America",
    "gb": "UK/Ireland", "ie": "UK/Ireland",
    "au": "ANZ", "nz": "ANZ",
    "de": "Europe", "fr": "Europe", "nl": "Europe", "be": "Europe", "ch": "Europe",
    "at": "Europe", "es": "Europe", "pt": "Europe", "it": "Europe", "se": "Europe",
    "no": "Europe", "dk": "Europe", "fi": "Europe", "pl": "Europe", "cz": "Europe",
    "ro": "Europe", "gr": "Europe", "hu": "Europe", "ua": "Europe", "ru": "Europe",
    "sk": "Europe", "bg": "Europe", "hr": "Europe", "rs": "Europe",
    "br": "LATAM", "mx": "LATAM", "ar": "LATAM", "cl": "LATAM", "co": "LATAM",
    "pe": "LATAM", "ec": "LATAM", "uy": "LATAM", "cr": "LATAM", "gt": "LATAM",
    "do": "LATAM", "bo": "LATAM", "py": "LATAM",
    "in": "South Asia", "lk": "South Asia", "bd": "South Asia", "np": "South Asia",
    "pk": "South Asia",
    "id": "SE Asia", "ph": "SE Asia", "my": "SE Asia", "sg": "SE Asia",
    "th": "SE Asia", "vn": "SE Asia",
    "jp": "East Asia", "kr": "East Asia", "tw": "East Asia", "hk": "East Asia",
    "za": "MEA", "ng": "MEA", "ke": "MEA", "gh": "MEA", "eg": "MEA", "ma": "MEA",
    "ae": "MEA", "sa": "MEA", "il": "MEA", "tr": "MEA", "qa": "MEA", "kw": "MEA",
    "global": "Global(Play en)",
}
_POWER = re.compile(r"premium|\d{3,}\s*songs|thousands of|since 20|for years|"
                    r"power user|huge library|my library|\d+\s*playlists|paid", re.I)
_NEED_SIGNALS = {
    "lost_dislike_reset_control": r"don.?t like (button|option)|dislike (button|option)|"
                                  r"reset|hide (song|artist)|exclude.*taste|block (this )?song",
    "shuffle_repeats_small_pool": r"shuffle.*(same|repeat|loop|\d+ songs)|same \d+ songs|"
                                  r"same songs (over|again)|not (really )?random",
    "recs_too_narrow_boxed_in": r"same (boring|kind of) music|stuck in|in a box|"
                                r"no (new|different)|nothing (new|different)|too narrow|echo chamber",
    "ai_generated_flooding": r"ai (generated|music|slop|songs)|generated (music|songs)|fake (artist|band)",
    "cant_find_new_music": r"can.?t find new|hard to (find|discover)|discover.*(poor|bad|worse|gone)",
    "forced_recs_in_playlist": r"(adds?|injects?|playing) (songs|music).*(not|isn.?t) (in|on) my playlist|"
                               r"similar songs.*playlist|songs (not|that aren.?t) in (the|my) playlist",
}


def build_segments(rows):
    import json as _json

    def lang_of(r):
        try:
            return _json.loads(r.get("metadata") or "{}").get("lang", "")
        except Exception:
            return ""

    def region_of(r):
        c = (r.get("country") or "").strip().lower()
        if c in REGION:
            return REGION[c]
        return {"reddit": "Reddit(global)", "forums": "Forum(global)"}.get(r["source"], "Unknown")

    def utype(r):
        return "power_user" if _POWER.search(r["text"]) else "casual_or_unknown"

    PROBLEM = {"repetition_issue", "discovery_issue", "algorithm_mismatch"}

    def crosstab(keyfn):
        agg = defaultdict(lambda: Counter())
        for r in rows:
            agg[keyfn(r)][r["category"]] += 1
        out = {}
        for k, c in agg.items():
            tot = sum(c.values())
            if tot < 25:           # suppress tiny/noisy cohorts
                continue
            out[k] = {
                "total": tot,
                "categories": dict(c),
                "repetition_rate": round(c["repetition_issue"] / tot, 3),
                "problem_rate": round(sum(c[x] for x in PROBLEM) / tot, 3),
                "positive_rate": round((c["discovery_positive"]) / tot, 3),
            }
        return dict(sorted(out.items(), key=lambda kv: -kv[1]["total"]))

    by_platform = crosstab(lambda r: r["source"])
    by_region = crosstab(region_of)
    by_language = crosstab(lambda r: lang_of(r) or "en/unknown")
    by_user_type = crosstab(utype)

    # unmet-need signal frequencies
    needs = {}
    for name, pat in _NEED_SIGNALS.items():
        rx = re.compile(pat, re.I)
        needs[name] = sum(1 for r in rows if rx.search(r["text"]))

    # most-affected cohorts by repetition (min volume 40)
    affected = sorted(
        ({"cohort": k, **v} for k, v in {**by_region, **by_language}.items()
         if v["total"] >= 40),
        key=lambda d: -d["repetition_rate"])[:8]

    return {
        "by_platform": by_platform,
        "by_region": by_region,
        "by_language": by_language,
        "by_user_type": by_user_type,
        "unmet_need_signals": dict(sorted(needs.items(), key=lambda kv: -kv[1])),
        "most_repetition_affected_cohorts": affected,
        "notes": "Heuristic segmentation; power_user inferred from text cues "
                 "(premium/years/large library). Run the Claude classifier for "
                 "higher-precision category + segment labels.",
    }


def cluster_themes(texts, k=8):
    if len(texts) < k:
        return []
    vec = TfidfVectorizer(min_df=3, max_df=0.5, stop_words="english",
                          ngram_range=(1, 2), max_features=20000)
    X = vec.fit_transform(texts)
    km = KMeans(n_clusters=k, random_state=0, n_init=5).fit(X)
    terms = vec.get_feature_names_out()
    out = []
    for ci in range(k):
        center = km.cluster_centers_[ci]
        top = [terms[t] for t in center.argsort()[::-1][:8]]
        members = [texts[i] for i in range(len(texts)) if km.labels_[i] == ci]
        examples = sorted(members, key=len, reverse=True)[:3]
        out.append({"cluster": ci, "size": len(members), "top_terms": top,
                    "examples": [e[:300] for e in examples]})
    return sorted(out, key=lambda c: c["size"], reverse=True)


def _print_report(summary, themes):
    print("\n" + "=" * 60 + "\nSOURCE BREAKDOWN\n" + "=" * 60)
    for s, n in sorted(summary["by_source"].items(), key=lambda x: -x[1]):
        print(f"  {n:>6}  {s}")
    print(f"  {summary['final_total']:>6}  TOTAL")
    print("\nCATEGORY BREAKDOWN")
    for c, n in sorted(summary["by_category"].items(), key=lambda x: -x[1]):
        print(f"  {n:>6}  {c}")
    print("\nTHEME CLUSTERS (top terms)")
    for t in themes:
        print(f"  [{t['size']:>5}] {', '.join(t['top_terms'][:6])}")


if __name__ == "__main__":
    build()
