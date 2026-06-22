"use client";
import { useState } from "react";
import { getReviews, NA } from "@/lib/data";
import { useJSON } from "../components/ui";

export default function Reviews() {
  const data = useJSON(getReviews);
  const [cat, setCat] = useState(""); const [src, setSrc] = useState("");
  const [reg, setReg] = useState(""); const [sen, setSen] = useState("");
  const [q, setQ] = useState("");
  if (!data) return <p className="muted">Loading…</p>;

  let rows = data.rows;
  if (cat) rows = rows.filter((r) => r.category === cat);
  if (src) rows = rows.filter((r) => r.source === src);
  if (reg) rows = rows.filter((r) => r.region === reg);
  if (sen) rows = rows.filter((r) => r.sentiment === sen);
  if (q) rows = rows.filter((r) => r.text.toLowerCase().includes(q.toLowerCase()));

  const sel = (val: string, set: (s: string) => void, opts: string[], label: string) => (
    <select value={val} onChange={(e) => set(e.target.value)}>
      <option value="">{label}</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <>
      <h1>Review Explorer</h1>
      <p className="page-sub">
        Showing a balanced sample of {data.sample_size.toLocaleString()} rows.
        Aggregate counts elsewhere reflect the full dataset of{" "}
        <b>{data.full_total.toLocaleString()}</b> reviews.
      </p>
      <div className="filters">
        {sel(cat, setCat, data.filters.categories, "All categories")}
        {sel(src, setSrc, data.filters.sources, "All sources")}
        {sel(reg, setReg, data.filters.regions, "All regions")}
        {sel(sen, setSen, data.filters.sentiments, "All sentiment")}
        <input type="text" placeholder="Search text…" value={q}
          onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
      </div>
      <p className="muted" style={{ fontSize: 12 }}>{rows.length.toLocaleString()} matching rows (showing up to 400)</p>
      <div className="card" style={{ padding: 0, overflow: "auto", maxHeight: 560 }}>
        <table>
          <thead><tr>
            <th>Source</th><th>Country</th><th>Lang</th><th>Category</th>
            <th>Sentiment</th><th className="num">★</th><th>Review</th>
          </tr></thead>
          <tbody>
            {rows.slice(0, 400).map((r) => (
              <tr key={r.id}>
                <td>{r.source}</td>
                <td>{r.country || <span className="na">{NA}</span>}</td>
                <td>{r.lang}</td>
                <td><span className={`badge ${badgeClass(r.category)}`}>{r.category.replace(/_/g, " ")}</span></td>
                <td>{r.sentiment}</td>
                <td className="num">{r.rating || ""}</td>
                <td style={{ maxWidth: 480, color: "#ddd" }}>{r.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function badgeClass(cat: string) {
  if (cat === "discovery_positive") return "green";
  if (cat === "repetition_issue" || cat === "algorithm_mismatch") return "red";
  if (cat === "discovery_issue") return "amber";
  return "grey";
}
