"""
Export lightweight, frozen JSON for the Vercel/Next.js dashboard.

READ-ONLY. Does not modify the dataset, engine logic, or the Streamlit app.
Reuses engine.loader (read-only) to derive the same lang/region/sentiment/
user_type fields the Streamlit dashboard uses, so the two stay consistent.

Inputs (frozen):
  data/discovery_insights_dataset.csv
  data/engine_output.json
Outputs (vercel-dashboard/public/data/):
  engine_output.json        (copy of the precomputed metrics)
  dashboard_summary.json    (REAL counts from the full 26,823-row dataset)
  reviews_sample.json       (balanced sample for the Review Explorer)

Run:  python3 scripts/export_vercel_data.py
"""
import json
import os
import shutil
import sys
import warnings
from collections import Counter

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import config            # noqa: E402
from engine import loader  # noqa: E402  (read-only field derivation)

OUT_DIR = os.path.join(ROOT, "vercel-dashboard", "public", "data")
SAMPLE_SIZE = 1800
TEXT_MAX = 320


def counts(series):
    return {str(k): int(v) for k, v in series.value_counts().items()}


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    df = loader.load()
    engine_path = os.path.join(config.DATA, "engine_output.json")
    engine = json.load(open(engine_path))

    # 1) copy engine_output.json verbatim
    shutil.copyfile(engine_path, os.path.join(OUT_DIR, "engine_output.json"))

    # 2) dashboard_summary.json — REAL counts from the FULL dataset
    total = len(df)
    summary = {
        "generated_from": "discovery_insights_dataset.csv (frozen v1)",
        "totals": {
            "total_reviews": total,
            "discovery_specific": int((df["layer"] == "discovery_specific").sum()),
            "adjacent_signal": int((df["layer"] == "adjacent_signal").sum()),
            "problem_reviews": int(df["is_problem"].sum()),
            "problem_rate": round(float(df["is_problem"].mean()), 3),
        },
        "by_category": counts(df["category"]),
        "by_source": counts(df["source"]),
        "by_layer": counts(df["layer"]),
        "by_sentiment": counts(df["sentiment"]),
        "by_user_type": counts(df["user_type"]),
        "by_region": counts(df["region"]),
        "by_language": counts(df["lang"]),
        # echo engine-computed blocks the frontend reuses directly
        "sentiment_distribution": engine.get("review_analytics") and engine["sentiment_distribution"],
        "review_analytics": engine["review_analytics"],
        "trend": engine["trend"],
    }
    json.dump(summary, open(os.path.join(OUT_DIR, "dashboard_summary.json"), "w"),
              indent=2, ensure_ascii=False)

    # 3) reviews_sample.json — balanced sample (real total preserved separately)
    sample_rows = []
    cats = list(df["category"].unique())
    per_cat = max(1, SAMPLE_SIZE // len(cats))
    for cat in cats:
        sub = df[df["category"] == cat]
        take = sub.sample(min(per_cat, len(sub)), random_state=7)
        for _, r in take.iterrows():
            sample_rows.append({
                "id": r["id"], "source": r["source"], "country": r["country"],
                "lang": r["lang"], "region": r["region"], "category": r["category"],
                "layer": r["layer"], "sentiment": r["sentiment"],
                "rating": r["rating"], "text": " ".join(str(r["text"]).split())[:TEXT_MAX],
            })
    reviews = {
        "note": "Balanced sample for the Review Explorer. Aggregate counts in "
                "dashboard_summary.json reflect the FULL dataset, not this sample.",
        "full_total": total,
        "sample_size": len(sample_rows),
        "filters": {
            "categories": sorted(df["category"].unique().tolist()),
            "sources": sorted(df["source"].unique().tolist()),
            "regions": sorted(df["region"].unique().tolist()),
            "sentiments": sorted(df["sentiment"].unique().tolist()),
        },
        "rows": sample_rows,
    }
    json.dump(reviews, open(os.path.join(OUT_DIR, "reviews_sample.json"), "w"),
              indent=2, ensure_ascii=False)

    for f in ["engine_output.json", "dashboard_summary.json", "reviews_sample.json"]:
        p = os.path.join(OUT_DIR, f)
        print(f"  wrote {os.path.relpath(p, ROOT)}  ({os.path.getsize(p)//1024} KB)")
    print(f"Sample rows: {len(sample_rows)} | full dataset: {total}")


if __name__ == "__main__":
    main()
