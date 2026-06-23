"use client";
import { useState } from "react";
import { getReviews, PROJECT, NA } from "@/lib/data";
import { useJSON, CopyButton } from "../components/ui";

function badgeClass(cat: string) {
  if (cat === "discovery_positive") return "green";
  if (cat === "repetition_issue" || cat === "algorithm_mismatch") return "red";
  if (cat === "discovery_issue") return "amber";
  return "grey";
}

export default function Reviews() {
  const data = useJSON(getReviews);
  const [src, setSrc] = useState(""); const [cat, setCat] = useState("");
  const [sen, setSen] = useState(""); const [lay, setLay] = useState("");
  const [q, setQ] = useState("");
  if (!data) return <p className="muted">Loading…</p>;

  let rows = data.rows;
  if (src) rows = rows.filter((r) => r.source === src);
  if (cat) rows = rows.filter((r) => r.category === cat);
  if (sen) rows = rows.filter((r) => r.sentiment === sen);
  if (lay) rows = rows.filter((r) => r.layer === lay);
  if (q) rows = rows.filter((r) => r.text.toLowerCase().includes(q.toLowerCase()));

  const sel = (val: string, set: (s: string) => void, opts: string[], label: string,
    fmt?: (o: string) => string) => (
    <select value={val} onChange={(e) => set(e.target.value)}>
      <option value="">{label}</option>
      {opts.map((o) => <option key={o} value={o}>{fmt ? fmt(o) : o}</option>)}
    </select>
  );

  return (
    <>
      <h1>Reviews</h1>
      <p className="page-sub">
        Real user reviews — search and filter a balanced sample of{" "}
        {data.sample_size.toLocaleString()} rows. Aggregate counts elsewhere reflect the
        full dataset of <b>{data.full_total.toLocaleString()}</b> reviews. No reviews are fabricated.
      </p>

      <div className="filters">
        {sel(src, setSrc, data.filters.sources, "All sources", (o) => PROJECT.sourceLabels[o] || o)}
        {sel(cat, setCat, data.filters.categories, "All categories", (o) => o.replace(/_/g, " "))}
        {sel(sen, setSen, data.filters.sentiments, "All sentiment")}
        {sel(lay, setLay, ["discovery_specific", "adjacent_signal"], "All layers", (o) => o.replace(/_/g, " "))}
        <input type="text" placeholder="Search keyword…" value={q}
          onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
      </div>
      <p className="muted" style={{ fontSize: 12 }}>{rows.length.toLocaleString()} matching (showing up to 200)</p>

      {rows.slice(0, 200).map((r) => (
        <div className="review-card" key={r.id}>
          <div className="txt">{r.text}</div>
          <div className="meta">
            <span className={`badge ${badgeClass(r.category)}`}>{r.category.replace(/_/g, " ")}</span>
            <span className="badge grey">{PROJECT.sourceLabels[r.source] || r.source}</span>
            <span className="badge grey">{r.sentiment}</span>
            {r.layer === "adjacent_signal" && <span className="badge grey">adjacent</span>}
            <span className="muted" style={{ fontSize: 12 }}>
              {r.region}{r.lang && r.lang !== "en/unknown" ? ` · ${r.lang}` : ""}
              {r.rating ? ` · ★${r.rating}` : ""}
            </span>
            <span style={{ marginLeft: "auto" }}><CopyButton text={r.text} /></span>
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="na">No reviews match these filters.</p>}
    </>
  );
}
