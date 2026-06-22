"""
SOURCE 4 (optional) — Spotify Community forum discussions.

Plain-language summary:
  Spotify's own community forum has threads about discovery/recommendations.
  This searches the public forum and keeps thread titles + snippets. Forum
  HTML changes often, so treat this as best-effort: if the layout shifts and
  this returns 0 rows, that's a known fragility, not a crash — skip it and
  rely on the App Store + Play Store + Reddit sources.

Run:    python3 collectors/forums.py
Output: data/raw_forums.csv
"""

import csv
import os
import re
import time
import urllib.parse
import urllib.request

BASE = "https://community.spotify.com"
QUERIES = ["discover weekly", "recommendations", "algorithm repetitive",
           "release radar", "same songs"]
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw_forums.csv")
UA = "spotify-discovery-research/0.1"


def search(q):
    url = (BASE + "/t5/forums/searchpage/tab/message?q="
           + urllib.parse.quote(q))
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.read().decode("utf-8", "ignore")
    except Exception as ex:
        print(f"  '{q}': {ex}")
        return ""


def main():
    rows = {}
    for q in QUERIES:
        html = search(q)
        # Best-effort: pull thread titles from anchor tags to message pages.
        for m in re.finditer(r'href="(/t5/[^"]*/m-p/\d+)"[^>]*>([^<]{15,})</a>', html):
            href, title = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
            rows[href] = {
                "source": "spotify_forum",
                "country": "community",
                "date": "",
                "rating": "",
                "title": title,
                "text": title,
                "review_id": href,
            }
        print(f"  '{q}': running total {len(rows)} threads")
        time.sleep(1.0)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    cols = ["source", "country", "date", "rating", "title", "text", "review_id"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows.values())
    print(f"\nTOTAL forum threads: {len(rows)}  (0 = layout changed, safe to skip)")
    print(f"Saved -> {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
