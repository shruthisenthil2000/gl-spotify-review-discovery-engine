"""Module 3 — User Segmentation: power/casual, region, language, platform.
Shows which segments are most affected by repetition and discovery issues."""
from collections import Counter

PROBLEM = {"repetition_issue", "discovery_issue", "algorithm_mismatch"}


def _crosstab(df, col, min_n=25):
    out = {}
    for key, g in df.groupby(col):
        tot = len(g)
        if tot < min_n:
            continue
        cats = Counter(g["category"])
        out[str(key)] = {
            "total": int(tot),
            "repetition_rate": round(float((g["category"] == "repetition_issue").mean()), 3),
            "discovery_issue_rate": round(float((g["category"] == "discovery_issue").mean()), 3),
            "algorithm_mismatch_rate": round(float((g["category"] == "algorithm_mismatch").mean()), 3),
            "problem_rate": round(float(g["is_problem"].mean()), 3),
            "positive_rate": round(float((g["category"] == "discovery_positive").mean()), 3),
            "categories": {k: int(v) for k, v in cats.items()},
        }
    return dict(sorted(out.items(), key=lambda kv: -kv[1]["total"]))


def segmentation(df):
    by_platform = _crosstab(df, "source")
    by_region = _crosstab(df, "region")
    by_language = _crosstab(df, "lang")
    by_user_type = _crosstab(df, "user_type")
    most_affected = sorted(
        ({"cohort": k, **v} for k, v in {**by_region, **by_language}.items()
         if v["total"] >= 40),
        key=lambda d: -d["repetition_rate"])[:10]
    return {
        "by_platform": by_platform,
        "by_region": by_region,
        "by_language": by_language,
        "by_user_type": by_user_type,
        "most_affected_by_repetition": most_affected,
    }
