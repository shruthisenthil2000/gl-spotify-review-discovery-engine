# Spotify Music-Discovery Review Intelligence Pipeline

A modular, reproducible pipeline that ingests Spotify reviews/discussions from
multiple sources, filters them to **music-discovery** topics, de-duplicates,
classifies, and outputs a clean analytics dataset + theme clusters + insights.

## Architecture

```
collect/                  Step 1 — modular ingestion (one file per source)
  app_store.py            Apple RSS, many country storefronts
  play_store.py           Google Play, deep newest-first pagination
  reddit.py               ingests provided Apify scrape (+ optional live PRAW)
  forums.py               ingests provided Spotify community Apify scrape
normalize.py              Step 2 — unify to {id,source,text,rating,timestamp,country,metadata}
dedupe.py                 Step 3 — exact + near-dup (TF-IDF cosine > 0.92)
classify.py               Step 4 — relevance gate + category (heuristic / Claude)
build_dataset.py          Step 5 — final dataset, summary, samples, theme clusters
run_pipeline.py           single-command orchestrator
config.py                 keywords, thresholds, paths, source files
```

## Run

```bash
pip3 install -r requirements.txt

# Full build from existing raw + the provided Reddit/forum files:
python3 run_pipeline.py

# Also re-scrape App Store + Play Store (several minutes):
python3 run_pipeline.py --collect
```

Optional, for higher-accuracy category labels and an LLM relevance second-pass:
```bash
export ANTHROPIC_API_KEY=sk-ant-...        # classify.py upgrades to Claude
export CLAUDE_MODEL=claude-sonnet-4-6      # optional, ~3x cheaper for bulk
```
Optional, to top up Reddit beyond the provided scrape:
```bash
export REDDIT_CLIENT_ID=... REDDIT_CLIENT_SECRET=...
```

## Schema

`data/cleaned_dataset.csv`:
`id, source, text, rating, timestamp, country, category, metadata`

`category ∈ {discovery_issue, discovery_positive, repetition_issue, algorithm_mismatch, other}`

## Outputs (`data/`)

| File | Contents |
|------|----------|
| `cleaned_dataset.csv` | Final cleaned, deduped, relevant reviews |
| `summary_stats.json` | Counts per source + category, full pipeline log |
| `sample_quotes.json` | ~50 representative reviews, balanced by category |
| `theme_clusters.json` | KMeans clusters: top terms + example quotes |
| `ingestion_log.json` | Per-source ingestion stats + logged limitations |

## Relevance rule

A review is kept only if it mentions a discovery/recommendation keyword
(`discover weekly`, `release radar`, `recommendation`, `algorithm`,
`new music`, `repetitive`, `shuffle`, `same songs`, `taste`, ...). Pure
login / billing / device / unrelated-UI reviews are discarded.

## Honest limitations (logged, not hidden)

- **App Store** exposes only ~500 most-recent reviews per country store; ~7%
  pass the discovery filter. Not multi-year history.
- **Play Store** `country` returns one global English set, so volume comes from
  pagination depth (newest-first); ~5% pass the filter.
- **Reddit** = the 1,131-row provided Apify scrape (live PRAW optional, needs a
  key). Forums = 204 provided rows.
- **Instagram / TikTok / Trustpilot / YouTube** are not collected — no public,
  ToS-compliant bulk access was available; skipped and logged per requirements.
- The **12,000–15,000 relevant-after-filtering** target is not reachable from
  these public sources without padding. The pipeline maximizes *real* relevant
  volume and reports the true count; it never fabricates rows.
```
