"use client";
import { getSummary, getExtra, getEngine, PROJECT, num, pct, NA } from "@/lib/data";
import { Metric, Card, BarList, Donut, Tag, useJSON } from "./components/ui";

const SRC_COLOR: Record<string, string> = {
  "Play Store": "#1db954", "App Store": "#4a90e6",
  "Reddit": "#e6b34a", "Spotify Community Forums": "#b18cf2",
};
const CAT_COLOR: Record<string, string> = {
  "Discovery issue": "#e6b34a", "Repetition issue": "#e64a4a",
  "Algorithm mismatch": "#b18cf2", "Discovery positive": "#1db954",
  "General / adjacent signal": "#5a5a5a",
};
const CAT_LABEL: Record<string, string> = {
  discovery_issue: "Discovery issue", repetition_issue: "Repetition issue",
  algorithm_mismatch: "Algorithm mismatch", discovery_positive: "Discovery positive",
  general_music_experience: "General / adjacent signal",
};

export default function Overview() {
  const s = useJSON(getSummary);
  const x = useJSON(getExtra);
  const e = useJSON(getEngine);
  if (!s) return <p className="muted">Loading…</p>;
  const t = s.totals || {};

  const srcDonut: [string, number, string][] = Object.entries(s.by_source || {})
    .map(([k, v]) => [PROJECT.sourceLabels[k] || k, v] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => [k, v, SRC_COLOR[k] || "#888"]);
  const catDonut: [string, number, string][] = Object.entries(s.by_category || {})
    .map(([k, v]) => [CAT_LABEL[k] || k, v] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => [k, v, CAT_COLOR[k] || "#888"]);

  const fp = x?.free_paid;
  const needs = e?.theme_detection?.top_unmet_needs || [];
  const emo = x ? Object.entries(x.emotion.distribution).sort((a, b) => b[1] - a[1]) : [];
  const negEmo = emo.filter(([k]) => k !== "excitement");
  const top5 = x?.top5_insights || [];

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

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <Card title="Where reviews came from">
          <Donut data={srcDonut} center={`${(t.total_reviews / 1000).toFixed(0)}k`} />
        </Card>
        <Card title="Category breakdown">
          <Donut data={catDonut} />
        </Card>
      </div>

      <Card title="Free vs Paid users (heuristic)">
        {!fp ? <span className="na">Loading…</span> : (
          <>
            <div className="split-bar">
              <span style={{ width: `${(fp.free / (fp.free + fp.paid + fp.unknown)) * 100}%`, background: "#4a90e6", minWidth: 40 }}>Free {fp.free.toLocaleString()}</span>
              <span style={{ width: `${(fp.paid / (fp.free + fp.paid + fp.unknown)) * 100}%`, background: "#1db954", minWidth: 40 }}>Paid {fp.paid.toLocaleString()}</span>
              <span style={{ width: `${(fp.unknown / (fp.free + fp.paid + fp.unknown)) * 100}%`, background: "#333", color: "#999" }}>Unknown {fp.unknown.toLocaleString()}</span>
            </div>
            <div className="note">{fp.label}. Most reviews don’t state plan, so {pct(fp.unknown / t.total_reviews)} are “Unknown”. Free ≈ {pct(fp.free_share)}, Paid ≈ {pct(fp.paid_share)} of all reviews.</div>
          </>
        )}
      </Card>

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
        <div>
          <Tag>Top Frustrations (unmet needs)</Tag>
          <Card>
            <BarList data={needs.slice(0, 6).map((n: any) => [n.need.replace(/_/g, " "), n.evidence_count] as [string, number])} />
          </Card>
        </div>
        <div>
          <Tag>Why Users Are Frustrated</Tag>
          <Card>
            <BarList data={negEmo.map(([k, v]) => [k, v] as [string, number])} />
            <div className="note">Negative emotions detected by keyword heuristic across reviews.</div>
          </Card>
        </div>
      </div>

      <Tag>Key Evidence-Backed Insights</Tag>
      {top5.length === 0 ? <p className="na">{NA}</p> : top5.slice(0, 3).map((ins, i) => (
        <div className="card insight" key={i}>
          <div className="head">
            <div><b style={{ fontSize: 15 }}>{ins.title}</b>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Evidence {ins.evidence_count.toLocaleString()} · {ins.affected_segment} · negativity {(ins.negativity * 100).toFixed(0)}%</div></div>
            <div className="sev-wrap"><div className="sev">{ins.severity_score}</div><div className="lbl">severity</div></div>
          </div>
          {ins.representative_quotes?.[0] && (
            <div className="quote">{ins.representative_quotes[0].text}
              <span className="meta">— {ins.representative_quotes[0].source} · {ins.representative_quotes[0].region}</span></div>
          )}
        </div>
      ))}
    </>
  );
}
