"""
Step 3 — Deduplication.

  exact_dedup : drop byte-identical text (after whitespace/case normalization).
  near_dedup  : drop near-duplicates using TF-IDF cosine similarity > threshold
                (config.NEAR_DUP_THRESHOLD, default 0.92).

Scalability note: near_dedup is O(n^2) in the worst case, so the pipeline runs
it AFTER the keyword relevance gate (a few-thousand rows), where it's cheap and
where duplicate templated reviews actually cluster. Exact dedup runs globally.
"""
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors


def _norm(t):
    return re.sub(r"\s+", " ", str(t).lower()).strip()


def exact_dedup(rows):
    seen, out, dropped = set(), [], 0
    for r in rows:
        key = _norm(r["text"])
        if key in seen:
            dropped += 1
            continue
        seen.add(key)
        out.append(r)
    return out, dropped


def near_dedup(rows, threshold=0.92):
    """Greedy: keep a row unless it's >threshold similar to an already-kept row."""
    if len(rows) < 2:
        return rows, 0
    texts = [r["text"] for r in rows]
    vec = TfidfVectorizer(min_df=1, ngram_range=(1, 2), max_features=40000)
    X = vec.fit_transform(texts)
    # nearest neighbours by cosine distance; check a handful per row
    k = min(6, len(rows))
    nn = NearestNeighbors(n_neighbors=k, metric="cosine").fit(X)
    dist, idx = nn.kneighbors(X)
    keep = [True] * len(rows)
    for i in range(len(rows)):
        if not keep[i]:
            continue
        for d, j in zip(dist[i], idx[i]):
            if j == i:
                continue
            sim = 1.0 - d
            if sim >= threshold and j > i:
                keep[j] = False        # drop the later of any near-dup pair
    out = [r for i, r in enumerate(rows) if keep[i]]
    return out, len(rows) - len(out)
