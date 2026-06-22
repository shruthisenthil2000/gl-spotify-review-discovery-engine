"""
Spotify Review Discovery Engine — Streamlit dashboard.

Reads the precomputed data/engine_output.json (run engine/precompute.py first)
and the frozen discovery_insights_dataset.csv (read-only, for the explorer).

Run:  streamlit run dashboard/app.py
"""
import json
import os
import sys
import warnings

import pandas as pd
import streamlit as st

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import config  # noqa: E402

st.set_page_config(page_title="Review Discovery Engine", layout="wide",
                   page_icon="🎧")


@st.cache_data
def load_engine():
    path = os.path.join(config.DATA, "engine_output.json")
    if not os.path.exists(path):
        from engine import precompute
        return precompute.run()
    return json.load(open(path))


@st.cache_data
def load_df():
    from engine import loader
    return loader.load()


E = load_engine()
st.sidebar.title("🎧 Review Discovery Engine")
st.sidebar.caption("Frozen v1 · 26,823 reviews · discovery + adjacent")
screen = st.sidebar.radio("Screen", [
    "1 · Overview", "2 · Theme Detection", "3 · Segmentation",
    "4 · Insights", "5 · Priority Radar", "6 · Weekly Pulse",
    "7 · Review Explorer"])
st.sidebar.markdown("---")
st.sidebar.caption("Source of truth: discovery_insights_dataset.csv (read-only)")


# ---------------- 1 · OVERVIEW ----------------
if screen.startswith("1"):
    st.header("Review Analytics")
    a = E["review_analytics"]
    c = st.columns(5)
    c[0].metric("Total reviews", f"{a['total_reviews']:,}")
    c[1].metric("Discovery issue", f"{a['discovery_issue']:,}")
    c[2].metric("Repetition issue", f"{a['repetition_issue']:,}")
    c[3].metric("Algorithm mismatch", f"{a['algorithm_mismatch']:,}")
    c[4].metric("Discovery positive", f"{a['discovery_positive']:,}")
    c = st.columns(3)
    c[0].metric("Problem reviews", f"{a['problem_reviews']:,}",
                f"{a['problem_rate']:.0%} of all")
    sd = E["sentiment_distribution"]
    c[1].metric("Net sentiment", f"{sd['net_sentiment']:+.2f}")
    c[2].metric("Discovery-specific", f"{a['discovery_specific']:,}",
                f"+{a['adjacent_signal']:,} adjacent")

    left, right = st.columns(2)
    with left:
        st.subheader("Category mix")
        cats = {k: a[k] for k in ["discovery_issue", "repetition_issue",
                "algorithm_mismatch", "discovery_positive",
                "general_music_experience"]}
        st.bar_chart(pd.Series(cats).sort_values(ascending=False))
    with right:
        st.subheader("Sentiment distribution")
        st.bar_chart(pd.Series(sd["counts"]))

    st.subheader("Trend tracking (monthly)")
    tr = pd.DataFrame(E["trend"]).set_index("month")
    st.line_chart(tr[["problem_rate", "repetition_rate", "positive_rate"]])
    st.caption("Volume per month")
    st.bar_chart(tr["reviews"])


# ---------------- 2 · THEME DETECTION ----------------
elif screen.startswith("2"):
    st.header("Theme Detection")
    td = E["theme_detection"]
    st.subheader("Top discovery problems (clusters)")
    st.dataframe(pd.DataFrame(td["top_discovery_problems"])[["size", "label", "top_terms"]],
                 use_container_width=True)
    col = st.columns(2)
    with col[0]:
        st.subheader("Top recommendation complaints")
        st.dataframe(pd.DataFrame(td["top_recommendation_complaints"])[["size", "label"]],
                     use_container_width=True)
    with col[1]:
        st.subheader("Emerging themes (recent vs prior share)")
        st.dataframe(pd.DataFrame(td["emerging_themes"]), use_container_width=True)
    st.subheader("Top unmet needs (evidence count)")
    un = pd.DataFrame(td["top_unmet_needs"]).set_index("need")
    st.bar_chart(un["evidence_count"])
    st.dataframe(un, use_container_width=True)


# ---------------- 3 · SEGMENTATION ----------------
elif screen.startswith("3"):
    st.header("User Segmentation")
    sg = E["segmentation"]

    def seg_table(d):
        return pd.DataFrame(d).T[["total", "repetition_rate", "discovery_issue_rate",
                                  "algorithm_mismatch_rate", "problem_rate",
                                  "positive_rate"]]
    st.subheader("By platform")
    st.dataframe(seg_table(sg["by_platform"]), use_container_width=True)
    c = st.columns(2)
    with c[0]:
        st.subheader("By region")
        st.dataframe(seg_table(sg["by_region"]), use_container_width=True)
    with c[1]:
        st.subheader("By language")
        st.dataframe(seg_table(sg["by_language"]), use_container_width=True)
    st.subheader("By user type")
    st.dataframe(seg_table(sg["by_user_type"]), use_container_width=True)
    st.subheader("Most affected by repetition (min vol 40)")
    ma = pd.DataFrame(sg["most_affected_by_repetition"]).set_index("cohort")
    st.bar_chart(ma["repetition_rate"])
    st.dataframe(ma[["total", "repetition_rate", "problem_rate"]], use_container_width=True)


# ---------------- 4 · INSIGHTS ----------------
elif screen.startswith("4"):
    st.header("PM-Ready Insights")
    st.caption("severity = 0.45·frequency + 0.35·negativity + 0.20·reach (0–100)")
    for ins in E["insights"]:
        with st.container(border=True):
            top = st.columns([5, 1, 1])
            top[0].markdown(f"### {ins['title']}")
            top[1].metric("Severity", ins["severity_score"])
            top[2].metric("Evidence", f"{ins['evidence_count']:,}")
            st.markdown(f"**Affected segment:** {ins['affected_segment']}  ·  "
                        f"**Category:** `{ins['category']}`  ·  "
                        f"**Negativity:** {ins['negativity']:.0%}")
            for q in ins["representative_quotes"]:
                st.markdown(f"> _{q['text']}_  \n"
                            f"<small>— {q['source']} · {q['region']} · ★{q['rating']}</small>",
                            unsafe_allow_html=True)


# ---------------- 5 · PRIORITY RADAR ----------------
elif screen.startswith("5"):
    st.header("PM Priority Radar  ·  Impact × Frequency")
    radar = pd.DataFrame(E["priority_radar"])
    st.scatter_chart(radar, x="frequency", y="impact", color="quadrant",
                     size="priority_score")
    st.caption("Top-right = high impact & high frequency = act now.")
    st.dataframe(radar.set_index("opportunity"), use_container_width=True)


# ---------------- 6 · WEEKLY PULSE ----------------
elif screen.startswith("6"):
    st.header("Weekly Pulse")
    wp = E["weekly_pulse"]
    if "note" in wp:
        st.info(wp["note"])
    else:
        st.caption(f"Latest period **{wp['current_period']}** vs **{wp['prior_period']}** "
                   "(monthly granularity — review timestamps are daily/monthly).")
        kt = wp["key_trends"]
        c = st.columns(4)
        c[0].metric("Review volume", f"{kt['review_volume']:,}", kt["volume_delta_vs_prev"])
        c[1].metric("Problem rate", f"{kt['problem_rate']:.0%}",
                    f"{(kt['problem_rate']-kt['problem_rate_prev'])*100:+.1f} pts")
        rr = wp["recommendation_system_risk"]
        c[2].metric("Rec-system risk", f"{rr['current']:.0%}", rr["direction"])
        c[3].metric("Prior risk", f"{rr['prior']:.0%}")
        st.subheader("Rising issues (share Δ vs prior period)")
        st.dataframe(pd.DataFrame(wp["rising_issues"]), use_container_width=True)
        st.subheader("Notable discoveries (positive signal)")
        for n in wp["notable_discoveries"]:
            st.markdown(f"> _{n['text']}_ — {n['region']}")


# ---------------- 7 · REVIEW EXPLORER ----------------
elif screen.startswith("7"):
    st.header("Review Explorer")
    df = load_df()
    c = st.columns(4)
    cat = c[0].multiselect("Category", sorted(df["category"].unique()))
    src = c[1].multiselect("Source", sorted(df["source"].unique()))
    reg = c[2].multiselect("Region", sorted(df["region"].unique()))
    sen = c[3].multiselect("Sentiment", sorted(df["sentiment"].unique()))
    q = st.text_input("Search text contains")
    f = df
    if cat: f = f[f["category"].isin(cat)]
    if src: f = f[f["source"].isin(src)]
    if reg: f = f[f["region"].isin(reg)]
    if sen: f = f[f["sentiment"].isin(sen)]
    if q:   f = f[f["text"].str.contains(q, case=False, na=False)]
    st.caption(f"{len(f):,} of {len(df):,} reviews")
    st.dataframe(f[["source", "country", "lang", "category", "layer",
                    "sentiment", "rating", "text"]].head(500),
                 use_container_width=True, height=520)
