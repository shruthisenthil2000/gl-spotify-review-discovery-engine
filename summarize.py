"""
SUMMARY STEP — turn data/results.csv into headline numbers.

Plain-language summary:
  Reads the tagged results and prints:
    - count of reviews per theme (ranked)
    - count per sentiment
    - the top 10 most common representative quotes per theme
  Also writes data/summary.txt with the same content.

Run:    python3 summarize.py
"""

import csv
import os
from collections import Counter, defaultdict

HERE = os.path.dirname(__file__)
IN = os.path.join(HERE, "data", "results.csv")
OUT = os.path.join(HERE, "data", "summary.txt")


def main():
    if not os.path.exists(IN):
        print("data/results.csv not found — run analyze.py first.")
        return
    rows = list(csv.DictReader(open(IN, encoding="utf-8")))
    themes = Counter(r["theme"] for r in rows if r["theme"])
    sentiments = Counter(r["sentiment"] for r in rows if r["sentiment"])
    quotes_by_theme = defaultdict(Counter)
    for r in rows:
        if r["theme"] and r["quote"]:
            quotes_by_theme[r["theme"]][r["quote"].strip()] += 1

    lines = [f"TOTAL tagged reviews: {len(rows)}", "", "REVIEWS PER THEME:"]
    for theme, n in themes.most_common():
        lines.append(f"  {n:>5}  {theme}")
    lines += ["", "REVIEWS PER SENTIMENT:"]
    for s, n in sentiments.most_common():
        lines.append(f"  {n:>5}  {s}")
    lines += ["", "TOP 10 QUOTES PER THEME:"]
    for theme, _ in themes.most_common():
        lines.append(f"\n  [{theme}]")
        for q, n in quotes_by_theme[theme].most_common(10):
            lines.append(f"    ({n}x) {q}")

    text = "\n".join(lines)
    print(text)
    open(OUT, "w", encoding="utf-8").write(text)
    print(f"\nSaved -> {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
