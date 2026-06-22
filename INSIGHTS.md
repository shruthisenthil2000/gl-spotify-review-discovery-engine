# Music Discovery vs. Repetition — Insights Summary

**Dataset:** 3,549 cleaned, de-duplicated, discovery-relevant reviews
(App Store, Play Store, Reddit, Spotify Community forum).
**Method:** keyword + heuristic relevance gate, TF-IDF near-dedup, category
labels + KMeans theme clustering. (Upgrade to the Claude classifier with an API
key for higher-precision category labels.)

## Headline

Among users who talk about discovery at all, **~71% express a problem**
(discovery friction, repetition, or bad recommendations) vs. **~29% delight**.
The single most actionable cluster for the strategic goal — *reduce repetitive
listening* — is large and unusually specific.

| Category | Count | Share |
|---|---:|---:|
| discovery_issue (can't find / control discovery) | 1,677 | 47% |
| discovery_positive (recs delight them) | 1,033 | 29% |
| repetition_issue (same songs / shuffle loops) | 749 | 21% |
| algorithm_mismatch (recs off-taste) | 90 | 3% |

By source: Play Store 2,457 · App Store 545 · Reddit 405 · Forums 142.

## Top themes (from clustering + reading)

1. **Shuffle loops a tiny slice of the library — the #1 repetition driver.**
   Users with large libraries hear the same 5–40 songs on repeat.
   > "My Playlist of over 400 songs gets the same 5-10 repeated over and OVER in a shuffle."
   This is the clearest evidence that repeat-listening is partly *engineered by
   shuffle defaults*, not pure user preference.

2. **Recommendations feel inescapably narrow — "stuck in a box."**
   > "it keeps recommending the same boring music, no matter how much I skip them. really forces me in a box, no chance to discover new styles or artists."

3. **Loss of negative-feedback controls blocks self-correction.**
   Users repeatedly cite the removed "don't like / hide song / reset taste"
   controls — they *want* to steer discovery but can't.
   > "please give us don't like option back and reset option so you at least have a chance to change…"
   > "I always select 'I don't like this artist'… however it doesn't seem to have any effect…"

4. **Discover Weekly / Release Radar quality erosion + AI-generated flooding.**
   A distinct forum/Reddit cluster: Release Radar is seen as diluted by
   AI-generated tracks, lowering trust in the flagship discovery surface.

5. **Paywalled control collides with discovery.** Forced shuffle + injected
   "recommended" songs into user playlists on free tier reads as *anti-discovery*
   (it overrides intent rather than expanding taste).

6. **When discovery works, it's a top delight.** 29% praise it specifically —
   > "I've never been more impressed… an App that features my taste in music so well."
   The system is a love-it-or-hate-it surface, not a neutral one.

## Strategic read for the "increase discovery / reduce repetition" goal

- The repetition problem users report is **mechanical** (shuffle drawing from a
  small candidate pool; recommendations converging) more than preferential.
  Fixing shuffle breadth and re-introducing lightweight negative feedback
  ("not this", "reset") targets the exact complaints driving repeat listening.
- **Negative-feedback controls are the highest-leverage, lowest-cost lever:**
  users are explicitly asking for the steering tools that would let the system
  diversify *with their consent* — addressing repetition and the "stuck in a box"
  feeling simultaneously.
- **Protect the flagship discovery surfaces** (Discover Weekly, Release Radar)
  from AI-generated dilution; trust erosion there undercuts the whole strategy.

## Honest limitations

- 12–15k *relevant* rows is not attainable from these public sources after
  semantic filtering (only ~8% of raw app-store reviews are discovery-relevant).
  Final relevant volume is 3,549; every funnel step is logged in
  `summary_stats.json` / `ingestion_log.json`. No rows were fabricated.
- Category labels here use a transparent keyword heuristic; expect ~10–15% of
  `discovery_issue`/`discovery_positive` to be borderline. Running the Claude
  classifier (`ANTHROPIC_API_KEY`) sharpens precision and reclassifies edge cases.
- Instagram/TikTok/Trustpilot/YouTube were not collected (no compliant bulk
  access); they remain as future collector modules.
