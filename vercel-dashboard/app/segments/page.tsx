"use client";
import { getEngine, getExtra, NA } from "@/lib/data";
import { Card, BarList, SegTable, Tag, useJSON } from "../components/ui";

export default function Segments() {
  const e = useJSON(getEngine);
  const x = useJSON(getExtra);
  if (!e) return <p className="muted">Loading…</p>;
  const sg = e.segmentation;
  const ent = (o: Record<string, any>) => Object.entries(o || {});

  return (
    <>
      <h1>Segments</h1>
      <p className="page-sub">
        Which users are most affected, and how discovery problems differ across cohorts.
      </p>

      <Tag>Segment cards</Tag>
      {!x ? <p className="na">Loading…</p> : (
        <div className="card-grid">
          {x.segment_cards.map((s) => (
            <div className="scard" key={s.segment}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>{s.segment}</h3>
                {s.heuristic && <span className="badge grey">heuristic segment</span>}
              </div>
              <div className="row"><span className="k">Reviews</span><span>{s.total.toLocaleString()}</span></div>
              <div className="row"><span className="k">Repetition rate</span><span>{(s.repetition_rate * 100).toFixed(1)}%</span></div>
              <div className="row"><span className="k">Problem rate</span><span>{(s.problem_rate * 100).toFixed(1)}%</span></div>
              <div className="row"><span className="k">Top pain point</span><span>{s.top_pain_point}</span></div>
              {s.quote && <div className="quote" style={{ margin: "10px 0 0", fontSize: 12.5 }}>
                {s.quote.text.slice(0, 150)}…<span className="meta">— {s.quote.source} · {s.quote.region}</span></div>}
              <div className="impl"><b>Product implication:</b> {s.product_implication}</div>
            </div>
          ))}
        </div>
      )}

      <Tag>By platform</Tag>
      <Card><SegTable rows={ent(sg.by_platform)} /></Card>
      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <Card title="By region"><SegTable rows={ent(sg.by_region)} /></Card>
        <Card title="By language"><SegTable rows={ent(sg.by_language)} /></Card>
      </div>

      <Tag>Most affected by repetition</Tag>
      <Card>
        <BarList data={(sg.most_affected_by_repetition || []).map((c) =>
          [c.cohort, c.repetition_rate] as [string, number])} fmt={(v) => `${(v * 100).toFixed(1)}%`} />
      </Card>
    </>
  );
}
