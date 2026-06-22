# AI-Powered Review Discovery Engine — Spec & Architecture

Transforms the **frozen** `discovery_insights_dataset.csv` (26,823 reviews:
19,620 discovery-specific + 7,203 adjacent) into a production-ready Review
Intelligence dashboard. **No data is collected, modified, or re-classified** —
the engine is a read-only analytics + insight layer over the v1 source of truth.

---

## 1. Dashboard architecture

```
                 FROZEN SOURCE OF TRUTH (read-only)
                 data/discovery_insights_dataset.csv
                              │
                     engine/loader.py   ── derives lang, region, year_month,
                              │             sentiment, user_type (in-memory only)
        ┌──────────┬─────────┼──────────┬───────────┬──────────┐
   analytics    themes    segments   insights     pulse    (6 modules)
        └──────────┴─────────┼──────────┴───────────┴──────────┘
                     engine/precompute.py
                              │ writes
                     data/engine_output.json   (cached metrics + insights)
                              │ reads
                     dashboard/app.py  (Streamlit · 7 screens)
```

- **Compute tier** (`engine/`): pure-Python + pandas + scikit-learn. Deterministic,
  no external API needed. Produces `engine_output.json`.
- **Serving tier** (`dashboard/app.py`): Streamlit reads the precomputed JSON for
  instant screens, and lazily loads the CSV for the Review Explorer.
- **Refresh**: `python3 engine/precompute.py` regenerates the JSON. The dataset
  never changes, so this is idempotent.
- **Deploy**: Streamlit Community Cloud / a container on Vercel/Render. The repo +
  `engine_output.json` + the CSV are all that's needed. (An optional Claude pass
  can later replace heuristic labels without changing this architecture.)

---

## 2. Data model

**Frozen columns (never modified):** `id, source, text, rating, timestamp,
country, category, layer, metadata`.

**Derived at load (`loader.py`, in-memory only):**

| Field | Definition |
|---|---|
| `lang` | `metadata.lang` (Play Store locale) else `en/unknown` |
| `region` | country → {North America, UK/Ireland, Europe, LATAM, MEA, South Asia, SE Asia, East Asia, ANZ, …}; Reddit/Forums → global |
| `year_month` | `YYYY-MM` parsed from `timestamp` (ISO, datetime, or epoch) |
| `sentiment` | `positive` / `neutral` / `frustrated` — `discovery_positive`→positive; else rating ≥4→positive, ≤2→frustrated, 3→neutral; missing rating→frustrated if problem category else neutral |
| `user_type` | `power_user` if text matches premium/large-library/tenure cues, else `casual_or_unknown` |
| `is_problem` | category ∈ {discovery_issue, repetition_issue, algorithm_mismatch} |

`category` (frozen) ∈ discovery_issue · repetition_issue · algorithm_mismatch ·
discovery_positive · general_music_experience.
`layer` ∈ discovery_specific · adjacent_signal.

---

## 3. Metrics definitions

| Metric | Definition |
|---|---|
| **Total reviews** | row count (26,823) |
| **Problem reviews / rate** | count & share where `is_problem` |
| **Sentiment distribution** | count & share of positive/neutral/frustrated |
| **Net sentiment** | (positive − frustrated) / total |
| **Trend (monthly)** | per `year_month` (≥20 rows): volume, problem_rate, repetition_rate, positive_rate |
| **Repetition rate (segment)** | share of a segment's reviews tagged `repetition_issue` |
| **Problem rate (segment)** | share tagged any problem category |
| **Evidence count (insight)** | reviews matching the insight's signal |
| **Negativity (insight)** | share of matching reviews with `frustrated` sentiment |
| **Reach (insight)** | distinct regions with ≥5 matching reviews |
| **Severity score** | `100 · (0.45·norm_frequency + 0.35·negativity + 0.20·reach)`, where `norm_frequency = log1p(evidence)/log1p(max_evidence)` → 0–100 |
| **Priority score (radar)** | `severity · log1p(evidence_count)` = Impact × Frequency |
| **Rec-system risk (pulse)** | share(algorithm_mismatch) + share(repetition_issue) in the period |

---

## 4. Insight generation workflow (Module 4)

1. Define signals: the 6 unmet-need regex patterns + 3 category-level themes.
2. For each signal, select matching reviews from the frozen df.
3. Compute evidence_count, negativity, reach; pick **affected_segment** (region
   with the highest concentration, annotated with power-user share).
4. Select **representative quotes** — prefer frustrated, English, mid-length,
   de-duplicated (3 per insight).
5. Compute **severity_score** (normalized across insights).
6. Sort by severity → PM-ready insight cards.

## 5. Priority-radar workflow (Module 5)

`priority_score = severity × log1p(evidence)`; classify into quadrants:
**Quick win / Now** (impact ≥60 & freq ≥300) · **Strategic bet** (impact ≥60) ·
**Monitor** (freq ≥300) · **Backlog**. Plotted Impact (y) × Frequency (x).

## 6. Theme-extraction workflow (Module 2)

- **Discovery problems / rec complaints**: TF-IDF (1–2 grams) → KMeans clusters
  over the relevant category subset → top terms + cluster sizes.
- **Unmet needs**: regex signal patterns → evidence counts (ranked).
- **Emerging themes**: category share in recent months (≥2026-01) vs prior →
  positive delta = rising.

## 7. Segment-analysis workflow (Module 3)

Cross-tab category rates by `source` (platform), `region`, `lang`, `user_type`
(min cohort size 25). "Most affected" = cohorts (region ∪ language, n≥40) ranked
by repetition_rate.

## 8. Weekly-pulse workflow (Module 6)

Latest complete month vs prior month (review timestamps are daily/monthly, so
"pulse" = period-over-period): volume Δ, problem-rate Δ, **rising issues**
(category share Δ), **notable discoveries** (recent positive quotes),
**rec-system risk** trend.

---

## 9. Streamlit dashboard specification

`streamlit run dashboard/app.py` — sidebar nav, 7 screens, reads
`engine_output.json` (+ CSV for explorer). Cached via `@st.cache_data`.

### Screens & components

| # | Screen | Components |
|---|---|---|
| 1 | **Overview / Review Analytics** | 8 KPI metric cards; category bar; sentiment bar; monthly trend line (problem/repetition/positive rate); volume bar |
| 2 | **Theme Detection** | discovery-problem cluster table; rec-complaint cluster table; emerging-themes table; unmet-needs bar + table |
| 3 | **Segmentation** | platform/region/language/user-type rate tables; most-affected bar + table |
| 4 | **Insights** | bordered insight cards: title, severity & evidence metrics, affected segment, negativity, 3 quotes w/ provenance |
| 5 | **Priority Radar** | Impact×Frequency scatter colored by quadrant, sized by priority; ranked table |
| 6 | **Weekly Pulse** | period KPI cards (volume/problem-rate/rec-risk); rising-issues table; notable-discovery quotes |
| 7 | **Review Explorer** | filters (category/source/region/sentiment + text search); paged data table (read-only) |

### Vercel/container note
Streamlit needs a long-running server (not Vercel serverless). Deploy on
Streamlit Community Cloud, Render, Fly, or a container; for a Vercel-native
build, expose `engine_output.json` via a small API route and render with a
Next.js front end using the same data model and screen list above.

---

## 10. Files

```
engine/loader.py        derive fields (read-only)
engine/analytics.py     Module 1 — analytics, sentiment, trend
engine/themes.py        Module 2 — theme detection
engine/segments.py      Module 3 — segmentation
engine/insights.py      Module 4+5 — insights + priority radar
engine/pulse.py         Module 6 — weekly pulse
engine/precompute.py    orchestrator -> data/engine_output.json
dashboard/app.py        Streamlit dashboard (7 screens)
data/engine_output.json precomputed metrics + insights (dashboard input)
```

Run: `pip3 install -r requirements.txt && python3 engine/precompute.py &&
streamlit run dashboard/app.py`
