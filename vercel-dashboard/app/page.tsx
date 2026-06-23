"use client";
import { getSummary, getExtra, PROJECT, num, pct, NA } from "@/lib/data";
import { Metric, Card, BarList, Tag, useJSON } from "./components/ui";

const CAT_LABEL: Record<string, string> = {
  discovery_issue: "Discovery issue", repetition_issue: "Repetition issue",
  algorithm_mismatch: "Algorithm mismatch", discovery_positive: "Discovery positive",
  general_music_experience: "General / adjacent signal",
};

export default function Overview() {
  const s = useJSON(getSummary);
  const x = useJSON(getExtra);
  if (!s) return <p className="muted">Loading…</p>;
  const a = s.review_analytics || {};
  const sources: [string, number][] = Object.entries(s.by_source || {})
    .sort((p, q) => q[1] - p[1])
    .map(([k, v]) => [PROJECT.sourceLabels[k] || k, v]);
  const cats: [string, number][] = Object.entries(s.by_category || {})
    .sort((p, q) => q[1] - p[1])
    .map(([k, v]) => [CAT_LABEL[k] || k, v]);
  const top5 = x?.top5_insights || [];

  return (
    <>
      <div className="hero">
        <h1>{PROJECT.title}</h1>
        <div className="subtitle">{PROJECT.subtitle}</div>
        <p className="lead">{PROJECT.context}</p>
      </div>

      <div className="grid cards" style={{ marginTop: 18 }}>
        <Metric label="Total reviews analyzed" value={num(s.totals?.total_reviews)} />
        <Metric label="Discovery-specific" value={num(s.totals?.discovery_specific)} />
        <Metric label="Discovery-adjacent" value={num(s.totals?.adjacent_signal)} />
        <Metric label="Problem rate" value={pct(s.totals?.problem_rate)} />
      </div>

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <Card title="Source breakdown"><BarList data={sources} /></Card>
        <Card title="Category breakdown"><BarList data={cats} /></Card>
      </div>

      <Tag>10 Core Questions This Engine Answers</Tag>
      <div className="questions">
        {PROJECT.coreQuestions.map((q, i) => (
          <div className="qcard" key={i}>
            <div className="qn">{i + 1}</div>
            <div className="qt">{q}</div>
          </div>
        ))}
      </div>

      <Tag>Top 5 Insights (preview)</Tag>
      {top5.length === 0 ? <p className="na">{NA}</p> : (
        <div className="grid">
          {top5.map((ins, i) => (
            <div className="card" key={i} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
              <div>
                <b>{ins.title}</b>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  {ins.evidence_count.toLocaleString()} reviews · {ins.affected_segment}
                </div>
              </div>
              <div className="sev-wrap"><div className="sev" style={{ fontSize: 22 }}>{ins.severity_score}</div>
                <div className="lbl">severity</div></div>
            </div>
          ))}
        </div>
      )}

      <Tag>What This Engine Helps Spotify Decide</Tag>
      <div className="card">
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, color: "#d8d8d8" }}>
          {PROJECT.helpsDecide.map((h, i) => <li key={i}>{h}</li>)}
        </ul>
        <div className="note" style={{ marginTop: 14 }}>
          Sources analyzed: App Store, Play Store, Reddit, and Spotify Community Forums.
          See the <b>PM Priority Radar</b> for ranked opportunities and “What Should Spotify Build”.
        </div>
      </div>
    </>
  );
}
