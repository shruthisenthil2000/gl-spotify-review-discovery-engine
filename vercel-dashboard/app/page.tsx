"use client";
import { useState } from "react";
import { getSummary, getExtra, PROJECT, num, pct, NA } from "@/lib/data";
import { Card, Donut, Histogram, Tag, useJSON } from "./components/ui";

const CAT_LABEL: Record<string, string> = {
  discovery_issue: "Discovery issue", repetition_issue: "Repetition issue",
  algorithm_mismatch: "Algorithm mismatch", discovery_positive: "Discovery positive",
  general_music_experience: "General / adjacent signal",
};
const SRC_LABEL: Record<string, string> = {
  play_store: "Play Store", app_store: "App Store", reddit: "Reddit", forums: "Spotify Community",
};
const SRC_COLOR: Record<string, string> = {
  play_store: "#1db954", app_store: "#4a90e6", reddit: "#e6b34a", forums: "#b18cf2",
};
const SRC_EMOJI: Record<string, string> = { play_store: "🤖", app_store: "🍎", reddit: "👽", forums: "💬" };
const CAT_COLOR: Record<string, string> = {
  "Discovery issue": "#e6b34a", "Repetition issue": "#e64a4a",
  "Algorithm mismatch": "#b18cf2", "Discovery positive": "#1db954",
  "General / adjacent signal": "#5a5a5a",
};
const RATE_COLOR = ["#e64a4a", "#e6843a", "#e6b34a", "#8bc34a", "#1db954"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const kfmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
const stars = (r: string) => { const n = Math.max(0, Math.min(5, parseInt(r) || 0)); return "★".repeat(n) + "☆".repeat(5 - n); };

const EMO_DESC: Record<string, string> = {
  frustration: "Exasperated when recommendations ignore their taste and the same songs keep returning.",
  fatigue: "Worn down by hearing the same rotation over and over, with little variety.",
  boredom: "The experience feels stale and predictable — nothing new to explore.",
  disappointment: "Expectations of strong discovery aren’t met, especially among long-time users.",
  distrust: "Suspect the algorithm pushes AI-generated or agenda-driven content over real artists.",
};
const FRUST = { High: { c: "red", e: "🔥" }, Medium: { c: "amber", e: "⚡" }, Low: { c: "green", e: "🙂" } } as Record<string, { c: string; e: string }>;
const SENT_EMOJI: Record<string, string> = { frustrated: "😠", neutral: "😐", positive: "😊" };
const PLAN: [string, string, string][] = [
  ["free", "Free", "🆓"], ["premium_individual", "Premium Individual", "💎"],
  ["premium_student", "Premium Student", "🎓"], ["premium_duo", "Premium Duo", "👥"],
  ["premium_family", "Premium Family", "👨‍👩‍👧"],
];
// horizontal tabs mirror the left sidebar (Discovery IQ workspace)
const TABS: [string, string][] = [
  ["/", "Overview"], ["/lens", "Analytics"], ["/themes", "Theme Intelligence"],
  ["/priority", "PM Priority Radar"], ["/pilot", "Discovery Copilot"],
];
const PLATFORMS: [string, string][] = [
  ["", "All"], ["play_store", "Play Store"], ["app_store", "App Store"],
  ["reddit", "Reddit"], ["forums", "Community Forum"],
];

export default function Overview() {
  const s = useJSON(getSummary);
  const x = useJSON(getExtra);
  const [modal, setModal] = useState(false);
  const [platform, setPlatform] = useState("");
  if (!s) return <p className="muted">Loading…</p>;
  const t = s.totals || {};

  const cats: [string, number][] = Object.entries(s.by_category || {})
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => [CAT_LABEL[k] || k, v]);
  const catMax = Math.max(...cats.map((c) => c[1]), 1);
  const sources = x?.source_detail || [];
  const tp = x?.top_problem;
  const top5 = x?.top5_insights || [];
  const emo = x ? Object.entries(x.emotion.distribution).sort((a, b) => b[1] - a[1]) : [];
  const negEmo = emo.filter(([k]) => k !== "excitement");
  const tier = x?.emotion_tier || {};
  const sent = s.by_sentiment || {};
  const sentTotal = Object.values(sent).reduce((a, b) => a + b, 0) || 1;
  const recentAll = x?.recent_reviews || [];
  const recent = platform ? recentAll.filter((r) => r.source === platform) : recentAll;
  const yearDist = x?.year_distribution || {};
  const rateDist = x?.rating_distribution || {};
  const plans = x?.plan_breakdown || {};

  const sentDonut: [string, number, string][] = [
    ["Frustrated", sent.frustrated || 0, "#e64a4a"], ["Neutral", sent.neutral || 0, "#e6b34a"],
    ["Positive", sent.positive || 0, "#1db954"]].filter((d) => (d[1] as number) > 0) as [string, number, string][];
  const srcDonut: [string, number, string][] = sources.map((d) =>
    [d.label, d.count, SRC_COLOR[d.source] || "#888"] as [string, number, string]);
  const yearBars: [string, number][] = Object.entries(yearDist).sort((a, b) => a[0].localeCompare(b[0]));
  const rateMax = Math.max(...Object.values(rateDist), 1);
  const rateTotal = Object.values(rateDist).reduce((a, b) => a + b, 0) || 1;
  const avgRating = (Object.entries(rateDist).reduce((a, [r, c]) => a + Number(r) * c, 0) / rateTotal).toFixed(1);
  const oneStarShare = pct((rateDist["1"] || 0) / rateTotal);
  const sevColor = (v: number) => v >= 80 ? "#e64a4a" : v >= 65 ? "#e6b34a" : "#1db954";

  return (
    <>
      <div className="hero">
        <h1>🎧 {PROJECT.title}</h1>
        <div className="subtitle">{PROJECT.subtitle}</div>
        <p className="lead">{PROJECT.context}</p>
      </div>

      {/* horizontal workspace tabs */}
      <nav className="top-tabs">
        {TABS.map(([href, label]) => (
          <a key={href} href={href} className={`top-tab ${href === "/" ? "active" : ""}`}>{label}</a>
        ))}
      </nav>

      {/* platform selector (filters Recent Reviews) */}
      <div className="platform-bar">
        <span className="pf-lbl">PLATFORM</span>
        {PLATFORMS.map(([k, label]) => (
          <button key={k} className={`pf-chip ${platform === k ? "active" : ""}`} onClick={() => setPlatform(k)}>{label}</button>
        ))}
      </div>

      {/* SUMMARY BAND */}
      <div className="summary-band">
        <button className="sb-total pulse-card" onClick={() => setModal(true)} aria-label="Open reviews analysed details">
          <span className="pulse-ring" />
          <div className="sb-total-num">{num(t.total_reviews)}</div>
          <div className="sb-total-lbl">curated reviews analyzed 🎧</div>
          <div className="sb-total-note">Filtered, cleaned & relevance-scored from 4 sources across 2016–2026. <span className="sb-click">Click to enlarge ↗</span></div>
          <div className="sb-split">
            <div className="sb-pill blue"><b>🎯 {num(t.discovery_specific)}</b><span>Discovery-specific</span></div>
            <div className="sb-pill purple"><b>🧭 {num(t.adjacent_signal)}</b><span>Discovery-adjacent</span></div>
            <div className="sb-pill red"><b>⚠️ {pct(t.problem_rate)}</b><span>Problem rate</span></div>
          </div>
        </button>
        <div className="sb-sources">
          <div className="sb-head">Sources analyzed · with year coverage</div>
          {sources.length === 0 ? <span className="na">{NA}</span> : sources.map((d) => (
            <div className="sb-src" key={d.source}>
              <span className="sb-src-emoji" style={{ color: SRC_COLOR[d.source] }}>{SRC_EMOJI[d.source] || "•"}</span>
              <span className="sb-src-name">{d.label}</span>
              <span className="sb-src-time">📅 {d.year_min}–{d.year_max} · ⭐ peak {d.top_year}</span>
              <span className="sb-src-box" style={{ borderColor: SRC_COLOR[d.source], color: "#fff" }}>{d.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* plan mentions — moved up, top area */}
      <Tag>Plan mentions in reviews</Tag>
      <Card>
        <div className="plan-grid">
          {PLAN.map(([k, label, e]) => (
            <div className="plan-cell" key={k}>
              <div className="plan-e">{e}</div>
              <div className="plan-num">{(plans[k] || 0).toLocaleString()}</div>
              <div className="plan-lbl">{label}</div>
            </div>
          ))}
        </div>
        <div className="note">Plan tier is inferred only when users mention Free, Premium, Student, Duo, or Family in review text. Most reviews do not state plan type.</div>
      </Card>

      {/* reviews by year timeline */}
      <Tag>Reviews by Year · Timeline</Tag>
      <Card><Histogram data={yearBars} /></Card>

      {/* category + sources pie */}
      <Tag>Category Breakdown & Source Mix</Tag>
      <div className="grid cols-2">
        <Card title="Category breakdown">
          <div className="catbars">
            {cats.map(([name, val]) => (
              <div className="catbar" key={name}>
                <span className="catbar-name">{name}</span>
                <div className="catbar-track"><div className="catbar-fill" style={{ width: `${(val / catMax) * 100}%`, background: CAT_COLOR[name] || "#1db954" }} /></div>
                <span className="catbar-val">{val.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Reviews by source"><Donut data={srcDonut} center={kfmt(t.total_reviews)} /></Card>
      </div>

      {/* #1 problem */}
      {tp && (
        <div className="num1">
          <div className="num1-badge">#1 Problem</div>
          <div className="num1-body">
            <h2 style={{ margin: "0 0 6px" }}>{tp.title}</h2>
            <p style={{ margin: 0, color: "#e2e2e2", fontSize: 14, lineHeight: 1.6 }}>
              The single biggest problem in the dataset — <b>{tp.count.toLocaleString()} reviews</b> ({pct(tp.pct_total)} of all 26,823) describe trouble surfacing genuinely new music.
              Sentiment skews negative at <b style={{ color: "#ffb3b3" }}>{pct(tp.frustration_pct)} frustrated</b>, average discovery-friction <b>{tp.avg_friction}/100</b>, most concentrated in <b>{tp.top_region || NA}</b>.
            </p>
            <div className="num1-stats">
              <div className="n1s red"><b>{tp.sentiment.frustrated?.toLocaleString()}</b><span>😠 Frustrated</span></div>
              <div className="n1s"><b>{tp.sentiment.neutral?.toLocaleString()}</b><span>😐 Neutral</span></div>
              <div className="n1s green"><b>{tp.sentiment.positive?.toLocaleString()}</b><span>😊 Positive</span></div>
              <div className="n1s amber"><b>{tp.severity ?? NA}</b><span>Severity</span></div>
            </div>
            {tp.quote && <div className="quote" style={{ marginTop: 12 }}>{tp.quote.text}
              <span className="meta">— {SRC_LABEL[tp.quote.source] || tp.quote.source} · {tp.quote.region}</span></div>}
          </div>
        </div>
      )}

      {/* top 5 coloured */}
      <Tag>Top 5 Discovery Pain Points</Tag>
      {top5.length === 0 ? <p className="na">{NA}</p> : (
        <div className="grid">
          {top5.map((ins, i) => (
            <div className="card pain" key={i} style={{ borderLeft: `4px solid ${sevColor(ins.severity_score)}` }}>
              <div><span className="badge" style={{ background: sevColor(ins.severity_score), color: "#04130a", marginRight: 8 }}>{i + 1}</span><b>{ins.title}</b>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{ins.evidence_count.toLocaleString()} reviews · {ins.affected_segment}</div></div>
              <div className="sev-wrap"><div className="sev" style={{ fontSize: 22, color: sevColor(ins.severity_score) }}>{ins.severity_score}</div><div className="lbl">severity</div></div>
            </div>
          ))}
        </div>
      )}

      <div className="grid cols-2">
        <div>
          <Tag>Why Users Are Frustrated</Tag>
          <Card>
            {negEmo.length === 0 ? <span className="na">{NA}</span> : negEmo.map(([k, v]) => (
              <div key={k} className="emo-row">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <b style={{ color: "var(--red)" }}>{cap(k)}</b>
                  <span><b>{v.toLocaleString()}</b> <span className="muted" style={{ fontSize: 11 }}>reviews</span></span></div>
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{EMO_DESC[k] || ""}</div>
                {tier[k] && (<div className="emo-tier">
                  <span className="badge blue-b">🆓 Free: {tier[k].free.toLocaleString()}</span>
                  <span className="badge green">💎 Premium: {tier[k].paid.toLocaleString()}</span></div>)}
              </div>
            ))}
            <div className="note">Emotions detected by keyword heuristic; tier inferred from review text (premium/free cues).</div>
          </Card>
        </div>
        <div>
          <Tag>Sentiment Breakdown</Tag>
          <Card>
            <Donut data={sentDonut} center={`${Math.round(((sent.frustrated || 0) / sentTotal) * 100)}%`} />
            <div className="note" style={{ marginTop: 12 }}>
              Of {sentTotal.toLocaleString()} analyzed reviews, {pct((sent.frustrated || 0) / sentTotal)} read as frustrated,
              {" "}{pct((sent.neutral || 0) / sentTotal)} neutral, and {pct((sent.positive || 0) / sentTotal)} positive.
            </div>
          </Card>
          <Tag>Review Impact · Ratings</Tag>
          <Card>
            <div className="rate-bars">
              {[1, 2, 3, 4, 5].map((r) => {
                const v = rateDist[String(r)] || 0;
                return (<div className="rate-row" key={r}>
                  <span className="rate-star">{r}★</span>
                  <div className="rate-track"><div className="rate-fill" style={{ width: `${(v / rateMax) * 100}%`, background: RATE_COLOR[r - 1] }} /></div>
                  <span className="rate-val">{v.toLocaleString()}</span></div>);
              })}
            </div>
            <div className="note" style={{ marginTop: 10 }}>Ratings are polarized — a large block of 1★ frustration alongside many 5★ fans, a love-it-or-hate-it discovery experience.</div>
          </Card>
        </div>
      </div>

      {/* recent reviews — rectangular cards with star ratings */}
      <Tag>Recent Reviews {platform && `· ${SRC_LABEL[platform] || platform}`}</Tag>
      {recent.length === 0 ? <p className="na">No recent reviews for this platform.</p> : (
        <div className="grid">
          {recent.map((r, i) => (
            <div className="rev-box" key={i}>
              <div className="rev-top">
                <span className="rev-src">{SRC_EMOJI[r.source] || "📱"} {SRC_LABEL[r.source] || r.source}</span>
                {r.rating && <span className="rev-stars" title={`${r.rating}/5`}>{stars(r.rating)}</span>}
              </div>
              <div className="rev-text">{r.text}</div>
              <div className="rev-foot">
                <span className={`badge ${FRUST[r.frustration]?.c || "grey"}`}>{FRUST[r.frustration]?.e} {r.frustration}</span>
                <span className="badge grey">{SENT_EMOJI[r.sentiment] || ""} {cap(r.sentiment)}</span>
                <span className="badge grey">🏷️ {r.category.replace(/_/g, " ")}</span>
                <span className="muted" style={{ fontSize: 12 }}>📍 {r.region || NA}{r.date ? ` · 📅 ${r.date}` : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reviews Analysed modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 style={{ margin: 0, fontSize: 20 }}>Reviews Analysed</h2>
              <button className="copy-btn" onClick={() => setModal(false)}>✕</button>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Total curated reviews ingested, deduped, and analyzed from all four sources (2016–2026).</p>
            <div className="modal-rows">
              <div className="modal-row"><span>Total reviews</span><b>{num(t.total_reviews)}</b></div>
              <div className="modal-row"><span>Discovery-specific</span><b>{num(t.discovery_specific)}</b></div>
              <div className="modal-row"><span>Discovery-adjacent</span><b>{num(t.adjacent_signal)}</b></div>
              <div className="modal-row"><span>Problem rate</span><b>{pct(t.problem_rate)}</b></div>
              <div className="modal-row"><span>Average rating</span><b>{avgRating} ★</b></div>
              <div className="modal-row"><span>Sentiment (frustrated)</span><b>{pct((sent.frustrated || 0) / sentTotal)}</b></div>
              <div className="modal-row"><span>Theme / category count</span><b>{cats.length}</b></div>
              <div className="modal-row"><span>1★ share</span><b>{oneStarShare}</b></div>
            </div>
            <button className="modal-close" onClick={() => setModal(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
