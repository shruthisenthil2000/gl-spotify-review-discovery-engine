"""
Step 2 — Normalization.

Reads every data/raw/*.csv and maps it to the unified schema:
  { id, source, text, rating, timestamp, country, metadata }
metadata holds source-specific extras (subreddit, title, likes, search_term...)
as a JSON string.

Output: data/normalized.csv
"""
import csv
import glob
import json
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config  # noqa: E402

OUT = os.path.join(config.DATA, "normalized.csv")
SOURCE_OF = {
    "app_store": "app_store", "play_store": "play_store",
    "reddit": "reddit", "forums": "forums",
}
EXTRA_COLS = ["title", "subreddit", "data_type", "search_term", "likes", "lang"]


def normalize():
    out = []
    counts = {}
    for path in sorted(glob.glob(os.path.join(config.RAW, "*.csv"))):
        name = os.path.splitext(os.path.basename(path))[0]
        source = SOURCE_OF.get(name, name)
        df = pd.read_csv(path, low_memory=False, dtype=str).fillna("")
        n = 0
        for _, r in df.iterrows():
            text = str(r.get("text", "")).strip()
            if not text:
                continue
            meta = {k: r[k] for k in EXTRA_COLS if k in df.columns and r[k]}
            out.append({
                "id": f"{source}:{r.get('review_id','') or n}",
                "source": source,
                "text": text,
                "rating": r.get("rating", ""),
                "timestamp": r.get("timestamp", ""),
                "country": r.get("country", ""),
                "metadata": json.dumps(meta, ensure_ascii=False),
            })
            n += 1
        counts[source] = n
        print(f"  {source}: {n}")

    cols = ["id", "source", "text", "rating", "timestamp", "country", "metadata"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(out)
    print(f"TOTAL normalized: {len(out)} -> {os.path.relpath(OUT)}")
    return {"normalized_total": len(out), "by_source": counts}


if __name__ == "__main__":
    normalize()
