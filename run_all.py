"""
ONE-COMMAND PIPELINE — runs every step in order.

Plain-language summary, top to bottom:
  1. Collect App Store reviews          -> data/raw_appstore.csv
  2. Collect Play Store reviews         -> data/raw_playstore.csv
  3. Collect Reddit posts  (needs key)  -> data/raw_reddit.csv     [skipped if no key]
  4. Collect Spotify forum threads      -> data/raw_forums.csv     [best-effort]
  5. Clean + filter + combine           -> data/cleaned.csv
  6. Tag each review with Claude (key)  -> data/results.csv
  7. Summarize                          -> data/summary.txt

Run everything:        python3 run_all.py
Run just collection:   python3 run_all.py --collect-only
Skip collection:       python3 run_all.py --analyze-only
"""

import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def run(label, script):
    print(f"\n{'='*60}\n{label}\n{'='*60}")
    code = subprocess.call([sys.executable, os.path.join(HERE, script)])
    if code != 0:
        print(f"(step '{label}' exited with code {code} — continuing)")


def main():
    args = set(sys.argv[1:])
    collect = "--analyze-only" not in args
    analyze = "--collect-only" not in args

    if collect:
        run("1/7  App Store", "collectors/appstore.py")
        run("2/7  Play Store", "collectors/playstore.py")
        if os.environ.get("REDDIT_CLIENT_ID"):
            run("3/7  Reddit", "collectors/reddit.py")
        else:
            print("\n3/7  Reddit — SKIPPED (set REDDIT_CLIENT_ID / "
                  "REDDIT_CLIENT_SECRET to include it)")
        run("4/7  Spotify forum (best-effort)", "collectors/forums.py")

    run("5/7  Clean + filter + combine", "clean.py")

    if analyze:
        if os.environ.get("ANTHROPIC_API_KEY"):
            run("6/7  Analyze with Claude", "analyze.py")
            run("7/7  Summarize", "summarize.py")
        else:
            print("\n6/7  Analyze — SKIPPED (set ANTHROPIC_API_KEY to run "
                  "the Claude tagging step)")


if __name__ == "__main__":
    main()
