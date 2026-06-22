"""Module 4 + 5 — Insight Generation & PM Priority Radar.

Insight = {title, evidence_count, affected_segment, representative_quotes,
           severity_score, category}.
severity_score (0-100) = 100 * (0.45*norm_frequency + 0.35*negativity + 0.20*reach)
  norm_frequency = log1p(evidence) / log1p(max_evidence)
  negativity     = share of 'frustrated' sentiment among matching reviews
  reach          = distinct regions (>=5 hits) affected / regions in scope
Priority score (radar) = severity_score * log1p(evidence_count)  [Impact x Frequency]
"""
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import build_dataset  # noqa: E402

# Human-readable titles for the need signals.
NEED_TITLES = {
    "shuffle_repeats_small_pool": "Shuffle replays a small pool of a large library",
    "ai_generated_flooding": "AI-generated tracks flooding discovery surfaces",
    "lost_dislike_reset_control": "Users want dislike / reset / taste controls back",
    "recs_too_narrow_boxed_in": "Recommendations feel narrow — 'stuck in a box'",
    "cant_find_new_music": "Hard to find / discover genuinely new music",
    "forced_recs_in_playlist": "Recommended songs forced into user playlists",
}


def _quotes(rows, n=3):
    out, seen = [], set()
    cand = [r for r in rows if 60 <= len(r["text"]) <= 240]
    # prefer frustrated + English + mid-length quotes (most evidentiary for a PM)
    cand.sort(key=lambda r: (r["sentiment"] != "frustrated",
                             not r["lang"].startswith("en"), -len(r["text"])))
    for r in cand:
        key = r["text"][:40].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({"source": r["source"], "region": r["region"],
                    "rating": r["rating"], "text": " ".join(r["text"].split())[:240]})
        if len(out) >= n:
            break
    return out


def _affected_segment(sub):
    best, best_rate = None, -1
    for region, g in sub.groupby("region"):
        if len(g) >= 8 and len(g) / len(sub) > 0.05:
            rate = len(g) / len(sub)
            if rate > best_rate:
                best, best_rate = region, rate
    pu = (sub["user_type"] == "power_user").mean()
    seg = best or "broad / cross-region"
    return f"{seg} (power-user share {pu:.0%})"


def _build(df, defs):
    raw = []
    for d in defs:
        sub = df[df["text"].str.contains(d["rx"])] if d["rx"] else df[d["mask"](df)]
        if len(sub) < 10:
            continue
        neg = float((sub["sentiment"] == "frustrated").mean())
        regions = sum(1 for _, g in sub.groupby("region") if len(g) >= 5)
        raw.append({"title": d["title"], "category": d["category"],
                    "evidence_count": int(len(sub)), "negativity": round(neg, 3),
                    "reach_regions": regions,
                    "affected_segment": _affected_segment(sub),
                    "representative_quotes": _quotes(sub.to_dict("records"))})
    if not raw:
        return []
    max_ev = max(r["evidence_count"] for r in raw)
    total_regions = max(r["reach_regions"] for r in raw) or 1
    for r in raw:
        nf = math.log1p(r["evidence_count"]) / math.log1p(max_ev)
        reach = r["reach_regions"] / total_regions
        r["severity_score"] = round(100 * (0.45 * nf + 0.35 * r["negativity"]
                                           + 0.20 * reach), 1)
    return sorted(raw, key=lambda r: -r["severity_score"])


def generate_insights(df):
    defs = [{"title": NEED_TITLES[n], "category": "unmet_need",
             "rx": re.compile(p, re.I), "mask": None}
            for n, p in build_dataset._NEED_SIGNALS.items()]
    defs += [
        {"title": "Repetition: same songs/artists on repeat", "category": "repetition_issue",
         "rx": None, "mask": lambda d: d["category"] == "repetition_issue"},
        {"title": "Recommendation mismatch: recs off-taste", "category": "algorithm_mismatch",
         "rx": None, "mask": lambda d: d["category"] == "algorithm_mismatch"},
        {"title": "Discovery friction: can't surface new music", "category": "discovery_issue",
         "rx": None, "mask": lambda d: d["category"] == "discovery_issue"},
    ]
    return _build(df, defs)


def priority_radar(insights):
    radar = []
    for ins in insights:
        impact = ins["severity_score"]                    # 0-100
        freq = ins["evidence_count"]
        score = round(impact * math.log1p(freq), 1)       # Impact x Frequency
        quadrant = ("Quick win / Now" if impact >= 60 and freq >= 300 else
                    "Strategic bet" if impact >= 60 else
                    "Monitor" if freq >= 300 else "Backlog")
        radar.append({"opportunity": ins["title"], "impact": impact,
                      "frequency": freq, "priority_score": score,
                      "quadrant": quadrant, "category": ins["category"]})
    return sorted(radar, key=lambda r: -r["priority_score"])
