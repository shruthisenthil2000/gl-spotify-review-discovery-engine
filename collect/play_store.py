"""
Collector: Google Play Store reviews for Spotify — MULTI-LOCALE + DEEP.

Each LANGUAGE returns a distinct review pool, so we loop config.PLAYSTORE_LOCALES
(lang, country, depth) and page newest-first to the per-locale target. Reviews
are de-duplicated globally by reviewId across locales. We log, per locale, the
rows gained and the oldest date reached (historical depth).

Output: data/raw/play_store.csv
        data/raw/_play_store_locale_log.json   (gains + date span per locale)
"""
import csv
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402
from google_play_scraper import Sort, reviews  # noqa: E402

OUT = os.path.join(config.RAW, "play_store.csv")
LOCALE_LOG = os.path.join(config.RAW, "_play_store_locale_log.json")
BATCH = 200


def _pull_locale(lang, country, target, seen):
    """Page one locale newest-first; return (new_rows, stats)."""
    rows, token, pulled, added = [], None, 0, 0
    oldest = newest = None
    while pulled < target:
        for attempt in range(4):
            try:
                batch, token = reviews(
                    config.PLAYSTORE_PKG, lang=lang, country=country,
                    sort=Sort.NEWEST, count=BATCH, continuation_token=token)
                break
            except Exception as ex:
                time.sleep(3 * (attempt + 1))
                if attempt == 3:
                    print(f"    [{lang}-{country}] giving up after errors: {ex}")
                    batch, token = [], None
        if not batch:
            break
        for r in batch:
            rid = r.get("reviewId", "")
            if not rid or rid in seen:
                continue
            seen.add(rid)
            ts = str(r.get("at", ""))
            d = ts[:10]
            if d:
                oldest = d if (oldest is None or d < oldest) else oldest
                newest = d if (newest is None or d > newest) else newest
            rows.append({
                "review_id": rid, "country": country, "lang": lang,
                "rating": r.get("score", ""), "timestamp": ts, "title": "",
                "text": r.get("content", "") or ""})
            added += 1
        pulled += len(batch)
        if token is None:
            break
        time.sleep(0.25)
    return rows, {"lang": lang, "country": country, "scanned": pulled,
                  "added_unique": added, "oldest": oldest, "newest": newest}


def collect():
    os.makedirs(config.RAW, exist_ok=True)
    seen = set()
    all_rows = []
    locale_stats = []
    for lang, country, target in config.PLAYSTORE_LOCALES:
        print(f"  locale {lang}-{country} (target {target})...")
        rows, st = _pull_locale(lang, country, target, seen)
        all_rows.extend(rows)
        locale_stats.append(st)
        print(f"    +{st['added_unique']} unique | span {st['oldest']} -> {st['newest']}"
              f" | running total {len(all_rows)}")

    cols = ["review_id", "country", "lang", "rating", "timestamp", "title", "text"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(all_rows)
    json.dump(locale_stats, open(LOCALE_LOG, "w"), indent=2)
    print(f"TOTAL play_store raw (deduped by reviewId across locales): "
          f"{len(all_rows)} -> {os.path.relpath(OUT)}")
    return {"source": "play_store", "raw": len(all_rows), "locales": locale_stats}


if __name__ == "__main__":
    collect()
