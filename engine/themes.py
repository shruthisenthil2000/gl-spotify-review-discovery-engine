"""Module 2 — Theme Detection: discovery problems, recommendation complaints,
unmet needs, emerging themes. Uses TF-IDF top-terms + KMeans (read-only)."""
import os
import re
import sys
from collections import Counter

from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import build_dataset  # noqa: E402  (reuse _NEED_SIGNALS patterns, read-only)

# English stop terms for readable theme labels (analysis only, not classification)
_STOP = set("the a an and to of is it i you my me this that for in on with but so "
            "just not no app spotify music songs song have has are was can get all "
            "out your their too very they them we me at be as if or now even when "
            "what how why more most any only also from like its it's into".split())


def _top_terms(texts, n=12):
    c = Counter()
    for t in texts:
        for w in re.findall(r"[a-zà-ÿ']{4,}", str(t).lower()):
            if w not in _STOP:
                c[w] += 1
    return c.most_common(n)


def _clusters(texts, k=6):
    if len(texts) < k:
        return []
    vec = TfidfVectorizer(min_df=5, max_df=0.5, stop_words="english",
                          ngram_range=(1, 2), max_features=15000)
    X = vec.fit_transform(texts)
    km = KMeans(n_clusters=k, random_state=0, n_init=5).fit(X)
    terms = vec.get_feature_names_out()
    out = []
    for ci in range(k):
        center = km.cluster_centers_[ci]
        top = [terms[t] for t in center.argsort()[::-1][:8]]
        size = int((km.labels_ == ci).sum())
        out.append({"label": ", ".join(top[:4]), "top_terms": top, "size": size})
    return sorted(out, key=lambda c: -c["size"])


def unmet_needs(df):
    out = []
    for name, pat in build_dataset._NEED_SIGNALS.items():
        rx = re.compile(pat, re.I)
        hits = df[df["text"].str.contains(rx)]
        out.append({"need": name, "evidence_count": int(len(hits)),
                    "problem_share": round(float(hits["is_problem"].mean()), 3)
                    if len(hits) else 0.0})
    return sorted(out, key=lambda d: -d["evidence_count"])


def emerging(df, recent="2026-01"):
    """Themes whose share rose in recent months vs before."""
    recent_df = df[df["year_month"] >= recent]
    older_df = df[(df["year_month"] != "") & (df["year_month"] < recent)]
    if len(recent_df) < 50 or len(older_df) < 50:
        return []
    out = []
    for cat in ["repetition_issue", "algorithm_mismatch", "discovery_issue"]:
        r = (recent_df["category"] == cat).mean()
        o = (older_df["category"] == cat).mean()
        out.append({"theme": cat, "recent_share": round(float(r), 3),
                    "prior_share": round(float(o), 3),
                    "delta": round(float(r - o), 3)})
    return sorted(out, key=lambda d: -d["delta"])


def theme_detection(df):
    problems = df[df["category"].isin(
        ["discovery_issue", "repetition_issue", "algorithm_mismatch"])]
    rec = df[df["category"] == "algorithm_mismatch"]
    return {
        "top_discovery_problems": _clusters(list(problems["text"]), k=6),
        "top_discovery_problem_terms": _top_terms(list(problems["text"])),
        "top_recommendation_complaints": _clusters(list(rec["text"]), k=5),
        "top_recommendation_complaint_terms": _top_terms(list(rec["text"])),
        "top_unmet_needs": unmet_needs(df),
        "emerging_themes": emerging(df),
    }
