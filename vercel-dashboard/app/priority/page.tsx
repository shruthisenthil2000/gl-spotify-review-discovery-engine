"use client";
import { getEngine, getExtra, num, NA } from "@/lib/data";
import { Card, Scatter, Tag, useJSON } from "../components/ui";

const QCOLOR: Record<string, string> = {
  "Quick win / Now": "#1db954", "Strategic bet": "#e6b34a",
  "Monitor": "#4a90e6", "Backlog": "#888",
};

export default function Priority() {
  const e = useJSON(getEngine);
  const x = useJSON(getExtra);
  if (!e) return <p className="muted">Loading…</p>;
  const radar = e.priority_radar || [];
  const insights = e.insights || [];

  return (
    <>
      <h1>PM Priority Radar</h1>
      <p className="page-sub">Product strategy view — opportunities ranked by Impact × Frequency.
        Top-right = high impact & high frequency = act now.</p>

      <Tag>Impact × Frequency matrix</Tag>
      <Card>
        <Scatter points={radar.map((r) => ({
          x: r.frequency, y: r.impact, r: r.priority_score,
          label: r.opportunity, color: QCOLOR[r.quadrant] || "#888",
        }))} />
      </Card>

      <Tag>Ranked opportunities</Tag>
      <Card>
        <table>
          <thead><tr><th>Theme</th><th className="num">Impact</th><th className="num">Evidence</th>
            <th className="num">Priority</th><th>Quadrant</th></tr></thead>
          <tbody>
            {radar.map((r, i) => (
              <tr key={i}><td>{r.opportunity}</td><td className="num">{r.impact}</td>
                <td className="num">{r.frequency.toLocaleString()}</td><td className="num">{r.priority_score}</td>
                <td><span className="badge" style={{ background: "transparent", color: QCOLOR[r.quadrant] }}>{r.quadrant}</span></td></tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Tag>Root Cause → Product Opportunity</Tag>
      <Card>
        {!x ? <span className="na">Loading…</span> : (
          <table>
            <thead><tr><th>Theme</th><th>Root cause</th><th>Product opportunity</th><th className="num">Evidence</th></tr></thead>
            <tbody>
              {x.root_cause_table.map((r, i) => (
                <tr key={i}><td><b>{r.theme}</b></td><td className="muted">{r.root_cause}</td>
                  <td style={{ color: "#cdebd7" }}>{r.opportunity}</td>
                  <td className="num">{r.evidence == null ? NA : r.evidence.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Tag>What Should Spotify Build?</Tag>
      {!x ? <p className="na">Loading…</p> : (
        <div className="card-grid">
          {x.opportunities.map((o) => (
            <div className="scard" key={o.name}>
              <h3>{o.name}</h3>
              <div className="row"><span className="k">User pain</span><span style={{ textAlign: "right", maxWidth: 180 }}>{o.user_pain}</span></div>
              <div className="row"><span className="k">Evidence</span><span>{o.evidence == null ? NA : o.evidence.toLocaleString()}</span></div>
              <div className="row"><span className="k">Affected segment</span><span>{o.segment}</span></div>
              <div className="impl"><b>Why it matters:</b> {o.why}</div>
            </div>
          ))}
        </div>
      )}

      <Tag>PM-ready insights</Tag>
      <p className="page-sub">severity = 0.45·frequency + 0.35·negativity + 0.20·reach (0–100)</p>
      {insights.length === 0 && <p className="na">{NA}</p>}
      {insights.map((ins, i) => (
        <div className="card insight" key={i}>
          <div className="head">
            <div>
              <h2 style={{ margin: "0 0 6px" }}>{ins.title}</h2>
              <div className="muted" style={{ fontSize: 13 }}>
                Evidence <b>{num(ins.evidence_count)}</b> · Affected: {ins.affected_segment}
                {" "}· Negativity {(ins.negativity * 100).toFixed(0)}% · <span className="badge grey">{ins.category}</span>
              </div>
            </div>
            <div className="sev-wrap"><div className="sev">{ins.severity_score}</div><div className="lbl">severity</div></div>
          </div>
          {ins.representative_quotes?.map((q, j) => (
            <div className="quote" key={j}>{q.text}<span className="meta">— {q.source} · {q.region} · ★{q.rating || "—"}</span></div>
          ))}
        </div>
      ))}
    </>
  );
}
