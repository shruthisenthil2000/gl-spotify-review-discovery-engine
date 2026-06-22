"""
SOURCE 1 — Apple App Store reviews for Spotify.

Plain-language summary:
  Apple publishes a public "RSS" feed of recent reviews for any app, per
  country store. For Spotify (app id 324684580) each country gives up to
  10 pages x 50 reviews = ~500 most-recent reviews. To get more, we ask
  several English-speaking country stores and combine them.

  This script writes ALL raw reviews it finds (we filter for relevance and
  clean later, so nothing is lost at this stage).

Run:
  python3 collectors/appstore.py
Output:
  data/raw_appstore.csv
"""

import csv
import json
import os
import time
import urllib.request

APP_ID = "324684580"  # Spotify on the App Store

# English-language stores give us reviews our keyword filter can read.
COUNTRIES = ["us", "gb", "ca", "au", "ie", "nz", "in", "za", "sg", "ph"]

PAGES = range(1, 11)  # Apple caps the review feed at 10 pages
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw_appstore.csv")
URL = ("https://itunes.apple.com/{c}/rss/customerreviews/"
       "id={a}/sortBy=mostRecent/page={p}/json")


def fetch(country, page):
    url = URL.format(c=country, a=APP_ID, p=page)
    req = urllib.request.Request(url, headers={"User-Agent": "spotify-research/0.1"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)


def parse_entry(e, country):
    """Pull the fields we care about from one feed entry."""
    if "content" not in e or "im:rating" not in e:
        return None  # app-metadata entry, not a review
    return {
        "source": "app_store",
        "country": country,
        "date": e.get("updated", {}).get("label", "")[:10],
        "rating": e.get("im:rating", {}).get("label", ""),
        "title": e.get("title", {}).get("label", ""),
        "text": e.get("content", {}).get("label", ""),
        "review_id": e.get("id", {}).get("label", ""),
    }


def main():
    rows = {}
    for c in COUNTRIES:
        got = 0
        for p in PAGES:
            try:
                data = fetch(c, p)
            except Exception as ex:
                print(f"  [{c}] page {p}: stopped ({ex})")
                break
            entries = data.get("feed", {}).get("entry", [])
            if not entries:
                break
            for e in entries:
                row = parse_entry(e, c)
                if row and row["review_id"]:
                    rows[row["review_id"]] = row  # dedupe by Apple review id
                    got += 1
            time.sleep(0.4)  # be polite to Apple's servers
        print(f"  [{c}] collected {got} reviews")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    cols = ["source", "country", "date", "rating", "title", "text", "review_id"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows.values():
            w.writerow(r)
    print(f"\nTOTAL App Store reviews (deduped): {len(rows)}")
    print(f"Saved -> {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
