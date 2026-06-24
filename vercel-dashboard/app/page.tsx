"use client";
import { getSummary, getExtra, PROJECT, num, pct, NA } from "@/lib/data";
import { Metric, Card, BarList, Tag, useJSON } from "./components/ui";

const CAT_LABEL: Record<string, string> = {
  discovery_issue: "Discovery issue", repetition_issue: "Repetition issue",
  algorithm_mismatch: "Algorithm mismatch", discovery_positive: "Discovery positive",
  general_music_experience: "General / adjacent signal",
};
const SRC_LABEL: Record<string, string> = {
  play_store: "Play Store", app_store: "App Store", reddit: "Reddit", forums: "Spotify Community",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Plain-language description for each detected emotion.
const EMO_DESC: Record<string, string> = {
  frustration: "Users are exasperated when recommendations ignore their taste and the same songs keep returning.",
  fatigue: "Listeners feel worn down by hearing the same rotation over and over, with little variety.",
  boredom: "The experience feels stale and predictable — nothing new to explore.",
  disappointment: "Expectations of strong discovery aren’t met, especially among long-time users.",
  distrust: "Users suspect the algorithm pushes AI-generated or agenda-driven content over real artists.",
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
  const sent = s.by_sentiment || {};
  const sentTotal = Object.values(sent).reduce((a, b) => a + b, 0) || 1;
  const fp = x?.free_paid;
  const recent = x?.recent_reviews || [];
  const topYears = (by: Record<string, number>) =>
    Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <>
      <div className="hero">
        <h1>{PROJECT.title}</h1>
        <div className="subtitle">{PROJECT.subtitle}</div>
        <p className="lead">{PROJECT.context}</p>
      </div>

      <div className="grid cards" style={{ marginTop: 18 }}>
        <div className="card metric kpi-accent"><div className="label">Total reviews analyzed</div><div className="value">{num(t.total_reviews)}</div></div>
        <div className="card metric kpi-accent blue"><div className="label">Discovery-specific</div><div className="value">{num(t.discovery_specific)}</div></div>
        <div className="card metric kpi-accent purple"><div className="label">Discovery-adjacent</div><div className="value">{num(t.adjacent_signal)}</div></div>
        <div className="card metric kpi-accent red"><div className="label">Problem rate</div><div className="value">{pct(t.problem_rate)}</div></div>
      </div>

      {/* per-source counts + year coverage (side mention of the 26,823) */}
      <Card title="Reviews by source & year coverage">
        {sources.length === 0 ? <span className="na">{NA}</span> : (
          <div className="src-table">
            {sources.map((d) => (
              <div className="src-row" key={d.source}>
                <div className="src-name">{d.label}</div>
                <div className="src-count">{d.count.toLocaleString()} <span className="muted">reviews</span></div>
                <div className="src-years">
                  {d.year_min && d.year_max ? `${d.year_min}–${d.year_max}` : NA}
                  {d.top_year ? ` · most in ${d.top_year}` : ""}
                  <span className="src-byyear">{topYears(d.by_year).map(([y, c]) => `${y}: ${c.toLocaleString()}`).join("  ·  ")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Tag>Category breakdown</Tag>
      <Card><BarList data={cats} /></Card>

      {/* #1 problem — detailed */}
      <Tag>#1 Problem · Discovery Friction</Tag>
      {!tp ? <p className="na">{NA}</p> : (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 520 }}>
              <b style={{ fontSize: 16 }}>{tp.title}</b>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>
                The single biggest problem in the dataset: <b style={{ color: "#fff" }}>{tp.count.toLocaleString()} reviews</b> ({pct(tp.pct_total)} of all 26,823) describe trouble surfacing genuinely new music.
                Sentiment skews negative — <b style={{ color: "var(--red)" }}>{pct(tp.frustration_pct)} frustrated</b>, with an average discovery-friction score of <b>{tp.avg_friction}/100</b>. Most concentrated in <b>{tp.top_region || NA}</b>.
              </p>
            </div>
            <div className="kv" style={{ alignContent: "start" }}>
              <span className="k">Frustrated</span><b style={{ color: "var(--red)" }}>{tp.sentiment.frustrated?.toLocaleString()}</b>
              <span className="k">Neutral</span><b>{tp.sentiment.neutral?.toLocaleString()}</b>
              <span className="k">Positive</span><b style={{ color: "var(--green)" }}>{tp.sentiment.positive?.toLocaleString()}</b>
              <span className="k">Severity</span><b className="muted">{tp.severity ?? NA}/100</b>
            </div>
          </div>
          {tp.quote && <div className="quote" style={{ marginTop: 12 }}>{tp.quote.text}
            <span className="meta">— {SRC_LABEL[tp.quote.source] || tp.quote.source} · {tp.quote.region}</span></div>}
        </Card>
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
        {/* Why users are frustrated — described emotions */}
        <div>
          <Tag>Why Users Are Frustrated</Tag>
          <Card>
            {negEmo.length === 0 ? <span className="na">{NA}</span> : negEmo.map(([k, v]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <b style={{ color: "var(--red)" }}>{cap(k)}</b><b>{v.toLocaleString()}</b></div>
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{EMO_DESC[k] || ""}</div>
              </div>
            ))}
            <div className="note">Emotions detected by keyword heuristic across reviews; one review may express more than one.</div>
          </Card>
        </div>

        {/* Sentiment breakdown — explained */}
        <div>
          <Tag>Sentiment Breakdown</Tag>
          <Card>
            <BarList data={["frustrated", "neutral", "positive"].filter((k) => sent[k] !== undefined)
              .map((k) => [cap(k), sent[k]] as [string, number])} />
            <div className="note" style={{ marginTop: 12 }}>
              Of {sentTotal.toLocaleString()} analyzed reviews, {pct((sent.frustrated || 0) / sentTotal)} read as frustrated,
              {" "}{pct((sent.neutral || 0) / sentTotal)} neutral, and {pct((sent.positive || 0) / sentTotal)} positive —
              discovery problems skew negative, while a strong minority still praise the experience.
            </div>
            {fp && (
              <div className="note" style={{ marginTop: 10 }}>
                <b>By plan (heuristic from review text):</b> {fp.free.toLocaleString()} reviews from free users,
                {" "}{fp.paid.toLocaleString()} from premium/paid users, and {fp.unknown.toLocaleString()} did not state a plan.
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Recent reviews — real, with full metadata */}
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
