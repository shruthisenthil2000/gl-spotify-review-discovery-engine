"use client";
import { useState } from "react";
import { getSummary, getExtra, num, pct, NA } from "@/lib/data";
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
const PLAN: [string, string, string][] = [
  ["free", "Free", "🆓"], ["premium_individual", "Premium Individual", "💎"],
  ["premium_student", "Premium Student", "🎓"], ["premium_duo", "Premium Duo", "👥"],
  ["premium_family", "Premium Family", "👨‍👩‍👧"],
];
const PLATFORMS: [string, string][] = [
  ["", "All"], ["play_store", "Play Store"], ["app_store", "App Store"],
  ["reddit", "Reddit"], ["forums", "Community"],
];
const RANGES: [string, string][] = [
  ["all", "All time"], ["2024", "Since 2024"], ["2025", "Since 2025"], ["2026", "2026 only"],
];
function KIcon({ d }: { d: string }) {
  return (
    <span className="kpi-ic">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#1db954" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
    </span>
  );
}
const IC = {
  reviews: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.2"/>',
};

export default function Overview() {
  const s = useJSON(getSummary);
  const x = useJSON(getExtra);
  const [modal, setModal] = useState<string | null>(null);
  const [platform, setPlatform] = useState("");
  const [range, setRange] = useState("all");
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
  const recent = recentAll.filter((r) =>
    (!platform || r.source === platform) &&
    (range === "all" || (range === "2026" ? r.date.startsWith("2026") : (r.date.slice(0, 4) >= range))));
  const yearDist = x?.year_distribution || {};
  const rateDist = x?.rating_distribution || {};
  const plans = x?.plan_breakdown || {};
  const ppr = x?.per_platform_range;
  const pp = ppr ? (ppr[platform || "all"] || ppr.all)?.[range] : undefined;
  const trend = (x?.per_platform || {})[platform || "all"]?.trend_reviews;

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
      {/* filter bar — platform + time range, same line, subtle chips */}
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

      {/* KPI cards — all clickable, pulsing, change with platform + range */}
      <div className="kpi-row">
        <button className="kpi pulse" onClick={() => setModal("reviews")}>
          <div className="kpi-top"><KIcon d={IC.reviews} />
            {trend != null && <span className={`kpi-trend ${trend >= 0 ? "up" : "down"}`}>{trend >= 0 ? "↗" : "↘"} {pct(trend)}</span>}</div>
          <div className="kpi-num">{num(pp?.reviews)}</div><div className="kpi-lbl">Reviews Analysed</div>
          <div className="kpi-link">Click for details ↗</div>
        </button>
        <button className="kpi pulse" onClick={() => setModal("rating")}>
          <div className="kpi-top"><KIcon d={IC.star} /></div>
          <div className="kpi-num">{ratingShown ? `${pp!.avg_rating}` : "—"}</div><div className="kpi-lbl">Average Rating</div>
          <div className="kpi-link">Click for details ↗</div>
        </button>
        <button className="kpi pulse" onClick={() => setModal("sentiment")}>
          <div className="kpi-top"><KIcon d={IC.zap} /></div>
          <div className="kpi-num">{pp ? pct(pp.positive_pct) : NA}</div><div className="kpi-lbl">Sentiment Score</div>
          <div className="kpi-link">Click for details ↗</div>
        </button>
        <button className="kpi pulse" onClick={() => setModal("themes")}>
          <div className="kpi-top"><KIcon d={IC.tag} /></div>
          <div className="kpi-num">{pp?.theme_count ?? NA}</div><div className="kpi-lbl">Theme Count</div>
          <div className="kpi-link">Click for details ↗</div>
        </button>
      </div>

      {/* sources strip */}
      <Tag>Sources analyzed · with year coverage</Tag>
      {sources.length === 0 ? <p className="na">{NA}</p> : (
        <div className="src-strip">
          {sources.map((d) => (
            <div className="src-card" key={d.source} style={{ borderTop: `3px solid ${SRC_COLOR[d.source]}` }}>
              <div className="src-card-top">{SRC_EMOJI[d.source]} {d.label}</div>
              <div className="src-card-num">{d.count.toLocaleString()}</div>
              <div className="src-card-time">📅 {d.year_min}–{d.year_max} · ⭐ peak {d.top_year}</div>
            </div>
          ))}
        </div>
      )}

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

      <Tag>Reviews by Year · Timeline {range !== "all" && `· ${RANGES.find((r) => r[0] === range)?.[1]}`}</Tag>
      <Card><Histogram data={yearBars} /></Card>

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

      {/* recent reviews — User Voices format */}
      <Tag>Recent Reviews {platform && `· ${SRC_LABEL[platform] || platform}`}</Tag>
      {recent.length === 0 ? <p className="na">No recent reviews for this selection.</p> : (
        <div className="voices">
          {recent.map((r, i) => (
            <div className="voice" key={i}>
              <div className="voice-q">“{r.text}”</div>
              <div className="voice-foot">
                <span className="voice-who">{SRC_EMOJI[r.source] || "📱"} {SRC_LABEL[r.source] || r.source}{r.region ? ` · ${r.region}` : ""}{r.date ? ` · ${r.date}` : ""}</span>
                {r.rating && <span className="voice-stars">{stars(r.rating)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI modals */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 style={{ margin: 0, fontSize: 20 }}>
                {modal === "reviews" ? "Reviews Analysed" : modal === "rating" ? "Average Rating"
                  : modal === "sentiment" ? "Sentiment Score" : "Theme Count"}
              </h2>
              <button className="copy-btn" onClick={() => setModal(null)}>✕</button>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              {platform ? `${SRC_LABEL[platform] || platform}` : "All sources"} · {RANGES.find((r) => r[0] === range)?.[1]}
            </p>
            <div className="modal-rows">
              {modal === "reviews" && <>
                <div className="modal-row"><span>Reviews analysed</span><b>{num(pp?.reviews)}</b></div>
                <div className="modal-row"><span>Discovery-specific (all)</span><b>{num(t.discovery_specific)}</b></div>
                <div className="modal-row"><span>Discovery-adjacent (all)</span><b>{num(t.adjacent_signal)}</b></div>
                <div className="modal-row"><span>Problem rate (all)</span><b>{pct(t.problem_rate)}</b></div>
              </>}
              {modal === "rating" && <>
                <div className="modal-row"><span>Average rating</span><b>{ratingShown ? `${pp!.avg_rating} ★` : "—"}</b></div>
                {[5, 4, 3, 2, 1].map((r) => (
                  <div className="modal-row" key={r}><span>{r}★ reviews (all)</span><b>{(rateDist[String(r)] || 0).toLocaleString()}</b></div>
                ))}
              </>}
              {modal === "sentiment" && <>
                <div className="modal-row"><span>Positive</span><b>{pp ? pct(pp.positive_pct) : NA}</b></div>
                <div className="modal-row"><span>Frustrated</span><b>{pp ? pct(pp.frustrated_pct) : NA}</b></div>
                <div className="modal-row"><span>Neutral</span><b>{pp ? pct(Math.max(0, 1 - pp.positive_pct - pp.frustrated_pct)) : NA}</b></div>
              </>}
              {modal === "themes" && <>
                <div className="modal-row"><span>Theme / category count</span><b>{pp?.theme_count ?? NA}</b></div>
                {cats.map(([n, v]) => <div className="modal-row" key={n}><span>{n}</span><b>{v.toLocaleString()}</b></div>)}
              </>}
            </div>
            <button className="modal-close" onClick={() => setModal(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
