"""Module 1 — Review Analytics: counts, sentiment distribution, trend tracking."""
from collections import Counter


def review_analytics(df):
    cats = Counter(df["category"])
    return {
        "total_reviews": int(len(df)),
        "discovery_specific": int((df["layer"] == "discovery_specific").sum()),
        "adjacent_signal": int((df["layer"] == "adjacent_signal").sum()),
        "discovery_issue": int(cats.get("discovery_issue", 0)),
        "repetition_issue": int(cats.get("repetition_issue", 0)),
        "algorithm_mismatch": int(cats.get("algorithm_mismatch", 0)),
        "discovery_positive": int(cats.get("discovery_positive", 0)),
        "general_music_experience": int(cats.get("general_music_experience", 0)),
        "problem_reviews": int(df["is_problem"].sum()),
        "problem_rate": round(float(df["is_problem"].mean()), 3),
    }


def sentiment_distribution(df):
    counts = Counter(df["sentiment"])
    tot = len(df)
    return {
        "counts": {k: int(v) for k, v in counts.items()},
        "share": {k: round(v / tot, 3) for k, v in counts.items()},
        "net_sentiment": round((counts.get("positive", 0)
                                - counts.get("frustrated", 0)) / tot, 3),
    }


def trend(df, min_month="2024-01"):
    """Monthly volume + problem-rate (only months with enough data)."""
    d = df[(df["year_month"] != "") & (df["year_month"] >= min_month)]
    rows = []
    for ym, g in d.groupby("year_month"):
        if len(g) < 20:
            continue
        rows.append({
            "month": ym,
            "reviews": int(len(g)),
            "problem_rate": round(float(g["is_problem"].mean()), 3),
            "repetition_rate": round(float((g["category"] == "repetition_issue").mean()), 3),
            "positive_rate": round(float((g["category"] == "discovery_positive").mean()), 3),
        })
    return sorted(rows, key=lambda r: r["month"])
