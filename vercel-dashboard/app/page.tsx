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
const PLATFORMS: [string, string][] = [
  ["", "All"], ["play_store", "Play Store"], ["app_store", "App Store"],
  ["reddit", "Reddit"], ["forums", "Community Forum"],
];
const RANGES: [string, string][] = [
  ["all", "All time"], ["2024", "Since 2024"], ["2025", "Since 2025"], ["2026", "2026 only"],
];

export default function Overview() {
  const s = useJSON(getSummary);
  const x = useJSON(getExtra);
  const [modal, setModal] = useState(false);
  const [platform, setPlatform] = useState("");
  const [range, setRange] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  if (!s) return <p className="muted">Loading…</p>;
  const t = s.totals || {};

  const sync = async () => {
    setSyncing(true);
    try { await Promise.all([getSummary(), getExtra()]); setSyncedAt(new Date().toLocaleTimeString()); }
    finally { setSyncing(false); }
  };

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
  const pp = (x?.per_platform || {})[platform || "all"] || (x?.per_platform || {}).all;

  const sentDonut: [string, number, string][] = [
    ["Frustrated", sent.frustrated || 0, "#e64a4a"], ["Neutral", sent.neutral || 0, "#e6b34a"],
    ["Positive", sent.positive || 0, "#1db954"]].filter((d) => (d[1] as number) > 0) as [string, number, string][];
  const srcDonut: [string, number, string][] = sources.map((d) =>
    [d.label, d.count, SRC_COLOR[d.source] || "#888"] as [string, number, string]);
  const yearBars: [string, number][] = Object.entries(yearDist)
    .filter(([y]) => range === "all" || (range === "2026" ? y === "2026" : y >= range))
    .sort((a, b) => a[0].localeCompare(b[0]));
  const rateMax = Math.max(...Object.values(rateDist), 1);
  const rateTotal = Object.values(rateDist).reduce((a, b) => a + b, 0) || 1;
  const oneStarShare = pct((rateDist["1"] || 0) / rateTotal);
  const sevColor = (v: number) => v >= 80 ? "#e64a4a" : v >= 65 ? "#e6b34a" : "#1db954";
  const ratingShown = pp && pp.avg_rating != null && platform !== "reddit" && platform !== "forums";

  return (
    <>
      {/* header row: title + AI badge + sync */}
      <div className="ovh">
        <div>
          <div className="ovh-title">🎧 {PROJECT.title} <span className="ai-badge">⚡ AI-POWERED</span></div>
          <div className="ovh-sub">{PROJECT.subtitle}</div>
          <div className="ovh-sub2">Review corpus overview · KPIs · sentiment · PM radar — across 26,823 Spotify reviews.</div>
        </div>
        <div className="ovh-actions">
          <button className="sync-btn" onClick={sync} disabled={syncing}>🔄 {syncing ? "Syncing…" : "Sync Reviews"}</button>
          {syncedAt && <span className="sync-note">Synced ✓ {syncedAt}</span>}
        </div>
      </div>

      {/* filter bar: platform + time range (both functional) */}
      <div className="filter-bar">
        <div className="fb-group">
          <span className="pf-lbl">PLATFORM</span>
          {PLATFORMS.map(([k, label]) => (
            <button key={k} className={`pf-chip ${platform === k ? "active" : ""}`} onClick={() => setPlatform(k)}>{label}</button>
          ))}
        </div>
        <div className="fb-group">
          <span className="pf-lbl">TIME RANGE</span>
          {RANGES.map(([k, label]) => (
            <button key={k} className={`pf-chip ${range === k ? "active" : ""}`} onClick={() => setRange(k)}>{label}</button>
          ))}
        </div>
      </div>

      {/* KPI cards — change with platform */}
      <div className="kpi-row">
        <button className="kpi click" onClick={() => setModal(true)}>
          <div className="kpi-top"><span className="kpi-ic">📊</span>
            {pp?.trend_reviews != null && <span className={`kpi-trend ${pp.trend_reviews >= 0 ? "up" : "down"}`}>{pp.trend_reviews >= 0 ? "↗" : "↘"} {pct(pp.trend_reviews)}</span>}</div>
          <div className="kpi-num">{num(pp?.reviews)}</div><div className="kpi-lbl">Reviews Analysed</div>
          <div className="kpi-link">Click for details ↗</div>
        </button>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ic">⭐</span></div>
          <div className="kpi-num">{ratingShown ? `${pp!.avg_rating}` : "—"}</div><div className="kpi-lbl">Average Rating</div>
          <div className="kpi-sub">{ratingShown ? "out of 5★" : "no star ratings"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ic">💚</span></div>
          <div className="kpi-num">{pp ? pct(pp.positive_pct) : NA}</div><div className="kpi-lbl">Sentiment Score</div>
          <div className="kpi-sub">positive share</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ic">🏷️</span></div>
          <div className="kpi-num">{pp?.theme_count ?? NA}</div><div className="kpi-lbl">Theme Count</div>
          <div className="kpi-sub">discovery categories</div>
        </div>
      </div>

      {/* sources strip — 4 equal cards */}
      <Tag>Sources analyzed · with year coverage</Tag>
      {sources.length === 0 ? <p className="na">{NA}</p> : (
        <div className="src-strip">
          {sources.map((d) => (
            <div className="src-card" key={d.source} style={{ borderTop: `3px solid ${SRC_COLOR[d.source]}` }}>
              <div className="src-card-top"><span>{SRC_EMOJI[d.source]} {d.label}</span></div>
              <div className="src-card-num">{d.count.toLocaleString()}</div>
              <div className="src-card-time">📅 {d.year_min}–{d.year_max} · ⭐ peak {d.top_year}</div>
            </div>
          ))}
        </div>
      )}

      {/* plan mentions */}
      <Tag>Plan mentions in reviews</Tag>
      <Card>
        <div className="plan-grid">
          {PLAN.map(([k, label, e]) => (
            <div className="plan-cell" key={k}><div className="plan-e">{e}</div>
              <div className="plan-num">{(plans[k] || 0).toLocaleString()}</div><div className="plan-lbl">{label}</div></div>
          ))}
        </div>
        <div className="note">Plan tier is inferred only when users mention Free, Premium, Student, Duo, or Family in review text. Most reviews do not state plan type.</div>
      </Card>

      {/* reviews by year timeline (time range filters this) */}
      <Tag>Reviews by Year · Timeline {range !== "all" && `· ${RANGES.find((r) => r[0] === range)?.[1]}`}</Tag>
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

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 style={{ margin: 0, fontSize: 20 }}>Reviews Analysed</h2>
              <button className="copy-btn" onClick={() => setModal(false)}>✕</button>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              {platform ? `${SRC_LABEL[platform] || platform} — ` : "All sources — "}reviews ingested, deduped, and analyzed (2016–2026).</p>
            <div className="modal-rows">
              <div className="modal-row"><span>Reviews analysed</span><b>{num(pp?.reviews)}</b></div>
              <div className="modal-row"><span>Average rating</span><b>{ratingShown ? `${pp!.avg_rating} ★` : "—"}</b></div>
              <div className="modal-row"><span>Positive sentiment</span><b>{pp ? pct(pp.positive_pct) : NA}</b></div>
              <div className="modal-row"><span>Frustrated sentiment</span><b>{pp ? pct(pp.frustrated_pct) : NA}</b></div>
              <div className="modal-row"><span>Theme / category count</span><b>{pp?.theme_count ?? NA}</b></div>
              <div className="modal-row"><span>Discovery-specific (all)</span><b>{num(t.discovery_specific)}</b></div>
              <div className="modal-row"><span>Discovery-adjacent (all)</span><b>{num(t.adjacent_signal)}</b></div>
              <div className="modal-row"><span>1★ share (all)</span><b>{oneStarShare}</b></div>
            </div>
            <button className="modal-close" onClick={() => setModal(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
