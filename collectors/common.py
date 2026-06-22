"""
Shared helpers used by every collector.

Plain-language summary:
  - KEYWORDS is the relevance filter. A review is "relevant" if its text
    mentions at least one of these words/phrases.
  - keyword_hit() does that check.
  - The collectors all output rows with the SAME columns so they can be
    stacked into one table later:
        source, country, date, rating, title, text, review_id
"""

import re

# The discovery/recommendation keyword filter (from the project spec).
KEYWORDS = [
    "recommendation", "recommendations", "discover", "discovery", "algorithm",
    "repetitive", "repeat", "same songs", "same music", "boring", "stale",
    "predictable", "new music", "discover weekly", "release radar", "taste",
    "playlist", "familiar artists",
]

# Pre-compile one regex that matches any keyword as a whole word/phrase.
_KW_RE = re.compile(
    r"(?<!\w)(" + "|".join(re.escape(k) for k in KEYWORDS) + r")(?!\w)",
    re.IGNORECASE,
)


def keyword_hit(text: str):
    """Return the list of matched keywords (empty list = not relevant)."""
    if not text:
        return []
    found = {m.group(1).lower() for m in _KW_RE.finditer(text)}
    return sorted(found)


def is_relevant(text: str) -> bool:
    return len(keyword_hit(text)) > 0
