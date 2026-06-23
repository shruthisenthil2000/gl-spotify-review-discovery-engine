"use client";
import { getExtra, NA } from "@/lib/data";
import { Metric, Card, BarList, Histogram, Tag, useJSON } from "../components/ui";

const FRICTION_ORDER = ["0-20", "20-40", "40-60", "60-80", "80-100"];

export default function Lens() {
  const x = useJSON(getExtra);
  if (!x) return <p className="muted">Loading…</p>;
  const f = x.friction, j = x.journey, em = x.emotion;

  const fricDist: [string, number][] = FRICTION_ORDER
    .filter((k) => f.distribution[k] !== undefined)
    .map((k) => [k, f.distribution[k]]);
  const byCat: [string, number][] = Object.entries(f.by_category)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => [k.replace(/_/g, " "), v]);
  const journeyDist: [string, number][] = Object.entries(j.distribution)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]);
  const emoDist: [string, number][] = Object.entries(em.distribution)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]);

  return (
    <>
      <h1>Discovery Lens</h1>
      <p className="page-sub">Derived heuristic signals that explain <b>why users struggle to discover
        new music</b>, <b>what causes repeat listening</b>, <b>whether mood/context is understood</b>,
        and <b>how users feel when recommendations go stale</b> — via a Discovery Friction Score,
        Journey Stage classification, and Emotion Detection. Transparent, keyword/category-based (no ML).</p>

      <Tag>Discovery Friction Score</Tag>
      <div className="grid cards">
        <Metric label="Average friction (0–100)" value={f.average} />
        <Metric label="High-friction reviews (≥60)"
          value={((f.distribution["60-80"] || 0) + (f.distribution["80-100"] || 0)).toLocaleString()} />
      </div>
      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <Card title="Friction score distribution"><Histogram data={fricDist} /></Card>
        <Card title="Average friction by category"><BarList data={byCat} fmt={(v) => v.toFixed(0)} /></Card>
      </div>
      <div className="note">{f.explanation}</div>
      <Card title="Top high-friction themes">
        <table><thead><tr><th>Theme</th><th className="num">Avg friction</th><th className="num">Reviews</th></tr></thead>
          <tbody>{f.top_high_friction_themes.map((t, i) => (
            <tr key={i}><td>{t.theme}</td><td className="num">{t.avg_friction}</td><td className="num">{t.count.toLocaleString()}</td></tr>
          ))}</tbody></table>
      </Card>

      <Tag>Journey Stage Classification {j.heuristic && <span className="badge grey">heuristic</span>}</Tag>
      <div className="grid cols-2">
        <Card title="Journey stage distribution"><BarList data={journeyDist} /></Card>
        <Card title="Most painful stage">
          <div className="metric"><div className="value" style={{ color: "var(--red)" }}>
            {j.most_painful_stage || NA}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>highest average friction among mapped stages</div>
          </div>
          <div style={{ marginTop: 12 }}>
            {Object.entries(j.implications).filter(([k]) => k !== "Unmapped").map(([k, v]) => (
              <div key={k} style={{ marginBottom: 8, fontSize: 12.5 }}>
                <b style={{ color: "var(--green)" }}>{k}:</b> <span className="muted">{v}</span></div>
            ))}
          </div>
        </Card>
      </div>

      <Tag>Emotion Detection {em.heuristic && <span className="badge grey">heuristic</span>}</Tag>
      <div className="grid cols-2">
        <Card title="Emotion distribution"><BarList data={emoDist} /></Card>
        <Card title="Quotes for strongest emotions">
          {emoDist.slice(0, 4).map(([emo]) => em.quotes[emo] && (
            <div className="quote" key={emo} style={{ fontSize: 13 }}>
              <span style={{ color: "var(--green)", fontStyle: "normal", fontWeight: 700 }}>{emo}: </span>
              {em.quotes[emo].text.slice(0, 150)}…
              <span className="meta">— {em.quotes[emo].source} · {em.quotes[emo].region}</span>
            </div>
          ))}
        </Card>
      </div>
      <div className="note">{em.explanation}</div>
    </>
  );
}
