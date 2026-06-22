"""
Engine data loader.

Reads the FROZEN discovery_insights_dataset.csv (read-only) and derives
in-memory analysis fields. The source CSV is never modified.

Derived fields (computed at load, not persisted to the frozen file):
  lang        from metadata.lang (Play Store locale) else 'en/unknown'
  region      mapped from country code
  year_month  parsed from timestamp ('' if unknown)
  sentiment   positive | neutral | frustrated  (rating + category proxy)
  user_type   power_user | casual_or_unknown   (text heuristic)
"""
import json
import os
import re
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config            # noqa: E402
import build_dataset     # noqa: E402  (reuse REGION / _POWER, read-only)

DATASET = os.path.join(config.DATA, "discovery_insights_dataset.csv")

NEGATIVE_CATS = {"discovery_issue", "repetition_issue", "algorithm_mismatch"}


def _year_month(ts):
    s = str(ts)
    m = re.search(r"(\d{4})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    if re.fullmatch(r"\d{9,10}(\.\d+)?", s):
        import datetime as dt
        try:
            return dt.datetime.utcfromtimestamp(float(s)).strftime("%Y-%m")
        except Exception:
            return ""
    return ""


def _sentiment(cat, rating):
    if cat == "discovery_positive":
        return "positive"
    try:
        r = float(rating)
        if r >= 4:
            return "positive"
        if r <= 2:
            return "frustrated"
        return "neutral"
    except (TypeError, ValueError):
        return "frustrated" if cat in NEGATIVE_CATS else "neutral"


def _lang(meta):
    try:
        return json.loads(meta or "{}").get("lang", "") or ""
    except Exception:
        return ""


def load():
    df = pd.read_csv(DATASET, dtype=str).fillna("")
    df["lang"] = df["metadata"].map(_lang).replace("", "en/unknown")
    df["region"] = df["country"].str.lower().map(build_dataset.REGION)
    df.loc[df["region"].isna() & (df["source"] == "reddit"), "region"] = "Reddit(global)"
    df.loc[df["region"].isna() & (df["source"] == "forums"), "region"] = "Forum(global)"
    df["region"] = df["region"].fillna("Other")
    df["year_month"] = df["timestamp"].map(_year_month)
    df["sentiment"] = [_sentiment(c, r) for c, r in zip(df["category"], df["rating"])]
    df["user_type"] = df["text"].map(
        lambda t: "power_user" if build_dataset._POWER.search(t) else "casual_or_unknown")
    df["is_problem"] = df["category"].isin(NEGATIVE_CATS)
    return df


if __name__ == "__main__":
    d = load()
    print(d[["source", "category", "layer", "region", "lang",
             "year_month", "sentiment", "user_type"]].head())
    print("rows:", len(d))
