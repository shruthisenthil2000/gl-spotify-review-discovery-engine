"""
Collector: Reddit.

PRIMARY: ingest the provided Apify scrape (config.REDDIT_INPUT) — posts AND
comments across r/spotify, r/truespotify, r/Music, r/listentothis, etc.
OPTIONAL: if REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET are set, also pull live
posts to top up volume (logged separately).

Output: data/raw/reddit.csv
"""
import csv
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402

OUT = os.path.join(config.RAW, "reddit.csv")


def _text(row):
    body = str(row.get("body") or "").strip()
    title = str(row.get("title") or "").strip()
    if body and body.lower() != "nan":
        # comment (or post body); prepend post title for context if short
        return (title + ". " + body).strip(". ") if (title and title.lower() != "nan") else body
    return title if title.lower() != "nan" else ""


def collect():
    stats = {"source": "reddit", "raw": 0, "from_apify": 0, "from_api": 0}
    if not os.path.exists(config.REDDIT_INPUT):
        print(f"  Apify file not found: {config.REDDIT_INPUT} — skipping (logged).")
        stats["limitation"] = "provided Apify file missing"
        return stats

    df = pd.read_csv(config.REDDIT_INPUT, low_memory=False)
    out = []
    for _, r in df.iterrows():
        text = _text(r)
        ts = r.get("commentCreatedAt") or r.get("createdAt") or ""
        out.append({
            "review_id": str(r.get("id") or r.get("parsedId") or len(out)),
            "country": "",
            "rating": r.get("upVotes") if pd.notna(r.get("upVotes")) else r.get("score"),
            "timestamp": str(ts),
            "title": str(r.get("title") or r.get("postTitle") or ""),
            "text": text,
            "subreddit": str(r.get("subredditName") or r.get("communityName") or ""),
            "data_type": str(r.get("dataType") or ""),
            "search_term": str(r.get("searchTerm") or ""),
        })
    stats["from_apify"] = len(out)

    # --- optional live top-up (only if creds present) ---
    if os.environ.get("REDDIT_CLIENT_ID") and os.environ.get("REDDIT_CLIENT_SECRET"):
        try:
            out += _live_topup()
            stats["from_api"] = len(out) - stats["from_apify"]
        except Exception as ex:
            print(f"  live Reddit top-up failed ({ex}); using Apify data only.")
            stats["limitation"] = f"live top-up failed: {ex}"
    else:
        stats["note"] = "no REDDIT_CLIENT_ID/SECRET — Apify scrape only"

    os.makedirs(config.RAW, exist_ok=True)
    cols = ["review_id", "country", "rating", "timestamp", "title", "text",
            "subreddit", "data_type", "search_term"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(out)
    stats["raw"] = len(out)
    print(f"TOTAL reddit raw: {len(out)} (apify={stats['from_apify']}, "
          f"api={stats.get('from_api',0)}) -> {os.path.relpath(OUT)}")
    return stats


def _live_topup():
    """Pull recent posts via Reddit's free API for extra volume."""
    import base64, json, time, urllib.parse, urllib.request
    cid = os.environ["REDDIT_CLIENT_ID"]
    sec = os.environ["REDDIT_CLIENT_SECRET"]
    ua = "discovery-research/1.0"
    auth = base64.b64encode(f"{cid}:{sec}".encode()).decode()
    data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    req = urllib.request.Request("https://www.reddit.com/api/v1/access_token",
                                 data=data, headers={"User-Agent": ua,
                                 "Authorization": f"Basic {auth}"})
    token = json.load(urllib.request.urlopen(req, timeout=25))["access_token"]
    subs = ["spotify", "truespotify", "Music", "listentothis", "popheads"]
    queries = ["discover weekly", "music recommendations", "algorithm",
               "repetitive songs", "new music discovery", "release radar",
               "spotify shuffle", "playlist fatigue", "same songs"]
    rows = []
    for sub in subs:
        for q in queries:
            url = ("https://oauth.reddit.com/r/%s/search?%s" %
                   (sub, urllib.parse.urlencode({"q": q, "restrict_sr": 1,
                    "sort": "new", "t": "year", "limit": 100})))
            rq = urllib.request.Request(url, headers={"User-Agent": ua,
                                        "Authorization": f"Bearer {token}"})
            try:
                res = json.load(urllib.request.urlopen(rq, timeout=25))
            except Exception:
                continue
            for ch in res.get("data", {}).get("children", []):
                d = ch["data"]
                rows.append({
                    "review_id": d["id"], "country": "",
                    "rating": d.get("score", ""),
                    "timestamp": str(d.get("created_utc", "")),
                    "title": d.get("title", ""),
                    "text": (d.get("title", "") + ". " + d.get("selftext", "")).strip(),
                    "subreddit": f"r/{sub}", "data_type": "post", "search_term": q})
            time.sleep(1.0)
    return rows


if __name__ == "__main__":
    collect()
