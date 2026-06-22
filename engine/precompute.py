"""
Engine orchestrator — runs all six modules over the frozen dataset and writes
data/engine_output.json (the dashboard reads this; recompute is fast/optional).

  python3 engine/precompute.py
"""
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config            # noqa: E402
from engine import loader, analytics, themes, segments, insights, pulse  # noqa: E402

OUT = os.path.join(config.DATA, "engine_output.json")


def run():
    df = loader.load()
    ins = insights.generate_insights(df)
    out = {
        "generated_from": "discovery_insights_dataset.csv (frozen v1)",
        "review_analytics": analytics.review_analytics(df),
        "sentiment_distribution": analytics.sentiment_distribution(df),
        "trend": analytics.trend(df),
        "theme_detection": themes.theme_detection(df),
        "segmentation": segments.segmentation(df),
        "insights": ins,
        "priority_radar": insights.priority_radar(ins),
        "weekly_pulse": pulse.weekly_pulse(df),
    }
    json.dump(out, open(OUT, "w"), indent=2, ensure_ascii=False)
    print(f"engine_output -> {os.path.relpath(OUT)}")
    a = out["review_analytics"]
    print(f"  total={a['total_reviews']} problems={a['problem_reviews']} "
          f"problem_rate={a['problem_rate']}")
    print(f"  insights={len(ins)} | top priority: "
          f"{out['priority_radar'][0]['opportunity']}")
    return out


if __name__ == "__main__":
    run()
