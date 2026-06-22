"""Module 6 — Weekly Pulse.

The dataset is historical reviews, so 'pulse' = latest complete period vs the
prior period (monthly granularity, since review timestamps are daily/monthly).
Generates: key trends, rising issues, notable discoveries, rec-system risks.
"""
from collections import Counter


def weekly_pulse(df):
    months = sorted(m for m in df["year_month"].unique() if m)
    months = [m for m in months if len(df[df["year_month"] == m]) >= 50]
    if len(months) < 2:
        return {"note": "Insufficient dated volume for period-over-period pulse."}
    cur, prev = months[-1], months[-2]
    c = df[df["year_month"] == cur]
    p = df[df["year_month"] == prev]

    def shares(g):
        n = len(g)
        return {k: v / n for k, v in Counter(g["category"]).items()}, n

    cs, cn = shares(c)
    ps, pn = shares(p)
    rising = []
    for cat in ["repetition_issue", "algorithm_mismatch", "discovery_issue"]:
        delta = cs.get(cat, 0) - ps.get(cat, 0)
        rising.append({"issue": cat, "current_share": round(cs.get(cat, 0), 3),
                       "delta_vs_prev": round(delta, 3)})
    rising.sort(key=lambda r: -r["delta_vs_prev"])

    notable = [{"text": " ".join(t.split())[:200], "region": rg}
               for t, rg in zip(
                   c[c["category"] == "discovery_positive"].head(3)["text"],
                   c[c["category"] == "discovery_positive"].head(3)["region"])]

    rec_risk = round(cs.get("algorithm_mismatch", 0) + cs.get("repetition_issue", 0), 3)
    prev_risk = round(ps.get("algorithm_mismatch", 0) + ps.get("repetition_issue", 0), 3)

    return {
        "current_period": cur, "prior_period": prev,
        "key_trends": {
            "review_volume": int(cn), "volume_delta_vs_prev": int(cn - pn),
            "problem_rate": round(float(c["is_problem"].mean()), 3),
            "problem_rate_prev": round(float(p["is_problem"].mean()), 3)},
        "rising_issues": rising,
        "notable_discoveries": notable,
        "recommendation_system_risk": {
            "current": rec_risk, "prior": prev_risk,
            "direction": "up" if rec_risk > prev_risk else "down/flat"},
    }
