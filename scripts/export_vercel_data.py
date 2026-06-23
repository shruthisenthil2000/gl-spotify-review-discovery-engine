"""
Export lightweight, frozen JSON for the Vercel/Next.js dashboard.

READ-ONLY. Does not modify the dataset, engine logic, or the Streamlit app.
Reuses engine.loader (read-only) to derive the same lang/region/sentiment/
user_type fields the Streamlit dashboard uses, so the two stay consistent.

Inputs (frozen):
  data/discovery_insights_dataset.csv
  data/engine_output.json
Outputs (vercel-dashboard/public/data/):
  engine_output.json        (copy of the precomputed metrics)
  dashboard_summary.json    (REAL counts from the full 26,823-row dataset)
  reviews_sample.json       (balanced sample for the Review Explorer)

Run:  python3 scripts/export_vercel_data.py
"""
import json
import os
import re
import shutil
import sys
import warnings
from collections import Counter

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import config            # noqa: E402
from engine import loader  # noqa: E402  (read-only field derivation)

OUT_DIR = os.path.join(ROOT, "vercel-dashboard", "public", "data")
SAMPLE_SIZE = 1800
TEXT_MAX = 320


def counts(series):
    return {str(k): int(v) for k, v in series.value_counts().items()}


# ===================== derived heuristic analyses (transparent) =====================
PROBLEM_CATS = {"discovery_issue", "repetition_issue", "algorithm_mismatch"}

# Per-review Discovery Friction Score (0-100). Transparent: category base +
# sentiment adjustment, clipped. NOT ML.
CAT_FRICTION = {"repetition_issue": 0.90, "algorithm_mismatch": 0.85,
                "discovery_issue": 0.65, "general_music_experience": 0.30,
                "discovery_positive": 0.10}
SENT_ADJ = {"frustrated": 0.10, "neutral": 0.0, "positive": -0.15}

FEATURES = {
    "Discover Weekly": r"discover(y)? weekly",
    "Release Radar": r"release radar",
    "Daily Mix": r"daily mix",
    "Radio": r"\bradio\b|song radio|artist radio",
    "Smart Shuffle": r"smart shuffle",
    "AI DJ": r"\bai dj\b|\bdj x\b|\bthe dj\b|\bdj mode\b",
    "Home": r"home screen|home feed|home page|home tab",
}
EMOTIONS = {
    "boredom": r"\bbore(d|dom|ing)?\b|monoton|so dull|gets old|repetitive and boring",
    "frustration": r"frustrat|annoy|fed up|sick of|infuriat|so irritating|drives me",
    "distrust": r"\btrust\b|fake|manipulat|agenda|ai (generated|slop)|scam|shady|payola",
    "fatigue": r"\btired\b|exhaust|fatigue|drained|over and over|again and again|worn out",
    "disappointment": r"disappoint|let down|letdown|underwhelm|expected better|used to be (good|better)|not what it",
    "excitement": r"\blove\b|amazing|excit|obsess|best app|fantastic|brilliant|nailed it",
}
JOURNEY_IMPL = {
    "Input": "Spotify mis-reads taste/mood at intake — invest in explicit taste & context capture.",
    "Recommendation": "Recommendations feel repetitive/irrelevant — diversify candidate generation & ranking.",
    "Exploration": "Users can't reach fresh music — add a dedicated freshness/discovery mode.",
    "Feedback": "Users can't correct the algorithm — ship stronger negative-feedback & reset controls.",
    "Retention": "Users fall back to old playlists — re-engage with trustworthy, low-effort discovery.",
    "Unmapped": "No clear journey-stage signal in the text.",
}
CTRL_RX = re.compile(r"dislike|don.?t like|not interested|\bblock\b|\breset\b|"
                     r"tune (my )?recommend|hide (song|artist)|more control|"
                     r"thumbs? down|exclude.*taste", re.I)
RETENTION_RX = re.compile(r"old playlist|go back to|return to|same playlist|"
                          r"my own playlist|familiar|stick to|fall back", re.I)
MOODCTX_RX = re.compile(r"\bmood\b|\bvibe\b|context|situation|workout|gym|study|"
                        r"sleep|party|driving|focus|relax|morning|night", re.I)
FRESH_RX = re.compile(r"find new|new music|new artist|fresh|discover (new|more)|"
                      r"something different|out of my", re.I)
WORKAROUNDS = {
    "TikTok": r"tiktok|tik tok", "YouTube": r"youtube|yt music",
    "SoundCloud": r"soundcloud", "Apple Music": r"apple music",
    "Shazam": r"shazam", "Reddit": r"\breddit\b",
    "Manual search": r"manual(ly)? search|search myself|search for songs",
}
NICHE_RX = re.compile(r"niche|underground|indie|obscure|deep cut|b-side|"
                      r"specific genre|local artist|regional|unsigned", re.I)


def _quote(sub, prefer="frustrated"):
    cand = sub[(sub["text"].str.len() >= 60) & (sub["text"].str.len() <= 240)]
    pref = cand[cand["sentiment"] == prefer]
    pool = pref if len(pref) else cand
    pool = pool[pool["lang"].astype(str).str.startswith("en")]
    if not len(pool):
        pool = cand
    if not len(pool):
        return None
    r = pool.iloc[0]
    return {"text": " ".join(str(r["text"]).split())[:240], "source": r["source"],
            "region": r["region"], "rating": str(r["rating"])}


def _seg_metrics(sub, heuristic=True):
    tot = int(len(sub))
    if tot == 0:
        return None
    prob = sub[sub["category"].isin(PROBLEM_CATS)]
    top_pain = (prob["category"].value_counts().idxmax().replace("_", " ")
                if len(prob) else "n/a")
    return {
        "total": tot, "heuristic": heuristic,
        "repetition_rate": round(float((sub["category"] == "repetition_issue").mean()), 3),
        "problem_rate": round(float(sub["category"].isin(PROBLEM_CATS).mean()), 3),
        "top_pain_point": top_pain,
        "quote": _quote(sub),
    }


def build_extra(df, engine):
    import pandas as pd
    needs = {n["need"]: n["evidence_count"]
             for n in engine["theme_detection"]["top_unmet_needs"]}
    seg = engine["segmentation"]
    most_affected = (seg["most_affected_by_repetition"][0]["cohort"]
                     if seg.get("most_affected_by_repetition") else "Not available")

    # --- Friction score ---
    df = df.copy()
    df["friction"] = (df["category"].map(CAT_FRICTION).fillna(0.3)
                      + df["sentiment"].map(SENT_ADJ).fillna(0.0)).clip(0, 1) * 100
    buckets = pd.cut(df["friction"], [0, 20, 40, 60, 80, 100],
                     labels=["0-20", "20-40", "40-60", "60-80", "80-100"],
                     include_lowest=True)
    friction = {
        "average": round(float(df["friction"].mean()), 1),
        "distribution": {str(k): int(v) for k, v in buckets.value_counts().sort_index().items()},
        "by_category": {c: round(float(df[df["category"] == c]["friction"].mean()), 1)
                        for c in CAT_FRICTION if (df["category"] == c).any()},
        "explanation": "Heuristic score from category base (repetition/algorithm = "
                       "high, discovery_issue = medium-high, positive = low) adjusted "
                       "by sentiment. Not ML.",
    }
    friction["top_high_friction_themes"] = sorted(
        [{"theme": c.replace("_", " "), "avg_friction": v,
          "count": int((df["category"] == c).sum())}
         for c, v in friction["by_category"].items() if c in PROBLEM_CATS],
        key=lambda d: -d["avg_friction"])

    # --- Journey stage ---
    def stage(row):
        t = row["text"]
        if CTRL_RX.search(t):
            return "Feedback"
        if RETENTION_RX.search(t):
            return "Retention"
        if MOODCTX_RX.search(t) and row["category"] in ("algorithm_mismatch", "discovery_issue"):
            return "Input"
        if row["category"] in ("repetition_issue", "algorithm_mismatch"):
            return "Recommendation"
        if row["category"] == "discovery_issue" or FRESH_RX.search(t):
            return "Exploration"
        return "Unmapped"
    df["stage"] = df.apply(stage, axis=1)
    stage_avg = df.groupby("stage")["friction"].mean()
    painful = stage_avg[stage_avg.index != "Unmapped"]
    journey = {
        "heuristic": True,
        "distribution": {str(k): int(v) for k, v in df["stage"].value_counts().items()},
        "avg_friction_by_stage": {str(k): round(float(v), 1) for k, v in stage_avg.items()},
        "most_painful_stage": (painful.idxmax() if len(painful) else "Not available"),
        "implications": JOURNEY_IMPL,
    }

    # --- Emotion (multi-label keyword heuristic) ---
    emotions = {}
    emo_quotes = {}
    for emo, pat in EMOTIONS.items():
        rx = re.compile(pat, re.I)
        sub = df[df["text"].str.contains(rx)]
        emotions[emo] = int(len(sub))
        prefer = "positive" if emo == "excitement" else "frustrated"
        q = _quote(sub, prefer)
        if q:
            emo_quotes[emo] = q
    emotion = {"heuristic": True,
               "distribution": dict(sorted(emotions.items(), key=lambda kv: -kv[1])),
               "quotes": emo_quotes,
               "explanation": "Keyword-based heuristic over review text; a review may "
                              "match multiple emotions. Labels are indicative, not per-review ground truth."}

    # --- Feature Frustration Map ---
    feature_map = []
    for feat, pat in FEATURES.items():
        rx = re.compile(pat, re.I)
        sub = df[df["text"].str.contains(rx)]
        n = int(len(sub))
        if n < 5:
            feature_map.append({"feature": feat, "evidence": "Not enough evidence",
                                "mentions": n})
            continue
        frustrated = int(sub["category"].isin(PROBLEM_CATS).sum()
                         + (sub["sentiment"] == "frustrated").sum())
        feature_map.append({
            "feature": feat, "mentions": n,
            "frustration_rate": round(float(sub["category"].isin(PROBLEM_CATS).mean()), 3),
            "quote": _quote(sub)})
    feature_map.sort(key=lambda d: -(d.get("mentions") or 0))

    # --- Context / control / workarounds (Q9, Q10, Q11) ---
    ctx = {
        "mood_context_mentions": int(df["text"].str.contains(MOODCTX_RX).sum()),
        "control_wanted_mentions": int(df["text"].str.contains(CTRL_RX).sum()),
        "workarounds": {k: int(df["text"].str.contains(re.compile(p, re.I)).sum())
                        for k, p in WORKAROUNDS.items()},
    }
    ctx["workarounds"] = dict(sorted(ctx["workarounds"].items(), key=lambda kv: -kv[1]))

    # --- Segment cards (real where available, else heuristic keyword subsets) ---
    pu = df[df["user_type"] == "power_user"]
    casual = df[df["user_type"] == "casual_or_unknown"]
    playlist_heavy = df[df["text"].str.contains(r"playlist", case=False, na=False)
                        & df["text"].str.contains(r"\d{2,}\s*songs|playlists|my playlist|hundreds|thousands", case=False, na=False)]
    niche = df[df["text"].str.contains(NICHE_RX)]
    multilingual = df[~df["lang"].astype(str).str.startswith("en")]
    longterm = df[df["text"].str.contains(r"since 20|for years|years now|long.?time|decade|been using", case=False, na=False)]
    seg_impl = {
        "Power users": "Largest libraries hit repetition hardest — prioritize shuffle diversity & freshness for them.",
        "Casual listeners": "Lean on lightweight, trustworthy discovery surfaces (Home, DJ).",
        "Playlist-heavy users": "Protect user playlists from intrusive recs; add per-playlist discovery.",
        "Niche listeners": "Build a niche/deep-cut discovery mode beyond mainstream candidates.",
        "Regional / multilingual users": "Localized discovery coverage; non-English markets show higher repetition.",
        "Long-term users": "Combat taste-staleness with periodic taste-refresh nudges.",
    }
    segment_cards = []
    for name, sub in [("Power users", pu), ("Casual listeners", casual),
                      ("Playlist-heavy users", playlist_heavy), ("Niche listeners", niche),
                      ("Regional / multilingual users", multilingual),
                      ("Long-term users", longterm)]:
        m = _seg_metrics(sub)
        if m:
            m["segment"] = name
            m["product_implication"] = seg_impl[name]
            segment_cards.append(m)

    # --- Root cause -> product opportunity (evidence-backed only) ---
    cat_counts = engine["review_analytics"]
    root_cause = [
        {"theme": "Repetitive recommendations", "root_cause": "Algorithm overuses familiar listening history",
         "opportunity": "Add discovery freshness control", "evidence": cat_counts.get("repetition_issue")},
        {"theme": "Irrelevant recommendations", "root_cause": "Weak feedback loop",
         "opportunity": "Add 'tune my recommendations'", "evidence": cat_counts.get("algorithm_mismatch")},
        {"theme": "Shuffle repeats small pool", "root_cause": "Playback candidate pool too narrow",
         "opportunity": "Improve shuffle diversity", "evidence": needs.get("shuffle_repeats_small_pool")},
        {"theme": "Lost dislike/reset controls", "root_cause": "Users cannot correct taste profile",
         "opportunity": "Stronger negative-feedback controls", "evidence": needs.get("lost_dislike_reset_control")},
        {"theme": "AI-generated flooding", "root_cause": "Release Radar trust erosion",
         "opportunity": "Authenticity / creator filter", "evidence": needs.get("ai_generated_flooding")},
    ]

    # --- What should Spotify build (evidence-backed) ---
    opportunities = [
        {"name": "Freshness slider", "user_pain": "Recs feel repetitive / familiar-heavy",
         "evidence": cat_counts.get("repetition_issue"), "segment": most_affected,
         "why": "Lets users dial how far recommendations stray from known taste."},
        {"name": "Stronger negative-feedback system", "user_pain": "Can't tell Spotify 'not this'",
         "evidence": needs.get("lost_dislike_reset_control"), "segment": "Power users",
         "why": "Restores the dislike/hide signals users repeatedly ask for."},
        {"name": "Taste reset / tune recommendations", "user_pain": "Taste profile feels stuck/wrong",
         "evidence": needs.get("lost_dislike_reset_control"), "segment": "Long-term users",
         "why": "A reset/tune flow corrects a drifted or polluted profile."},
        {"name": "Discovery mode for niche / regional music", "user_pain": "Only mainstream surfaces",
         "evidence": int(len(niche) + len(multilingual[multilingual["category"].isin(PROBLEM_CATS)])),
         "segment": "Niche / multilingual", "why": "Coverage for deep cuts and non-English markets."},
        {"name": "Context-aware discovery mode", "user_pain": "Spotify ignores mood/context",
         "evidence": ctx["mood_context_mentions"], "segment": "Casual listeners",
         "why": "Surfaces music matched to mood, activity, and time of day."},
        {"name": "Shuffle diversity control", "user_pain": "Shuffle loops a small pool",
         "evidence": needs.get("shuffle_repeats_small_pool"), "segment": most_affected,
         "why": "Widens the playback pool so large libraries feel fresh."},
        {"name": "AI discovery coach", "user_pain": "No guided way to break the loop",
         "evidence": cat_counts.get("discovery_issue"), "segment": "All segments",
         "why": "Conversational guidance toward genuinely new music."},
    ]

    # --- Free vs Paid split (heuristic from review text signals) ---
    paid_rx = re.compile(r"\bi.?m? (a )?premium\b|i pay for|paying for|my (premium|subscription)|"
                         r"i.?m? subscrib|family plan|duo plan|premium user|i have premium|"
                         r"been (a )?premium|currently premium", re.I)
    free_rx = re.compile(r"free (user|version|tier|account|plan)|without (paying|premium)|"
                         r"don.?t pay|can.?t afford|too expensive|the ads are|too many ads|"
                         r"need premium to|to get premium|free users|on the free", re.I)
    is_paid = df["text"].str.contains(paid_rx)
    is_free = df["text"].str.contains(free_rx) & ~is_paid
    paid_n, free_n = int(is_paid.sum()), int(is_free.sum())
    unknown_n = int(len(df) - paid_n - free_n)
    free_paid = {
        "heuristic": True,
        "label": "Heuristic split based on review signals (premium/paid vs free/ads cues)",
        "paid": paid_n, "free": free_n, "unknown": unknown_n,
        "paid_share": round(paid_n / len(df), 3), "free_share": round(free_n / len(df), 3),
    }

    # --- Desired discovery types (keyword evidence; else 'Not enough evidence') ---
    DESIRED = {
        "New artists": r"new artist|discover artist|find (new )?artist|other artists",
        "New songs": r"new songs?|new music|new tracks?|fresh songs",
        "New genres": r"new genre|different genre|other genres|explore genre|new styles",
        "Niche music": r"niche|underground|indie|obscure|unsigned|small artist",
        "Regional music": r"regional|local artist|local music|my country|my language|desi|k-?pop|latin",
        "Deeper cuts": r"deep ?cut|deeper cut|album track|lesser known|hidden gem|b-?side|under.?rated",
    }
    desired = []
    for name, pat in DESIRED.items():
        n = int(df["text"].str.contains(re.compile(pat, re.I)).sum())
        desired.append({"type": name, "evidence": n if n >= 15 else "Not enough evidence",
                        "count": n})
    desired.sort(key=lambda d: -d["count"])

    # --- Listening behaviors users are trying to achieve ---
    own_rx = r"my (own )?playlist|my own (music|songs)|songs i (chose|added|want|like)|let me (play|choose)|play what i"
    behaviors = [
        {"behavior": "Hear their own playlist/songs without interference",
         "evidence": int(df["text"].str.contains(re.compile(own_rx, re.I)).sum())},
        {"behavior": "Find fresh / new music effortlessly",
         "evidence": int(df["text"].str.contains(FRESH_RX).sum())},
        {"behavior": "Match music to mood / context / activity",
         "evidence": int(df["text"].str.contains(MOODCTX_RX).sum())},
        {"behavior": "Control / correct what gets recommended",
         "evidence": int(df["text"].str.contains(CTRL_RX).sum())},
        {"behavior": "Replay familiar favorites (comfort listening)",
         "evidence": int(df["text"].str.contains(RETENTION_RX).sum())},
    ]
    behaviors.sort(key=lambda d: -d["evidence"])

    # --- AI Pilot: 12 evidence-backed Q&A (numbers are REAL; text summarizes them) ---
    ca = cat_counts
    feat_rank = sorted([f for f in feature_map if "frustration_rate" in f],
                       key=lambda f: -(f["mentions"] * f.get("frustration_rate", 0)))
    topfeat = ", ".join(f"{f['feature']} ({f['mentions']})" for f in feat_rank[:3])
    topneeds = engine["theme_detection"]["top_unmet_needs"][:3]
    topneeds_s = "; ".join(f"{n['need'].replace('_',' ')} ({n['evidence_count']})" for n in topneeds)
    affected = seg.get("most_affected_by_repetition", [])[:3]
    affected_s = "; ".join(f"{c['cohort']} ({c['repetition_rate']*100:.0f}% repetition)" for c in affected)
    wkr = ctx["workarounds"]
    wkr_s = ", ".join(f"{k} ({v})" for k, v in list(wkr.items())[:4])
    emo = emotion["distribution"]
    neg_emo = sum(emo.get(k, 0) for k in ["frustration", "fatigue", "boredom", "disappointment", "distrust"])
    desired_top = [d for d in desired if isinstance(d["evidence"], int)][:4]
    desired_s = ", ".join(f"{d['type']} ({d['count']})" for d in desired_top) or "Not enough evidence"
    ins = engine.get("insights", [])
    q1_quote = ins[0]["representative_quotes"][0] if ins and ins[0]["representative_quotes"] else None

    ai_pilot = [
        {"q": "Why do users struggle to discover new music?",
         "a": f"{ca.get('discovery_issue')} reviews describe discovery friction. The biggest "
              f"blockers are recommendations that feel too narrow and trouble surfacing fresh "
              f"music (top unmet needs: {topneeds_s}).",
         "evidence": ca.get("discovery_issue"), "quote": q1_quote},
        {"q": "What are the most common frustrations with recommendations?",
         "a": f"{ca.get('algorithm_mismatch')} reviews flag off-taste/irrelevant recommendations. "
              f"The most frustration-heavy features are {topfeat}.",
         "evidence": ca.get("algorithm_mismatch"), "quote": None},
        {"q": "What listening behaviors are users trying to achieve?",
         "a": "Top goals by evidence: " + "; ".join(f"{b['behavior']} ({b['evidence']})" for b in behaviors[:3]) + ".",
         "evidence": behaviors[0]["evidence"], "quote": None},
        {"q": "What causes users to repeatedly listen to the same content?",
         "a": f"{ca.get('repetition_issue')} repetition reviews. The dominant driver is shuffle "
              f"replaying a small pool of a large library "
              f"({needs.get('shuffle_repeats_small_pool')} reviews).",
         "evidence": ca.get("repetition_issue"),
         "quote": (ins[1]["representative_quotes"][0] if len(ins) > 1 and ins[1]["representative_quotes"] else None)},
        {"q": "Which user segments experience different discovery challenges?",
         "a": f"Most repetition-affected cohorts: {affected_s}. Power users show higher repetition "
              f"than casual listeners.",
         "evidence": None, "quote": None},
        {"q": "What unmet needs emerge consistently across reviews?",
         "a": f"Consistently: {topneeds_s} — plus lost dislike/reset controls and AI-generated flooding.",
         "evidence": topneeds[0]["evidence_count"] if topneeds else None, "quote": None},
        {"q": "Which Spotify discovery features frustrate users the most?",
         "a": f"By mention × frustration: {topfeat}.",
         "evidence": feat_rank[0]["mentions"] if feat_rank else None,
         "quote": (feat_rank[0].get("quote") if feat_rank else None)},
        {"q": "What kind of new music do users want to find?",
         "a": f"Desired discovery types (by evidence): {desired_s}.",
         "evidence": desired_top[0]["count"] if desired_top else None, "quote": None},
        {"q": "Does Spotify understand users' mood and current listening context?",
         "a": f"{ctx['mood_context_mentions']} reviews reference mood, context, or activity "
              f"(workout, study, sleep, driving…). Many feel discovery ignores it.",
         "evidence": ctx["mood_context_mentions"], "quote": None},
        {"q": "Do users want more control over their recommendations?",
         "a": f"{ctx['control_wanted_mentions']} reviews ask for stronger controls: dislike, "
              f"'not interested', block, or reset taste profile.",
         "evidence": ctx["control_wanted_mentions"], "quote": None},
        {"q": "Where do users go when Spotify discovery fails?",
         "a": f"Named alternatives/workarounds: {wkr_s}.",
         "evidence": sum(list(wkr.values())[:4]), "quote": None},
        {"q": "How do users feel when recommendations become repetitive or irrelevant?",
         "a": f"Dominant negative emotions: frustration ({emo.get('frustration',0)}), "
              f"fatigue ({emo.get('fatigue',0)}), disappointment ({emo.get('disappointment',0)}), "
              f"boredom ({emo.get('boredom',0)}).",
         "evidence": neg_emo,
         "quote": emotion["quotes"].get("frustration")},
    ]

    AI_PILOT_IMPL = [
        "Prioritize a freshness/discovery mode and broaden candidate generation beyond familiar history.",
        "Strengthen ranking relevance and add a 'tune my recommendations' control.",
        "Respect user intent — keep user playlists clean and make freshness opt-in, not forced.",
        "Fix shuffle diversity so large libraries don't loop a small pool.",
        "Target power users and the highest-repetition regions first.",
        "Ship shuffle diversity, dislike/reset controls, and authenticity filters.",
        "Audit the highest-frustration features (Radio, Smart Shuffle, Release Radar).",
        "Bias discovery toward new songs first, then regional and niche coverage.",
        "Invest in context-aware discovery (mood / activity / time-of-day).",
        "Add stronger negative-feedback and taste-reset controls.",
        "Discovery leakage to YouTube/Apple Music is a retention risk — close the gap.",
        "Repetition drives frustration/fatigue — reducing it protects satisfaction and retention.",
    ]
    for i, item in enumerate(ai_pilot):
        item["implication"] = AI_PILOT_IMPL[i] if i < len(AI_PILOT_IMPL) else ""

    return {
        "generated_from": "discovery_insights_dataset.csv (frozen v1) + engine_output.json",
        "friction": friction,
        "journey": journey,
        "emotion": emotion,
        "feature_frustration_map": feature_map,
        "context_signals": ctx,
        "segment_cards": segment_cards,
        "root_cause_table": root_cause,
        "opportunities": opportunities,
        "top5_insights": engine.get("insights", [])[:5],
        "free_paid": free_paid,
        "desired_discovery_types": desired,
        "listening_behaviors": behaviors,
        "ai_pilot": ai_pilot,
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    df = loader.load()
    engine_path = os.path.join(config.DATA, "engine_output.json")
    engine = json.load(open(engine_path))

    # 1) copy engine_output.json verbatim
    shutil.copyfile(engine_path, os.path.join(OUT_DIR, "engine_output.json"))

    # 2) dashboard_summary.json — REAL counts from the FULL dataset
    total = len(df)
    summary = {
        "generated_from": "discovery_insights_dataset.csv (frozen v1)",
        "totals": {
            "total_reviews": total,
            "discovery_specific": int((df["layer"] == "discovery_specific").sum()),
            "adjacent_signal": int((df["layer"] == "adjacent_signal").sum()),
            "problem_reviews": int(df["is_problem"].sum()),
            "problem_rate": round(float(df["is_problem"].mean()), 3),
        },
        "by_category": counts(df["category"]),
        "by_source": counts(df["source"]),
        "by_layer": counts(df["layer"]),
        "by_sentiment": counts(df["sentiment"]),
        "by_user_type": counts(df["user_type"]),
        "by_region": counts(df["region"]),
        "by_language": counts(df["lang"]),
        # echo engine-computed blocks the frontend reuses directly
        "sentiment_distribution": engine.get("review_analytics") and engine["sentiment_distribution"],
        "review_analytics": engine["review_analytics"],
        "trend": engine["trend"],
    }
    json.dump(summary, open(os.path.join(OUT_DIR, "dashboard_summary.json"), "w"),
              indent=2, ensure_ascii=False)

    # 3) reviews_sample.json — balanced sample (real total preserved separately)
    sample_rows = []
    cats = list(df["category"].unique())
    per_cat = max(1, SAMPLE_SIZE // len(cats))
    for cat in cats:
        sub = df[df["category"] == cat]
        take = sub.sample(min(per_cat, len(sub)), random_state=7)
        for _, r in take.iterrows():
            sample_rows.append({
                "id": r["id"], "source": r["source"], "country": r["country"],
                "lang": r["lang"], "region": r["region"], "category": r["category"],
                "layer": r["layer"], "sentiment": r["sentiment"],
                "rating": r["rating"], "text": " ".join(str(r["text"]).split())[:TEXT_MAX],
            })
    reviews = {
        "note": "Balanced sample for the Review Explorer. Aggregate counts in "
                "dashboard_summary.json reflect the FULL dataset, not this sample.",
        "full_total": total,
        "sample_size": len(sample_rows),
        "filters": {
            "categories": sorted(df["category"].unique().tolist()),
            "sources": sorted(df["source"].unique().tolist()),
            "regions": sorted(df["region"].unique().tolist()),
            "sentiments": sorted(df["sentiment"].unique().tolist()),
        },
        "rows": sample_rows,
    }
    json.dump(reviews, open(os.path.join(OUT_DIR, "reviews_sample.json"), "w"),
              indent=2, ensure_ascii=False)

    # 4) analysis_extra.json — derived heuristic analyses (friction, journey,
    #    emotion, feature map, segments, opportunities). All from frozen data.
    extra = build_extra(df, engine)
    json.dump(extra, open(os.path.join(OUT_DIR, "analysis_extra.json"), "w"),
              indent=2, ensure_ascii=False)

    for f in ["engine_output.json", "dashboard_summary.json", "reviews_sample.json",
              "analysis_extra.json"]:
        p = os.path.join(OUT_DIR, f)
        print(f"  wrote {os.path.relpath(p, ROOT)}  ({os.path.getsize(p)//1024} KB)")
    print(f"Sample rows: {len(sample_rows)} | full dataset: {total}")


if __name__ == "__main__":
    main()
