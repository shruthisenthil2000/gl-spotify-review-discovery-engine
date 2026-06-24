"use client";
import { getSummary, getExtra, PROJECT, num, pct, NA } from "@/lib/data";
import { Card, BarList, Donut, Tag, useJSON } from "./components/ui";

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
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const EMO_DESC: Record<string, string> = {
  frustration: "Exasperated when recommendations ignore their taste and the same songs keep returning.",
  fatigue: "Worn down by hearing the same rotation over and over, with little variety.",
  boredom: "The experience feels stale and predictable — nothing new to explore.",
  disappointment: "Expectations of strong discovery aren’t met, especially among long-time users.",
  distrust: "Suspect the algorithm pushes AI-generated or agenda-driven content over real artists.",
  excitement: "When discovery works, users are delighted by fresh, personal recommendations.",
};
const FRUST_CLASS: Record<string, string> = { High: "red", Medium: "amber", Low: "green" };

export default function Overview() {
  const s = useJSON(getSummary);
  const x = useJSON(getExtra);
  if (!s) return <p className="muted">Loading…</p>;
  const t = s.totals || {};

  const cats: [string, number][] = Object.entries(s.by_category || {})
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => [CAT_LABEL[k] || k, v]);
  const sources = x?.source_detail || [];
  const tp = x?.top_problem;
  const top5 = x?.top5_insights || [];
  const emo = x ? Object.entries(x.emotion.distribution).sort((a, b) => b[1] - a[1]) : [];
  const negEmo = emo.filter(([k]) => k !== "excitement");
  const tier = x?.emotion_tier || {};
  const sent = s.by_sentiment || {};
  const sentTotal = Object.values(sent).reduce((a, b) => a + b, 0) || 1;
  const recent = x?.recent_reviews || [];
  const topYears = (by: Record<string, number>) =>
    Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const sentDonut: [string, number, string][] = [
    ["Frustrated", sent.frustrated || 0, "#e64a4a"],
    ["Neutral", sent.neutral || 0, "#e6b34a"],
    ["Positive", sent.positive || 0, "#1db954"],
  ].filter((d) => (d[1] as number) > 0) as [string, number, string][];

  return (
    <>
      <div className="hero">
        <h1>{PROJECT.title}</h1>
        <div className="subtitle">{PROJECT.subtitle}</div>
        <p className="lead">{PROJECT.context}</p>
      </div>

      {/* SUMMARY BAND: total → sources (with years) → discovery split */}
      <div className="summary-band">
        <div className="sb-total">
          <div className="sb-total-num">{num(t.total_reviews)}</div>
          <div className="sb-total-lbl">curated reviews analyzed</div>
          <div className="sb-split">
            <div className="sb-pill blue"><b>{num(t.discovery_specific)}</b><span>Discovery-specific</span></div>
            <div className="sb-pill purple"><b>{num(t.adjacent_signal)}</b><span>Discovery-adjacent</span></div>
            <div className="sb-pill red"><b>{pct(t.problem_rate)}</b><span>Problem rate</span></div>
          </div>
        </div>
        <div className="sb-sources">
          <div className="sb-head">Sources analyzed · with year coverage</div>
          {sources.length === 0 ? <span className="na">{NA}</span> : sources.map((d) => (
            <div className="sb-src" key={d.source}>
              <span className="sb-dot" style={{ background: SRC_COLOR[d.source] || "#888" }} />
              <span className="sb-src-name">{d.label}</span>
              <span className="sb-src-count">{d.count.toLocaleString()}</span>
              <span className="sb-src-years">{d.year_min && d.year_max ? `${d.year_min}–${d.year_max}` : NA}
                {d.top_year ? ` · peak ${d.top_year}` : ""}
                <span className="sb-byyear">{topYears(d.by_year).map(([y, c]) => `${y}: ${c.toLocaleString()}`).join("  ·  ")}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <Tag>Category breakdown</Tag>
      <Card><BarList data={cats} /></Card>

      {/* #1 PROBLEM — prominent */}
      {tp && (
        <div className="num1">
          <div className="num1-badge">#1 Problem</div>
          <div className="num1-body">
            <h2 style={{ margin: "0 0 6px" }}>{tp.title}</h2>
            <p style={{ margin: 0, color: "#e2e2e2", fontSize: 14, lineHeight: 1.6 }}>
              The single biggest problem in the dataset — <b>{tp.count.toLocaleString()} reviews</b> ({pct(tp.pct_total)} of all 26,823) describe trouble surfacing genuinely new music.
              Sentiment skews negative at <b style={{ color: "#ffb3b3" }}>{pct(tp.frustration_pct)} frustrated</b>, with an average discovery-friction score of <b>{tp.avg_friction}/100</b>, most concentrated in <b>{tp.top_region || NA}</b>.
            </p>
            <div className="num1-stats">
              <div className="n1s red"><b>{tp.sentiment.frustrated?.toLocaleString()}</b><span>Frustrated</span></div>
              <div className="n1s"><b>{tp.sentiment.neutral?.toLocaleString()}</b><span>Neutral</span></div>
              <div className="n1s green"><b>{tp.sentiment.positive?.toLocaleString()}</b><span>Positive</span></div>
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
            <div className="card" key={i} style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
              <div><span className="badge green" style={{ marginRight: 8 }}>{i + 1}</span><b>{ins.title}</b>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{ins.evidence_count.toLocaleString()} reviews · {ins.affected_segment}</div></div>
              <div className="sev-wrap"><div className="sev" style={{ fontSize: 22 }}>{ins.severity_score}</div><div className="lbl">severity</div></div>
            </div>
          ))}
        </div>
      )}

      <div className="grid cols-2">
        {/* Why users are frustrated — emotion + tier */}
        <div>
          <Tag>Why Users Are Frustrated</Tag>
          <Card>
            {negEmo.length === 0 ? <span className="na">{NA}</span> : negEmo.map(([k, v]) => (
              <div key={k} className="emo-row">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <b style={{ color: "var(--red)" }}>{cap(k)}</b>
                  <span><b>{v.toLocaleString()}</b> <span className="muted" style={{ fontSize: 11 }}>reviews</span></span>
                </div>
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{EMO_DESC[k] || ""}</div>
                {tier[k] && (
                  <div className="emo-tier">
                    <span className="badge blue-b">Free: {tier[k].free.toLocaleString()}</span>
                    <span className="badge green">Premium: {tier[k].paid.toLocaleString()}</span>
                  </div>
                )}
              </div>
            ))}
            <div className="note">Emotions detected by keyword heuristic; tier inferred from review text (premium/free cues).</div>
          </Card>
        </div>

        {/* Sentiment breakdown — colourful pie */}
        <div>
          <Tag>Sentiment Breakdown</Tag>
          <Card>
            <Donut data={sentDonut} center={`${Math.round(((sent.frustrated || 0) / sentTotal) * 100)}%`} />
            <div className="note" style={{ marginTop: 12 }}>
              Of {sentTotal.toLocaleString()} analyzed reviews, {pct((sent.frustrated || 0) / sentTotal)} read as frustrated,
              {" "}{pct((sent.neutral || 0) / sentTotal)} neutral, and {pct((sent.positive || 0) / sentTotal)} positive.
              Discovery problems skew negative, while a strong minority still praise the experience.
            </div>
          </Card>
        </div>
      </div>

      {/* Recent reviews — real, full metadata */}
      <Tag>Recent Reviews</Tag>
      {recent.length === 0 ? <p className="na">{NA}</p> : (
        <div className="grid">
          {recent.map((r, i) => (
            <div className="review-card" key={i}>
              <div className="txt">{r.text}</div>
              <div className="meta">
                <span className="badge green">{SRC_LABEL[r.source] || r.source}</span>
                <span className={`badge ${FRUST_CLASS[r.frustration] || "grey"}`}>Frustration: {r.frustration}</span>
                <span className="badge grey">{cap(r.sentiment)}</span>
                <span className="badge grey">{r.category.replace(/_/g, " ")}</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {r.region || NA}{r.rating ? ` · ★${r.rating}` : ""}{r.date ? ` · ${r.date}` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
