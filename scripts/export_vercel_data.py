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
         "evidence": int((df["layer"] == "discovery_specific").sum()), "quote": None},
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
    # one-line "key insight" per question, built from the SAME real numbers
    f1 = feat_rank[0] if feat_rank else {"feature": "n/a", "mentions": 0}
    f2 = feat_rank[1] if len(feat_rank) > 1 else f1
    af0 = affected[0] if affected else None
    d0 = desired_top[0] if desired_top else None
    d1 = desired_top[1] if len(desired_top) > 1 else None
    wk0 = list(wkr.items())[0] if wkr else ("n/a", 0)
    sh = needs.get("shuffle_repeats_small_pool")
    AI_PILOT_KEY = [
        f"Shuffle replaying a small pool ({sh}) is the single biggest discovery blocker.",
        f"Feature frustration peaks on {f1['feature']} ({f1['mentions']}) and {f2['feature']} ({f2['mentions']}).",
        f"Top goal: '{behaviors[0]['behavior']}' ({behaviors[0]['evidence']} reviews).",
        f"Even large libraries loop a small set — shuffle diversity is the core fix ({sh}).",
        (f"Most affected: {af0['cohort']} ({af0['repetition_rate']*100:.0f}% repetition); power users exceed casual."
         if af0 else "Not available"),
        f"Biggest gaps: {topneeds[0]['need'].replace('_',' ')} ({topneeds[0]['evidence_count']}) and lost dislike/reset controls.",
        f"{f1['feature']} ({f1['mentions']}) and {f2['feature']} ({f2['mentions']}) lead feature frustration.",
        (f"Users most want {d0['type']} ({d0['count']})" + (f", then {d1['type']} ({d1['count']})." if d1 else ".")
         if d0 else "Not available"),
        f"{ctx['mood_context_mentions']} reviews cite mood/context — discovery rarely adapts to it.",
        f"{ctx['control_wanted_mentions']} reviews explicitly ask for dislike / reset / 'not interested'.",
        f"{wk0[0]} ({wk0[1]}) is the top fallback when Spotify discovery fails.",
        f"Frustration ({emo.get('frustration',0)}) and fatigue ({emo.get('fatigue',0)}) dominate when recs repeat.",
    ]
    for i, item in enumerate(ai_pilot):
        item["id"] = f"q{i + 1}"                         # stable question id
        item["implication"] = AI_PILOT_IMPL[i] if i < len(AI_PILOT_IMPL) else ""
        item["key_insight"] = AI_PILOT_KEY[i] if i < len(AI_PILOT_KEY) else ""

    # ---- per-answer evidence: funnel + relevant multi-source quotes + reviews ----
    total = len(df)
    disc_spec = int((df["layer"] == "discovery_specific").sum())
    # (regex relevance check, theme label, extra funnel stages [(label,count)...])
    QEVID = {
        "q1": (r"discover|find new|new music|new artist|stuck|can.?t find|too narrow|same (boring|kind)",
               "Discovery friction",
               [("Discovery-issue reviews", ca.get("discovery_issue")),
                ("Recs-too-narrow signal", needs.get("recs_too_narrow_boxed_in"))]),
        "q2": (r"recommend|suggestion|algorithm|for you|irrelevant|not match|off.?taste|wrong song",
               "Recommendation mismatch",
               [("Algorithm-mismatch reviews", ca.get("algorithm_mismatch")),
                (f"{f1['feature']} mentions", f1["mentions"])]),
        "q3": (r"my (own )?playlist|let me (play|choose)|i just want|hear my|control|mood|songs i (chose|want)",
               "Listening-intent signals",
               [("Own-playlist intent", behaviors[0]["evidence"]),
                ("Freshness intent", behaviors[1]["evidence"])]),
        "q4": (r"same song|repeat|repetitive|shuffle|over and over|\bloop\b|same \d+ songs",
               "Repetition / shuffle",
               [("Repetition-issue reviews", ca.get("repetition_issue")),
                ("Shuffle-small-pool signal", needs.get("shuffle_repeats_small_pool"))]),
        "q5": (r"premium|for years|since 20|thousands|huge library|my library|power user|\d{3,}\s*songs",
               "Segment / power-user signals",
               [("Repetition-issue reviews", ca.get("repetition_issue")),
                (f"Most-affected: {af0['cohort'] if af0 else 'n/a'}",
                 af0["total"] if af0 else None)]),
        "q6": (r"shuffle|dislike|not interested|\breset\b|too narrow|ai (generated|music)|can.?t find new",
               "Unmet needs",
               [("Shuffle-small-pool need", needs.get("shuffle_repeats_small_pool")),
                ("Lost dislike/reset need", needs.get("lost_dislike_reset_control"))]),
        "q7": (r"discover weekly|release radar|daily mix|\bradio\b|smart shuffle|\bai dj\b|home (screen|feed)",
               "Feature frustration",
               [(f"{f1['feature']} mentions", f1["mentions"]),
                (f"{f2['feature']} mentions", f2["mentions"])]),
        "q8": (r"new songs?|new artist|new genre|niche|regional|deep ?cut|underground|indie",
               "Desired discovery types",
               [(f"{d0['type'] if d0 else 'New music'} mentions", d0["count"] if d0 else None)]),
        "q9": (r"\bmood\b|\bvibe\b|context|workout|study|sleep|driving|focus|relax|morning|night",
               "Mood / context",
               [("Mood/context mentions", ctx["mood_context_mentions"])]),
        "q10": (r"dislike|not interested|\breset\b|\btune\b|\bblock\b|more control|thumbs? down",
                "Control signals",
                [("Control-wanted mentions", ctx["control_wanted_mentions"])]),
        "q11": (r"youtube|tiktok|apple music|soundcloud|shazam|switch|alternative|instead of spotify",
                "Workarounds",
                [(f"{wk0[0]} mentions", wk0[1])]),
        "q12": (r"\bbored|boring|stale|monoton|fatigue|tired of|same old|lost interest|"
                r"disappoint|distrust|fed up|sick of",
                "Emotional reaction",
                [("Negative-emotion reviews", neg_emo)]),
    }

    def _review_row(r, theme, rx):
        ts = str(r.get("timestamp", "") or "")
        full = " ".join(str(r["text"]).split())
        m = rx.search(full)
        if m and len(full) > 300:                 # snippet around the matched keyword
            start = max(0, m.start() - 70)
            snippet = ("…" if start > 0 else "") + full[start:start + 280] + \
                      ("…" if start + 280 < len(full) else "")
        else:
            snippet = full[:300]
        return {"source": r["source"], "region": r.get("region", ""),
                "lang": r.get("lang", ""), "rating": str(r.get("rating", "") or ""),
                "date": ts[:10], "text": snippet, "matched_theme": theme}

    def _pick_reviews(rx, theme, k=10):
        sub = df[df["text"].str.contains(rx)]
        sub = sub[sub["text"].str.len() >= 30]
        # round-robin across sources for diversity (concise stores first), English first
        per_src = {}
        for src in ["app_store", "play_store", "reddit", "forums"]:
            s = sub[sub["source"] == src]
            s_en = s[s["lang"].astype(str).str.startswith("en")]
            per_src[src] = list(s_en.itertuples(index=False)) + \
                list(s[~s["lang"].astype(str).str.startswith("en")].itertuples(index=False))
        cols = list(sub.columns)
        out, seen = [], set()
        idx = 0
        while len(out) < k and any(per_src.values()):
            for src in ["app_store", "play_store", "reddit", "forums"]:
                lst = per_src[src]
                if idx < len(lst):
                    r = dict(zip(cols, lst[idx]))
                    key = " ".join(str(r["text"]).split())[:40].lower()
                    if key not in seen:
                        seen.add(key)
                        out.append(_review_row(r, theme, rx))
                        if len(out) >= k:
                            break
            idx += 1
            if idx > 4000:
                break
        return out

    # NOTE (tagging-quality bottleneck): per-answer "matching set" is defined by
    # category for q1/q2/q4/q5/q6 (frozen classifier counts) and by a keyword
    # regex elsewhere. Grounding %/avg-rating/top-region are computed over that
    # exact subset, so every number on the card traces to a real review group.
    def _match_sub(qid):
        if qid == "q1": return df[df["category"] == "discovery_issue"], "discovery-friction"
        if qid == "q2": return df[df["category"] == "algorithm_mismatch"], "recommendation-mismatch"
        if qid == "q4": return df[df["category"] == "repetition_issue"], "repetition"
        if qid == "q5": return df[df["layer"] == "discovery_specific"], "discovery-specific"
        if qid == "q6": return df[df["layer"] == "discovery_specific"], "discovery-specific"
        rx = re.compile(QEVID[qid][0], re.I)
        return df[df["text"].str.contains(rx)], QEVID[qid][1].lower()

    def _grounding(sub):
        n = len(sub)
        if n == 0:
            return {"n": 0}
        bs = sub["source"].value_counts(normalize=True)
        rt = pd.to_numeric(sub["rating"], errors="coerce").dropna()
        reg = sub["region"].replace("", pd.NA).dropna()
        return {"n": int(n),
                "by_source": {k: round(float(v), 3) for k, v in bs.items()},
                "avg_rating": round(float(rt.mean()), 1) if len(rt) else None,
                "top_region": (reg.value_counts().idxmax() if len(reg) else None)}

    sh = needs.get("shuffle_repeats_small_pool")
    PAIN = {
        "q1": ("recommendations feel too narrow", needs.get("recs_too_narrow_boxed_in")),
        "q2": (f"{f1['feature']} frustration", f1["mentions"]),
        "q3": ("wanting control over playback", ctx["control_wanted_mentions"]),
        "q4": ("shuffle replaying a small pool", sh),
        "q5": (f"repetition in {af0['cohort']}" if af0 else "repetition concentration",
               af0["total"] if af0 else ca.get("repetition_issue")),
        "q6": ("shuffle replaying a small pool", sh),
        "q7": (f"{f1['feature']} frustration", f1["mentions"]),
        "q8": (f"demand for {d0['type']}" if d0 else "demand for new music", d0["count"] if d0 else None),
        "q9": ("Spotify ignoring mood / context", ctx["mood_context_mentions"]),
        "q10": ("requests for dislike / reset controls", ctx["control_wanted_mentions"]),
        "q11": (f"switching to {wk0[0]}", wk0[1]),
        "q12": ("frustration", emotion["distribution"].get("frustration")),
    }
    SUBS = {
        "q1": [("recommendations too narrow", needs.get("recs_too_narrow_boxed_in")),
               ("can't find new music", needs.get("cant_find_new_music")),
               ("AI-generated flooding", needs.get("ai_generated_flooding"))],
        "q2": [(f1["feature"], f1["mentions"]), (f2["feature"], f2["mentions"]),
               ("recommendations too narrow", needs.get("recs_too_narrow_boxed_in"))],
        "q3": [(b["behavior"], b["evidence"]) for b in behaviors[:4]],
        "q4": [("shuffle repeats a small pool", sh),
               ("forced recs in playlist", needs.get("forced_recs_in_playlist")),
               ("recommendations too narrow", needs.get("recs_too_narrow_boxed_in"))],
        "q5": [(c["cohort"], c["total"]) for c in affected[:3]],
        "q6": [(n["need"].replace("_", " "), n["evidence_count"])
               for n in engine["theme_detection"]["top_unmet_needs"]],
        "q7": [(f["feature"], f["mentions"]) for f in feature_map if "mentions" in f][:4],
        "q8": [(d["type"], d["count"]) for d in desired_top],
        "q9": [("mood / context mentions", ctx["mood_context_mentions"])],
        "q10": [("control wanted", ctx["control_wanted_mentions"]),
                ("lost dislike/reset need", needs.get("lost_dislike_reset_control"))],
        "q11": [(k, v) for k, v in list(wkr.items())[:4]],
        "q12": [(k, v) for k, v in list(emotion["distribution"].items())[:5]],
    }
    THEMES = {
        "q1": ["Personalization gaps", "Narrow recommendations", "Discovery fatigue"],
        "q2": ["Off-taste recommendations", "Algorithm mismatch", "Weak personalization"],
        "q3": ["Playlist control", "Freshness seeking", "Mood-based listening"],
        "q4": ["Shuffle repetition", "Small playback pool", "Discovery fatigue"],
        "q5": ["Power-user repetition", "Regional gaps", "Segment differences"],
        "q6": ["Shuffle repetition", "Lost feedback controls", "AI-generated flooding"],
        "q7": ["Smart Shuffle", "Radio repetition", "Release Radar trust"],
        "q8": ["New songs", "Regional music", "Niche / deep cuts"],
        "q9": ["Mood / context", "Activity-based", "Contextual discovery"],
        "q10": ["Dislike / reset controls", "Negative feedback", "Taste tuning"],
        "q11": ["Cross-platform leakage", "YouTube fallback", "Manual search"],
        "q12": ["Frustration", "Fatigue", "Boredom / disappointment"],
    }
    SEGMENTS = {
        "q1": ["Users seeking new artists", "Adventurous listeners", "Power users"],
        "q2": ["Power users", "Premium users", "Genre-specific listeners"],
        "q3": ["Playlist-heavy users", "Power users", "Casual listeners"],
        "q4": ["Power users", "Users stuck in repeat loops", "Large-library users"],
        "q5": ["Power users", "Casual listeners", "Regional / multilingual users"],
        "q6": ["Power users", "Adventurous listeners", "Long-term users"],
        "q7": ["Free users", "Power users", "Playlist-heavy users"],
        "q8": ["Users seeking new artists", "Niche listeners", "Regional / multilingual users"],
        "q9": ["Mood-driven listeners", "Casual listeners", "Activity-based users"],
        "q10": ["Power users", "Long-term users", "Adventurous listeners"],
        "q11": ["Adventurous listeners", "Users seeking new artists", "Power users"],
        "q12": ["Power users", "Long-term users", "Users stuck in repeat loops"],
    }
    RECS = {
        "q1": ["Add a freshness / diversity control for users stuck in narrow recommendations.",
               "Surface more genuinely new artists across Home and discovery surfaces.",
               "Add a 'show me something different' action to break the comfort-zone loop."],
        "q2": ["Improve ranking relevance to reduce off-taste recommendations.",
               "Add 'tune my recommendations' so users can correct mismatches.",
               "Audit the highest-frustration features (Smart Shuffle, Radio)."],
        "q3": ["Keep user playlists clean — make injected recommendations opt-in.",
               "Add explicit mood / context inputs to shape each session.",
               "Give clearer playback controls so user intent is respected."],
        "q4": ["Widen Smart Shuffle candidate generation to break small-pool loops.",
               "Add a freshness / diversity slider for large libraries.",
               "Introduce reset / dislike tuning to escape stale loops."],
        "q5": ["Prioritize power users and high-repetition regions for diversity fixes.",
               "Localize discovery coverage for non-English markets.",
               "Tailor freshness defaults by segment."],
        "q6": ["Ship shuffle diversity to address the top unmet need.",
               "Restore dislike / reset / not-interested controls.",
               "Add authenticity filters against AI-generated flooding."],
        "q7": ["Audit Smart Shuffle and Radio — highest frustration share.",
               "Protect Release Radar from AI-generated dilution.",
               "Make feature behavior more transparent and controllable."],
        "q8": ["Bias discovery toward new songs first, then regional and niche.",
               "Add a niche / deep-cut discovery mode.",
               "Expand regional / non-English catalog surfacing."],
        "q9": ["Invest in context-aware discovery (mood / activity / time-of-day).",
               "Add quick mood / context pickers to start sessions.",
               "Adapt recommendations to short-term listening intent."],
        "q10": ["Add stronger negative-feedback controls (dislike / not-interested).",
                "Provide a taste-reset / tune flow.",
                "Make feedback visibly change future recommendations."],
        "q11": ["Close the discovery gap driving users to YouTube / Apple Music.",
                "Match competitor discovery surfaces for surfacing new music.",
                "Reduce friction in finding genuinely new tracks."],
        "q12": ["Reduce repetition to protect satisfaction and retention.",
                "Add freshness controls to relieve fatigue and boredom.",
                "Rebuild trust with transparent, tunable recommendations."],
    }

    # Executive summaries cite ONLY the matching-set count (consistent with the
    # funnel) + qualitative pain — no stray sub-need numbers that conflict.
    f1f, f2f, wk0n = f1["feature"], f2["feature"], wk0[0]

    def _exec(qid, n):
        n = f"{n:,}"
        return {
            "q1": f"Across {n} reviews describing discovery friction, users say recommendations feel too "
                  f"narrow and that genuinely new music is hard to surface. They keep landing on familiar "
                  f"artists and previously discovered tracks.",
            "q2": f"Across {n} reviews, users describe recommendations as off-taste or irrelevant. "
                  f"Frustration concentrates on features like {f1f}, where suggestions don't reflect real listening.",
            "q3": f"Across {n} reviews about listening intent, users mainly want to play their own playlists "
                  f"without interference, find fresh music with little effort, and have more say over what plays.",
            "q4": f"Across {n} repetition reviews, the dominant cause is shuffle replaying a small pool of a "
                  f"large library, so the same songs loop. Forced recommendations inside user playlists make it worse.",
            "q5": f"Repetition is not uniform across {n} discovery-specific reviews. Power users and "
                  f"high-repetition regions feel it most, while casual listeners are comparatively less affected.",
            "q6": f"Across {n} discovery-specific reviews, the most consistent unmet needs are shuffle "
                  f"diversity, dislike/reset controls, and protection from AI-generated flooding.",
            "q7": f"Among {n} feature-mention reviews, {f1f} and {f2f} draw the most frustration, with users "
                  f"citing repetitive or off-target behavior.",
            "q8": f"Across {n} reviews about what users want to find, demand centers on new songs first, "
                  f"then regional music and niche / deep cuts.",
            "q9": f"Across {n} reviews referencing mood or context, many users feel Spotify ignores their "
                  f"current situation — workouts, study, sleep, commuting — when recommending music.",
            "q10": f"Across {n} reviews, users ask for stronger control: dislike, 'not interested', block, "
                   f"and the ability to reset or tune their taste profile.",
            "q11": f"When discovery falls short, users in {n} reviews say they turn to alternatives — most "
                   f"often {wk0n} — to find new music.",
            "q12": f"Across {n} reviews, repetitive or irrelevant recommendations most often trigger "
                   f"frustration and fatigue, with boredom and disappointment close behind.",
        }.get(qid)

    for item in ai_pilot:
        qid = item["id"]
        cfg = QEVID.get(qid)
        rx = re.compile(cfg[0], re.I)
        theme = cfg[1]
        reviews_ev = _pick_reviews(rx, theme, k=10)
        sub, match_label = _match_sub(qid)
        n_match = int(len(sub))
        grounding = _grounding(sub)
        pain_label, pain_count = PAIN.get(qid, (None, None))

        # reconciled funnel: frozen -> discovery-specific -> matching set -> pain
        funnel = [{"label": "Frozen analysis dataset", "count": total},
                  {"label": "Discovery-specific reviews", "count": disc_spec}]
        if n_match and n_match != disc_spec:
            funnel.append({"label": "Matching evidence reviews", "count": n_match})
        if pain_count is not None and int(pain_count) not in (n_match, disc_spec):
            funnel.append({"label": f"Specific pain point · {pain_label}", "count": int(pain_count)})

        # key insight cites the SAME pain number shown in the funnel
        if pain_count is not None:
            item["key_insight"] = (f"Within {n_match:,} {match_label} reviews, {pain_label} is the "
                                   f"strongest signal ({int(pain_count):,} reviews).")
        item["evidence"] = n_match or item.get("evidence")
        item["a"] = _exec(qid, n_match) or item["a"]   # consistent executive summary

        # quotes spanning distinct sources (relevance already enforced by rx)
        quotes, qsrc = [], set()
        for rv in reviews_ev:
            if rv["source"] not in qsrc:
                qsrc.add(rv["source"]); quotes.append(rv)
            if len(quotes) >= 3:
                break
        if len(quotes) < 2:
            quotes = reviews_ev[:2]

        item["funnel"] = funnel
        item["grounding"] = grounding
        item["quotes"] = quotes
        item["evidence_reviews"] = reviews_ev
        item["sub_needs"] = [{"label": l, "count": int(c)} for l, c in SUBS.get(qid, []) if c is not None]
        item["match_label"] = match_label
        item["themes"] = THEMES.get(qid, [])
        item["segments"] = SEGMENTS.get(qid, [])
        item["recommendations"] = RECS.get(qid, [])

    # ---- Overview extras: per-source year detail, #1 problem, recent reviews ----
    def _yr(ts):
        m = re.search(r"(\d{4})", str(ts))
        return m.group(1) if m else None
    df["_year"] = df["timestamp"].map(_yr)
    source_detail = []
    for src, lbl in [("play_store", "Play Store"), ("app_store", "App Store"),
                     ("reddit", "Reddit"), ("forums", "Spotify Community Forums")]:
        sub = df[df["source"] == src]
        byc = sub["_year"].dropna().value_counts().sort_index()
        source_detail.append({
            "source": src, "label": lbl, "count": int(len(sub)),
            "year_min": (str(byc.index.min()) if len(byc) else None),
            "year_max": (str(byc.index.max()) if len(byc) else None),
            "top_year": (str(byc.idxmax()) if len(byc) else None),
            "by_year": {str(k): int(v) for k, v in byc.items()}})

    def _sent_counts(sub):
        vc = sub["sentiment"].value_counts()
        return {k: int(vc.get(k, 0)) for k in ["frustrated", "neutral", "positive"]}

    prob = df[df["category"] == "discovery_issue"]   # largest problem category = #1 problem
    ins0 = (engine.get("insights") or [{}])[0]
    top_problem = {
        "title": "Discovery friction — users can't surface new music",
        "category": "discovery_issue",
        "count": int(len(prob)),
        "pct_total": round(len(prob) / total, 3),
        "sentiment": _sent_counts(prob),
        "frustration_pct": round(float((prob["sentiment"] == "frustrated").mean()), 3),
        "avg_friction": round(float(prob["friction"].mean()), 1),
        "top_region": (prob["region"].replace("", pd.NA).dropna().value_counts().idxmax()
                       if len(prob) else None),
        "severity": ins0.get("severity_score"),
        "quote": (ins0.get("representative_quotes") or [None])[0],
    }

    # free vs premium split per (negative) emotion — for the frustration column
    _paid_rx = re.compile(r"\bi.?m? (a )?premium\b|i pay for|paying for|my (premium|subscription)|"
                          r"i.?m? subscrib|family plan|duo plan|premium user|i have premium|"
                          r"been (a )?premium|currently premium", re.I)
    _free_rx = re.compile(r"free (user|version|tier|account|plan)|without (paying|premium)|"
                          r"don.?t pay|can.?t afford|too expensive|the ads are|too many ads|"
                          r"need premium to|to get premium|free users|on the free", re.I)
    _ipaid = df["text"].str.contains(_paid_rx)
    _ifree = df["text"].str.contains(_free_rx) & ~_ipaid
    emotion_tier = {}
    for _emo, _pat in EMOTIONS.items():
        if _emo == "excitement":
            continue
        _m = df["text"].str.contains(re.compile(_pat, re.I))
        emotion_tier[_emo] = {"free": int((_m & _ifree).sum()), "paid": int((_m & _ipaid).sum())}

    FRUST = {"frustrated": "High", "neutral": "Medium", "positive": "Low"}
    dd = df[df["timestamp"].astype(str).str.match(r"\d{4}-\d{2}-\d{2}")].sort_values(
        "timestamp", ascending=False)
    recent_reviews, seen_r = [], set()
    for _, r in dd.iterrows():
        key = " ".join(str(r["text"]).split())[:34].lower()
        if key in seen_r or len(str(r["text"]).split()) < 6:
            continue
        seen_r.add(key)
        recent_reviews.append({
            "source": r["source"], "region": r.get("region", ""),
            "rating": str(r.get("rating", "") or ""), "date": str(r["timestamp"])[:10],
            "sentiment": r["sentiment"], "category": r["category"],
            "frustration": FRUST.get(r["sentiment"], "Medium"),
            "text": " ".join(str(r["text"]).split())[:240]})
        if len(recent_reviews) >= 8:
            break

    return {
        "generated_from": "discovery_insights_dataset.csv (frozen v1) + engine_output.json",
        "source_detail": source_detail,
        "top_problem": top_problem,
        "recent_reviews": recent_reviews,
        "emotion_tier": emotion_tier,
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

    # Also emit the AI-Pilot answers into the app source so they are bundled at
    # build time (static import) — the page never depends on a runtime fetch.
    pilot_path = os.path.join(ROOT, "vercel-dashboard", "app", "pilot", "pilot_answers.json")
    if os.path.isdir(os.path.dirname(pilot_path)):
        json.dump(extra["ai_pilot"], open(pilot_path, "w"), indent=2, ensure_ascii=False)
        print(f"  wrote {os.path.relpath(pilot_path, ROOT)}  "
              f"({os.path.getsize(pilot_path) // 1024} KB)")

    for f in ["engine_output.json", "dashboard_summary.json", "reviews_sample.json",
              "analysis_extra.json"]:
        p = os.path.join(OUT_DIR, f)
        print(f"  wrote {os.path.relpath(p, ROOT)}  ({os.path.getsize(p)//1024} KB)")
    print(f"Sample rows: {len(sample_rows)} | full dataset: {total}")


if __name__ == "__main__":
    main()
