"""
SOURCE 2 — Google Play Store reviews for Spotify (com.spotify.music).

Plain-language summary:
  Google has no official public reviews feed, so we use the well-known
  `google-play-scraper` library, which reads the same data the Play Store
  website shows. It pages through reviews newest-first using a
  "continuation token" (Google's bookmark for "next page").

  We pull a large batch per country, then later steps filter + clean.

Install (if needed):  pip3 install google-play-scraper
Run:                  python3 collectors/playstore.py
Output:               data/raw_playstore.csv
"""

import csv
import os
import time

from google_play_scraper import Sort, reviews

APP = "com.spotify.music"
# NOTE: Google returns the SAME global English review set regardless of the
# `country` param, so adding countries does NOT add reviews. The only way to
# get more is to page DEEPER in time from a single store.
COUNTRIES = ["us"]
TARGET_PER_COUNTRY = 35000                    # raw, before filtering
BATCH = 200                                   # Google's max per request
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw_playstore.csv")


def collect_country(country):
    out, token, pulled = [], None, 0
    while pulled < TARGET_PER_COUNTRY:
        try:
            batch, token = reviews(
                APP, lang="en", country=country,
                sort=Sort.NEWEST, count=BATCH, continuation_token=token,
            )
        except Exception as ex:
            print(f"  [{country}] stopped after {pulled}: {ex}")
            break
        if not batch:
            break
        for r in batch:
            out.append({
                "source": "play_store",
                "country": country,
                "date": str(r.get("at", ""))[:10],
                "rating": r.get("score", ""),
                "title": "",  # Play reviews have no title
                "text": r.get("content", "") or "",
                "review_id": r.get("reviewId", ""),
            })
        pulled += len(batch)
        if pulled % 4000 < BATCH:
            print(f"  [{country}] ...{pulled} so far (oldest {out[-1]['date']})")
        if token is None:
            break
        time.sleep(0.3)
    print(f"  [{country}] collected {pulled} reviews")
    return out


def main():
    rows = {}
    for c in COUNTRIES:
        for r in collect_country(c):
            if r["review_id"]:
                rows[r["review_id"]] = r

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    cols = ["source", "country", "date", "rating", "title", "text", "review_id"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows.values():
            w.writerow(r)
    print(f"\nTOTAL Play Store reviews (deduped): {len(rows)}")
    print(f"Saved -> {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
