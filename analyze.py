"""
ANALYSIS STEP — use Claude to tag each cleaned review with structured insight.

Plain-language summary:
  This reads data/cleaned.csv and sends the reviews to Claude in small
  batches (25 at a time, for accuracy). For every review Claude returns:
    theme, sentiment, behavior_goal, segment_signal, quote
  Results are written to data/results.csv with the original text alongside.

SETUP (one-time):
  pip3 install anthropic
  export ANTHROPIC_API_KEY=sk-ant-...        # your Claude API key
Run:
  python3 analyze.py
Output:
  data/results.csv

Cost note: the default model is claude-opus-4-8. For ~2,000 reviews this is
a few dollars. To cut cost ~3x for this high-volume classification job, set
  export CLAUDE_MODEL=claude-sonnet-4-6
"""

import csv
import json
import os
import sys
import time

import anthropic

HERE = os.path.dirname(__file__)
IN = os.path.join(HERE, "data", "cleaned.csv")
OUT = os.path.join(HERE, "data", "results.csv")
MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-4-8")
BATCH = 25

THEMES = [
    "hard_to_discover_new_music", "repetitive_recommendations",
    "algorithm_too_narrow", "loves_discovery_feature",
    "ui_navigation_issue", "pricing", "unrelated_other",
]

SYSTEM = (
    "You are a product research analyst on Spotify's Growth team studying why "
    "users struggle to discover new music and over-rely on repeat listening. "
    "You will receive a numbered batch of user reviews. For EACH review, return "
    "one structured object. Be precise and base every field only on the review text."
)

# One object per review; guaranteed-parseable via output_config json_schema.
SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "index": {"type": "integer"},
                    "theme": {"type": "string", "enum": THEMES},
                    "sentiment": {"type": "string",
                                  "enum": ["frustrated", "neutral", "positive"]},
                    "behavior_goal": {"type": "string"},
                    "segment_signal": {"type": "string"},
                    "quote": {"type": "string"},
                },
                "required": ["index", "theme", "sentiment",
                             "behavior_goal", "segment_signal", "quote"],
            },
        }
    },
    "required": ["results"],
}


def build_prompt(rows):
    lines = ["Here is a batch of reviews. Return one object per review, "
             "using the matching `index`.\n"]
    for i, r in enumerate(rows):
        text = r["text"].replace("\n", " ").strip()
        lines.append(f"[{i}] (rating={r.get('rating','?')}) {text}")
    lines.append(
        "\nFor each: theme (closest match from the allowed set), sentiment, "
        "behavior_goal (short phrase: what listening behavior the user wants), "
        "segment_signal (user-type clue, or 'unclear'), and quote (the single "
        "most representative sentence, copied verbatim from the review).")
    return "\n".join(lines)


def analyze_batch(client, rows):
    resp = client.messages.create(
        model=MODEL,
        max_tokens=8000,
        system=SYSTEM,
        messages=[{"role": "user", "content": build_prompt(rows)}],
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
    )
    text = next(b.text for b in resp.content if b.type == "text")
    return json.loads(text)["results"]


def main():
    if not os.path.exists(IN):
        sys.exit("data/cleaned.csv not found — run clean.py first.")
    rows = list(csv.DictReader(open(IN, encoding="utf-8")))
    print(f"Analyzing {len(rows)} reviews with {MODEL} in batches of {BATCH}...")

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from environment
    cols = ["source", "date", "rating", "theme", "sentiment",
            "behavior_goal", "segment_signal", "quote", "original_text"]
    out = open(OUT, "w", newline="", encoding="utf-8")
    w = csv.DictWriter(out, fieldnames=cols)
    w.writeheader()

    done = 0
    for start in range(0, len(rows), BATCH):
        batch = rows[start:start + BATCH]
        for attempt in range(3):
            try:
                tagged = analyze_batch(client, batch)
                break
            except anthropic.RateLimitError:
                wait = 10 * (attempt + 1)
                print(f"  rate limited; waiting {wait}s...")
                time.sleep(wait)
            except Exception as ex:
                print(f"  batch error ({ex}); retrying...")
                time.sleep(5)
        else:
            print(f"  batch {start} failed after retries — skipping.")
            continue

        by_index = {t["index"]: t for t in tagged}
        for i, r in enumerate(batch):
            t = by_index.get(i, {})
            w.writerow({
                "source": r.get("source", ""),
                "date": r.get("date", ""),
                "rating": r.get("rating", ""),
                "theme": t.get("theme", ""),
                "sentiment": t.get("sentiment", ""),
                "behavior_goal": t.get("behavior_goal", ""),
                "segment_signal": t.get("segment_signal", ""),
                "quote": t.get("quote", ""),
                "original_text": r.get("text", ""),
            })
        done += len(batch)
        print(f"  tagged {done}/{len(rows)}")
        out.flush()

    out.close()
    print(f"\nSaved -> {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
