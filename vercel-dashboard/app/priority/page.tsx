"use client";
import { getEngine, NA } from "@/lib/data";
import { Card, Scatter, useJSON } from "../components/ui";

const QCOLOR: Record<string, string> = {
  "Quick win / Now": "#1db954", "Strategic bet": "#e6b34a",
  "Monitor": "#4a90e6", "Backlog": "#888",
};

export default function Priority() {
  const e = useJSON(getEngine);
  if (!e) return <p className="muted">Loading…</p>;
  const radar = e.priority_radar || [];
  const insights = e.insights || [];

  return (
    <>
      <h1>PM Priority Radar</h1>
      <p className="page-sub">Opportunities ranked by Impact × Frequency. Top-right = act now.</p>

      <Card>
        <Scatter points={radar.map((r) => ({
          x: r.frequency, y: r.impact, r: r.priority_score,
          label: r.opportunity, color: QCOLOR[r.quadrant] || "#888",
        }))} />
      </Card>

      <h2>Ranked opportunities</h2>
      <Card>
        <table>
          <thead><tr>
            <th>Opportunity</th><th className="num">Impact</th><th className="num">Frequency</th>
            <th className="num">Priority</th><th>Quadrant</th>
          </tr></thead>
          <tbody>
            {radar.map((r, i) => (
              <tr key={i}>
                <td>{r.opportunity}</td>
                <td className="num">{r.impact}</td>
                <td className="num">{r.frequency.toLocaleString()}</td>
                <td className="num">{r.priority_score}</td>
                <td><span className="badge" style={{ background: "transparent", color: QCOLOR[r.quadrant] }}>{r.quadrant}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <h2>PM-ready insights</h2>
      <p className="page-sub">severity = 0.45·frequency + 0.35·negativity + 0.20·reach (0–100)</p>
      {insights.length === 0 && <p className="na">{NA}</p>}
      {insights.map((ins, i) => (
        <div className="card insight" key={i}>
          <div className="head">
            <div>
              <h2 style={{ margin: "0 0 6px" }}>{ins.title}</h2>
              <div className="muted" style={{ fontSize: 13 }}>
                Evidence <b>{ins.evidence_count.toLocaleString()}</b> · Affected: {ins.affected_segment}
                {" "}· Negativity {(ins.negativity * 100).toFixed(0)}% · <span className="badge grey">{ins.category}</span>
              </div>
            </div>
            <div className="sev-wrap"><div className="sev">{ins.severity_score}</div><div className="lbl">severity</div></div>
          </div>
          {ins.representative_quotes?.map((q, j) => (
            <div className="quote" key={j}>{q.text}
              <span className="meta">— {q.source} · {q.region} · ★{q.rating || "—"}</span></div>
          ))}
        </div>
      ))}
    </>
  );
}
