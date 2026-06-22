"""
Collector: Apple App Store reviews for Spotify (public RSS feed).

Queries many country storefronts (config.APPSTORE_COUNTRIES). Each gives up to
10 pages x 50 = ~500 most-recent reviews. Writes raw rows; filtering happens
later in the pipeline.

Output: data/raw/app_store.csv
"""
import csv
import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402

URL = ("https://itunes.apple.com/{c}/rss/customerreviews/"
       "id={a}/sortBy=mostRecent/page={p}/json")
OUT = os.path.join(config.RAW, "app_store.csv")


def fetch(country, page):
    url = URL.format(c=country, a=config.APPSTORE_ID, p=page)
    req = urllib.request.Request(url, headers={"User-Agent": "discovery-research/1.0"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)


def collect():
    rows = {}
    stats = {"source": "app_store", "countries": {}, "raw": 0}
    for c in config.APPSTORE_COUNTRIES:
        got = 0
        for p in range(1, 11):
            try:
                entries = fetch(c, p).get("feed", {}).get("entry", [])
            except Exception as ex:
                print(f"  [{c}] page {p}: stopped ({ex})")
                break
            if not entries:
                break
            for e in entries:
                if "content" not in e or "im:rating" not in e:
                    continue
                rid = e.get("id", {}).get("label", "")
                if not rid:
                    continue
                rows[rid] = {
                    "review_id": rid,
                    "country": c,
                    "rating": e.get("im:rating", {}).get("label", ""),
                    "timestamp": e.get("updated", {}).get("label", ""),
                    "title": e.get("title", {}).get("label", ""),
                    "text": e.get("content", {}).get("label", ""),
                }
                got += 1
            time.sleep(0.35)
        stats["countries"][c] = got
        print(f"  [{c}] {got}")
    os.makedirs(config.RAW, exist_ok=True)
    cols = ["review_id", "country", "rating", "timestamp", "title", "text"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows.values())
    stats["raw"] = len(rows)
    print(f"TOTAL app_store raw (deduped by id): {len(rows)} -> {os.path.relpath(OUT)}")
    return stats


if __name__ == "__main__":
    collect()
