"""
CLEANING STEP — combine every source, filter for relevance, de-duplicate.

Plain-language summary, in order:
  1. Read every data/raw_*.csv that exists.
  2. Keyword filter: keep only reviews mentioning a discovery/recommendation
     term (the spec's keyword list).
  3. Drop reviews under 10 words (too short to hold real insight).
  4. Drop exact-duplicate text.
  5. Save the clean, combined table -> data/cleaned.csv

Run:    python3 clean.py
Output: data/cleaned.csv  (columns: source, country, date, rating, text)
"""

import csv
import glob
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "collectors"))
from common import is_relevant  # noqa: E402

DATA = os.path.join(os.path.dirname(__file__), "data")
OUT = os.path.join(DATA, "cleaned.csv")
MIN_WORDS = 10


def combined_text(row):
    # App Store has a title; Play/Reddit don't. Use both when present.
    t = (row.get("title", "") + " " + row.get("text", "")).strip()
    return t


def main():
    raw_files = sorted(glob.glob(os.path.join(DATA, "raw_*.csv")))
    if not raw_files:
        print("No raw_*.csv files found. Run the collectors first.")
        return

    kept, seen_text = [], set()
    stats = {}
    for path in raw_files:
        name = os.path.basename(path)
        rows = list(csv.DictReader(open(path, encoding="utf-8")))
        s = {"raw": len(rows), "relevant": 0, "long_enough": 0, "kept": 0}
        for r in rows:
            text = combined_text(r)
            if not is_relevant(text):
                continue
            s["relevant"] += 1
            if len(text.split()) < MIN_WORDS:
                continue
            s["long_enough"] += 1
            norm = " ".join(text.lower().split())
            if norm in seen_text:
                continue
            seen_text.add(norm)
            s["kept"] += 1
            kept.append({
                "source": r.get("source", ""),
                "country": r.get("country", ""),
                "date": r.get("date", ""),
                "rating": r.get("rating", ""),
                "text": text,
            })
        stats[name] = s

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["source", "country", "date", "rating", "text"])
        w.writeheader()
        w.writerows(kept)

    print("Cleaning report (per source):")
    for name, s in stats.items():
        print(f"  {name:24} raw={s['raw']:>6}  relevant={s['relevant']:>5}"
              f"  >={MIN_WORDS}w={s['long_enough']:>5}  kept={s['kept']:>5}")
    print(f"\nFINAL cleaned dataset: {len(kept)} reviews -> {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
