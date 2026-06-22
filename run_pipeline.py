"""
Single-command pipeline.

  python run_pipeline.py                 # normalize existing raw -> build dataset
  python run_pipeline.py --collect       # also (re)scrape App Store + Play Store
                                         #  + re-ingest Reddit/forum source files

Reddit + forums always ingest from the provided Apify files. App Store / Play
Store re-scrape only with --collect (they take several minutes).

Outputs land in data/: cleaned_dataset.csv, summary_stats.json,
sample_quotes.json, theme_clusters.json, ingestion_log.json
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config  # noqa: E402


def main():
    collect = "--collect" in sys.argv
    ingest_stats = []

    from collect import reddit, forums
    print("== Ingest Reddit (Apify) ==");  ingest_stats.append(reddit.collect())
    print("== Ingest Forums (Apify) ==");  ingest_stats.append(forums.collect())

    if collect:
        from collect import app_store, play_store
        print("== Scrape App Store ==");   ingest_stats.append(app_store.collect())
        print("== Scrape Play Store ==");  ingest_stats.append(play_store.collect())
    else:
        print("(skipping App/Play scrape — pass --collect to refresh; using "
              "existing data/raw/*.csv)")

    print("\n== Normalize ==")
    import normalize
    norm_stats = normalize.normalize()

    print("\n== Dedupe + classify + build ==")
    import build_dataset
    summary = build_dataset.build()

    json.dump({"ingestion": ingest_stats, "normalization": norm_stats},
              open(config.LOG, "w"), indent=2)
    print(f"\nDone. Final dataset: {summary['final_total']} rows -> "
          f"{os.path.relpath(config.CLEANED)}")


if __name__ == "__main__":
    main()
