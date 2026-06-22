"use client";
import { getEngine, NA } from "@/lib/data";
import { Card, BarList, useJSON } from "../components/ui";

export default function Themes() {
  const e = useJSON(getEngine);
  if (!e) return <p className="muted">Loading…</p>;
  const td = e.theme_detection;
  if (!td) return <p className="na">{NA}</p>;

  return (
    <>
      <h1>Theme Detection</h1>
      <p className="page-sub">Auto-extracted clusters, unmet needs, and emerging themes.</p>

      <Card title="Top discovery problems (clusters)">
        <table>
          <thead><tr><th className="num">Size</th><th>Top terms</th></tr></thead>
          <tbody>
            {td.top_discovery_problems.map((c, i) => (
              <tr key={i}><td className="num">{c.size.toLocaleString()}</td>
                <td>{c.top_terms.slice(0, 6).join(", ")}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Card title="Top recommendation complaints">
          <table>
            <thead><tr><th className="num">Size</th><th>Terms</th></tr></thead>
            <tbody>
              {td.top_recommendation_complaints.map((c, i) => (
                <tr key={i}><td className="num">{c.size.toLocaleString()}</td>
                  <td>{c.top_terms.slice(0, 5).join(", ")}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Emerging themes (recent vs prior share)">
          <table>
            <thead><tr><th>Theme</th><th className="num">Recent</th><th className="num">Prior</th><th className="num">Δ</th></tr></thead>
            <tbody>
              {td.emerging_themes.length === 0 && <tr><td colSpan={4} className="na">{NA}</td></tr>}
              {td.emerging_themes.map((t, i) => (
                <tr key={i}><td>{t.theme.replace(/_/g, " ")}</td>
                  <td className="num">{(t.recent_share * 100).toFixed(1)}%</td>
                  <td className="num">{(t.prior_share * 100).toFixed(1)}%</td>
                  <td className="num" style={{ color: t.delta >= 0 ? "#1db954" : "#e64a4a" }}>
                    {t.delta >= 0 ? "+" : ""}{(t.delta * 100).toFixed(1)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <h2>Top unmet needs (evidence count)</h2>
      <Card>
        <BarList data={td.top_unmet_needs.map((n) => [n.need.replace(/_/g, " "), n.evidence_count] as [string, number])} />
      </Card>
    </>
  );
}
