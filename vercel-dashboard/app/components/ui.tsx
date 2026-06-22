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
  const maxR = Math.max(...points.map((p) => p.r), 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%" }}>
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#333" />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#333" />
      <text x={w / 2} y={h - 8} fill="#777" fontSize="11" textAnchor="middle">Frequency (evidence, log) →</text>
      <text x={14} y={h / 2} fill="#777" fontSize="11" textAnchor="middle" transform={`rotate(-90 14 ${h / 2})`}>Impact (severity) →</text>
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={6 + (p.r / maxR) * 16} fill={p.color} fillOpacity="0.6" stroke={p.color} />
          <text x={sx(p.x)} y={sy(p.y) - 12 - (p.r / maxR) * 16} fill="#ccc" fontSize="9" textAnchor="middle">
            {p.label.length > 26 ? p.label.slice(0, 26) + "…" : p.label}
          </text>
        </g>
      ))}
    </svg>
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
