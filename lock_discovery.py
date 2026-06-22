"""
FREEZE / EXPORT step (no pipeline changes, no re-classification, no re-dedup).

Reads the existing data/cleaned_dataset.csv and produces the final source of
truth:
  LAYER 1 (locked, verbatim): all rows already classified discovery_issue /
          repetition_issue / algorithm_mismatch / discovery_positive.
  LAYER 2 (adjacent signal): rows from general_music_experience that explicitly
          mention discovery-adjacent concepts (playlists, shuffle, recs, radio,
          Discover Weekly, Release Radar, finding new music, variety/diversity,
          personalization, taste profile, music suggestions...). Generic
          sentiment-only and bug/payment-only rows are removed.

Output: data/discovery_insights_dataset.csv   (+ data/discovery_insights_report.json)
This script does NOT modify is_relevant/categorize or any raw/normalized data.
"""
import csv
import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config            # noqa: E402  (paths only)
import build_dataset     # noqa: E402  (reuse read-only analysis helpers)

SRC = config.CLEANED
OUT = os.path.join(config.DATA, "discovery_insights_dataset.csv")
REPORT = os.path.join(config.DATA, "discovery_insights_report.json")

DISCOVERY_CATS = {"discovery_issue", "repetition_issue",
                  "algorithm_mismatch", "discovery_positive"}

# Adjacent-signal selector (applied ONLY to general_music_experience rows).
ADJACENT = re.compile(
    r"playlist|shuffle|recommend|\bradio\b|discover weekly|release radar|"
    r"discover|finding new|find new|new music|new artist|discovering|"
    r"variety|diversit|divers\b|repetit|same songs?|personaliz|personalis|"
    r"taste profile|music taste|suggestion|daily mix|\bmixes?\b|autoplay|"
    r"for you|curat", re.I)
# bug/payment-only exclusion (kept identical to config.NEGATIVE_HINTS intent)
BUGPAY = re.compile("|".join(re.escape(k) for k in config.NEGATIVE_HINTS), re.I)


def main():
    rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
    discovery, general = [], []
    for r in rows:
        (discovery if r["category"] in DISCOVERY_CATS else general).append(r)

    # LAYER 1 — locked verbatim (no dedup, no reclassification)
    for r in discovery:
        r["layer"] = "discovery_specific"

    # LAYER 2 — adjacent signal from general_music_experience
    adjacent = []
    for r in general:
        t = r["text"]
        if not ADJACENT.search(t):
            continue                         # drop generic sentiment-only
        if BUGPAY.search(t) and not ADJACENT.search(t):
            continue                         # (defensive) drop pure bug/payment
        r["layer"] = "adjacent_signal"
        adjacent.append(r)

    combined = discovery + adjacent
    cols = ["id", "source", "text", "rating", "timestamp", "country",
            "category", "layer", "metadata"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(combined)

    # ---------------- REPORT ----------------
    seg = build_dataset.build_segments(combined)
    themes = build_dataset.cluster_themes([r["text"] for r in combined], k=8)

    def top_terms(cat_rows, n=10):
        words = Counter()
        stop = set("the a an and to of is it i you my me this that for in on with "
                   "but so just not no my they them we app spotify music songs song "
                   "have has are was can get all out your their too very".split())
        for r in cat_rows:
            for w in re.findall(r"[a-z']{4,}", r["text"].lower()):
                if w not in stop:
                    words[w] += 1
        return words.most_common(n)

    rep_rows = [r for r in combined if r["category"] == "repetition_issue"]
    mismatch_rows = [r for r in combined if r["category"] == "algorithm_mismatch"]

    report = {
        "1_discovery_specific_count": len(discovery),
        "1_note": "Locked verbatim; exact-dedup was already applied upstream in "
                  "build_dataset, so no further duplicates removed (count unchanged).",
        "2_adjacent_signal_count": len(adjacent),
        "3_combined_count": len(combined),
        "4_source_breakdown": dict(Counter(r["source"] for r in combined)),
        "4_source_x_layer": {
            "discovery_specific": dict(Counter(r["source"] for r in discovery)),
            "adjacent_signal": dict(Counter(r["source"] for r in adjacent))},
        "5_segment_breakdown": {
            "by_platform": seg["by_platform"],
            "by_region": seg["by_region"],
            "by_language": seg["by_language"],
            "by_user_type": seg["by_user_type"]},
        "6_top_discovery_themes": [
            {"size": t["size"], "top_terms": t["top_terms"]} for t in themes],
        "7_top_unmet_needs": seg["unmet_need_signals"],
        "8_top_causes_of_repetitive_listening": top_terms(rep_rows),
        "9_top_recommendation_frustrations": top_terms(mismatch_rows),
        "10_most_affected_segments": seg["most_repetition_affected_cohorts"],
        "category_breakdown_combined": dict(Counter(r["category"] for r in combined)),
    }
    json.dump(report, open(REPORT, "w"), indent=2, ensure_ascii=False)

    print(f"discovery_specific : {len(discovery)}")
    print(f"adjacent_signal    : {len(adjacent)}")
    print(f"COMBINED           : {len(combined)} -> {os.path.relpath(OUT)}")
    print(f"report -> {os.path.relpath(REPORT)}")
    return report


if __name__ == "__main__":
    main()
