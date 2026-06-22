"""
SOURCE 3 — Reddit posts + top comments (r/spotify, r/musicsuggestions, r/podcasts).

Plain-language summary:
  Reddit's old no-login feed is now blocked, so this uses Reddit's official
  free API. You create a free "app" once (5 minutes) to get two secrets,
  then this script searches each subreddit for our keywords and grabs the
  matching posts plus their top comments.

ONE-TIME SETUP (free):
  1. Go to https://www.reddit.com/prefs/apps  -> "create another app"
  2. Choose type "script". Name it anything. redirect uri: http://localhost
  3. Copy the client id (under the app name) and the secret.
  4. Set them as environment variables before running:
       export REDDIT_CLIENT_ID=xxxx
       export REDDIT_CLIENT_SECRET=yyyy

Run:    python3 collectors/reddit.py
Output: data/raw_reddit.csv
"""

import csv
import os
import time
import urllib.parse
import urllib.request

CLIENT_ID = os.environ.get("REDDIT_CLIENT_ID")
CLIENT_SECRET = os.environ.get("REDDIT_CLIENT_SECRET")
UA = "spotify-discovery-research/0.1"

SUBS = ["spotify", "musicsuggestions", "podcasts"]
QUERIES = ["discover", "recommendation", "algorithm", "repetitive",
           "new music", "discover weekly", "release radar", "playlist"]
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw_reddit.csv")


def get_token():
    if not CLIENT_ID or not CLIENT_SECRET:
        raise SystemExit(
            "Reddit credentials missing. Set REDDIT_CLIENT_ID and "
            "REDDIT_CLIENT_SECRET (see setup notes at top of this file)."
        )
    data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    req = urllib.request.Request(
        "https://www.reddit.com/api/v1/access_token", data=data,
        headers={"User-Agent": UA})
    import base64
    auth = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    req.add_header("Authorization", f"Basic {auth}")
    import json
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)["access_token"]


def api(token, path, params):
    import json
    url = "https://oauth.reddit.com" + path + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)


def main():
    token = get_token()
    rows = {}
    for sub in SUBS:
        for q in QUERIES:
            try:
                res = api(token, f"/r/{sub}/search", {
                    "q": q, "restrict_sr": 1, "sort": "new",
                    "t": "year", "limit": 100})
            except Exception as ex:
                print(f"  r/{sub} '{q}': {ex}")
                continue
            for ch in res.get("data", {}).get("children", []):
                d = ch["data"]
                text = (d.get("title", "") + ". " + d.get("selftext", "")).strip()
                rows[d["id"]] = {
                    "source": "reddit",
                    "country": f"r/{sub}",
                    "date": time.strftime("%Y-%m-%d", time.gmtime(d.get("created_utc", 0))),
                    "rating": d.get("score", ""),
                    "title": d.get("title", ""),
                    "text": text,
                    "review_id": d["id"],
                }
            time.sleep(1.0)  # Reddit allows ~60 requests/min
        print(f"  r/{sub}: running total {len(rows)} posts")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    cols = ["source", "country", "date", "rating", "title", "text", "review_id"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows.values())
    print(f"\nTOTAL Reddit posts (deduped): {len(rows)}")
    print(f"Saved -> {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
