"""
Collector: Spotify community forum.

Ingests the provided Apify-scraped spreadsheet (config.FORUM_INPUT). The real
review text lives in the spreadsheet's REVIEWS column (col index 6); thread
title/date/likes are present for a subset of rows. Normalizes to raw schema.

Output: data/raw/forums.csv
"""
import csv
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402

OUT = os.path.join(config.RAW, "forums.csv")
TEXT_COL, TITLE_COL, DATE_COL, LIKES_COL, KW_COL = 6, 0, 2, 4, 7


def _clean(v):
    s = "" if v is None else str(v).strip()
    return "" if s.lower() == "nan" else s


def collect():
    stats = {"source": "forums", "raw": 0}
    if not os.path.exists(config.FORUM_INPUT):
        print(f"  Forum file not found: {config.FORUM_INPUT} — skipping (logged).")
        stats["limitation"] = "provided forum file missing"
        return stats

    df = pd.read_excel(config.FORUM_INPUT, header=None)
    rows = []
    last_title = last_date = last_likes = last_kw = ""
    for ri in range(1, len(df)):                 # row 0 is a banner
        text = _clean(df.iat[ri, TEXT_COL]) if df.shape[1] > TEXT_COL else ""
        if not text:
            continue
        # thread metadata only appears on some rows; carry it forward
        title = _clean(df.iat[ri, TITLE_COL]); last_title = title or last_title
        date = _clean(df.iat[ri, DATE_COL]);   last_date = date or last_date
        likes = _clean(df.iat[ri, LIKES_COL]); last_likes = likes or last_likes
        kw = _clean(df.iat[ri, KW_COL]);       last_kw = kw or last_kw
        rows.append({
            "review_id": f"forum_{ri}",
            "country": "",
            "rating": "",
            "timestamp": last_date,
            "title": last_title,
            "text": text.strip('"“” '),
            "likes": last_likes,
            "search_term": last_kw,
        })
    os.makedirs(config.RAW, exist_ok=True)
    cols = ["review_id", "country", "rating", "timestamp", "title", "text",
            "likes", "search_term"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    stats["raw"] = len(rows)
    print(f"TOTAL forum raw: {len(rows)} -> {os.path.relpath(OUT)}")
    return stats


if __name__ == "__main__":
    collect()
