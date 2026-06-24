"use client";
import React from "react";
import { NA } from "@/lib/data";

export function Metric({ label, value, delta, dir }:
  { label: string; value: React.ReactNode; delta?: string; dir?: "up" | "down" }) {
  return (
    <div className="card metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta !== undefined && <div className={`delta ${dir || ""}`}>{delta}</div>}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return <div className="card">{title && <h2 style={{ marginTop: 0 }}>{title}</h2>}{children}</div>;
}

// Horizontal bar list from a {name: value} map or array of [name, value].
export function BarList({ data, max, fmt }:
  { data: [string, number][]; max?: number; fmt?: (n: number) => string }) {
  if (!data || data.length === 0) return <div className="na">{NA}</div>;
  const m = max ?? Math.max(...data.map((d) => d[1]), 1);
  return (
    <div>
      {data.map(([name, val]) => (
        <div className="bar-row" key={name}>
          <div className="name" title={name}>{name}</div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(val / m) * 100}%` }} /></div>
          <div className="num">{fmt ? fmt(val) : val.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

// Minimal multi-series line chart (SVG).
export function LineChart({ labels, series, height = 220 }:
  { labels: string[]; series: { name: string; color: string; values: number[] }[]; height?: number }) {
  if (!labels || labels.length === 0) return <div className="na">{NA}</div>;
  const w = 760, h = height, pad = 34;
  const allVals = series.flatMap((s) => s.values);
  const maxY = Math.max(...allVals, 0.01);
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(labels.length - 1, 1);
  const y = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%" }}>
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#333" />
        {series.map((s) => (
          <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2"
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
        ))}
        {labels.map((l, i) => (i % Math.ceil(labels.length / 8) === 0) && (
          <text key={l} x={x(i)} y={h - pad + 14} fill="#777" fontSize="9" textAnchor="middle">{l}</text>
        ))}
      </svg>
      <div className="chart-legend">
        {series.map((s) => <span key={s.name} style={{ color: s.color }}>{s.name}</span>)}
      </div>
    </div>
  );
}

// Scatter for the priority radar: x = frequency, y = impact.
export function Scatter({ points, height = 320 }:
  { points: { x: number; y: number; r: number; label: string; color: string }[]; height?: number }) {
  if (!points || points.length === 0) return <div className="na">{NA}</div>;
  const w = 760, h = height, pad = 44;
  const maxX = Math.max(...points.map((p) => p.x), 1);
  const maxY = 100;
  const sx = (v: number) => pad + (Math.log1p(v) / Math.log1p(maxX)) * (w - pad * 2);
  const sy = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%" }}>
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad} y1={sy(g)} x2={w - pad} y2={sy(g)} stroke="#222" />
            <text x={pad - 8} y={sy(g) + 3} fill="#8a8a8a" fontSize="10" textAnchor="end">{g}</text>
          </g>
        ))}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#444" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#444" />
        <text x={w / 2} y={h - 10} fill="#bdbdbd" fontSize="12.5" fontWeight="600" textAnchor="middle">Frequency — how often mentioned →</text>
        <text x={16} y={h / 2} fill="#bdbdbd" fontSize="12.5" fontWeight="600" textAnchor="middle" transform={`rotate(-90 16 ${h / 2})`}>Impact — severity →</text>
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={11} fill={p.color} fillOpacity="0.92" stroke="#0a0a0a" strokeWidth="1.5" />
            <text x={sx(p.x)} y={sy(p.y) + 4} fill="#fff" fontSize="11" fontWeight="800" textAnchor="middle">{i + 1}</text>
          </g>
        ))}
      </svg>
      <div className="scatter-legend">
        {points.map((p, i) => (
          <span className="sl-item" key={i}>
            <span className="sl-dot" style={{ background: p.color }}>{i + 1}</span>{p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SegTable({ rows }: { rows: [string, any][] }) {
  if (!rows || rows.length === 0) return <div className="na">{NA}</div>;
  return (
    <table>
      <thead><tr>
        <th>Segment</th><th className="num">Total</th><th className="num">Repetition</th>
        <th className="num">Discovery issue</th><th className="num">Problem</th><th className="num">Positive</th>
      </tr></thead>
      <tbody>
        {rows.map(([name, r]) => (
          <tr key={name}>
            <td>{name}</td>
            <td className="num">{r.total?.toLocaleString() ?? NA}</td>
            <td className="num">{pctCell(r.repetition_rate)}</td>
            <td className="num">{pctCell(r.discovery_issue_rate)}</td>
            <td className="num">{pctCell(r.problem_rate)}</td>
            <td className="num">{pctCell(r.positive_rate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function pctCell(v: number | undefined) {
  return v === undefined || v === null ? <span className="na">{NA}</span> : `${(v * 100).toFixed(1)}%`;
}

export function useJSON<T>(loader: () => Promise<T>): T | null {
  const [data, setData] = React.useState<T | null>(null);
  React.useEffect(() => { loader().then(setData).catch(() => setData(null)); }, []);
  return data;
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button className="copy-btn" onClick={() => {
      navigator.clipboard?.writeText(text).then(() => {
        setDone(true); setTimeout(() => setDone(false), 1200);
      });
    }}>{done ? "✓ copied" : "copy quote"}</button>
  );
}

export function Histogram({ data, fmtLabel, colors }:
  { data: [string, number][]; fmtLabel?: (k: string) => string; colors?: string[] }) {
  if (!data || data.length === 0) return <div className="na">{NA}</div>;
  const max = Math.max(...data.map((d) => d[1]), 1);
  return (
    <div className="histo">
      {data.map(([k, v], i) => (
        <div className="col" key={k}>
          <div className="val">{v.toLocaleString()}</div>
          <div className="bar" style={{ height: `${(v / max) * 100}%`, ...(colors ? { background: colors[i % colors.length] } : {}) }} />
          <div className="lab">{fmtLabel ? fmtLabel(k) : k}</div>
        </div>
      ))}
    </div>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <div className="section-tag">{children}</div>;
}

// Donut chart from [label, value, color] tuples.
export function Donut({ data, size = 180, center }:
  { data: [string, number, string][]; size?: number; center?: React.ReactNode }) {
  if (!data || data.length === 0) return <div className="na">{NA}</div>;
  const total = data.reduce((s, d) => s + d[1], 0) || 1;
  const r = size / 2, stroke = size * 0.16, rad = r - stroke / 2, circ = 2 * Math.PI * rad;
  let offset = 0;
  return (
    <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <g transform={`rotate(-90 ${r} ${r})`}>
          {data.map(([label, val, color]) => {
            const frac = val / total, dash = frac * circ;
            const el = (
              <circle key={label} cx={r} cy={r} r={rad} fill="none" stroke={color}
                strokeWidth={stroke} strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset} />
            );
            offset += dash;
            return el;
          })}
        </g>
        {center && <text x={r} y={r} textAnchor="middle" dominantBaseline="central"
          fill="#fff" fontSize={size * 0.16} fontWeight="800">{center}</text>}
      </svg>
      <div style={{ flex: 1, minWidth: 190 }}>
        {data.map(([label, val, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0", fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ color: "var(--muted)", flex: 1, minWidth: 0, paddingRight: 8, lineHeight: 1.35 }}>{label}</span>
            <b style={{ minWidth: 62, textAlign: "right", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{val.toLocaleString()}</b>
            <span className="muted" style={{ fontSize: 11, minWidth: 40, textAlign: "right", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>({((val / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
