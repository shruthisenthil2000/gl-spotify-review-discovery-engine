"use client";
import { getEngine, getExtra, NA } from "@/lib/data";
import { Card, BarList, Tag, useJSON } from "../components/ui";

const REPETITION_NEEDS = new Set([
  "shuffle_repeats_small_pool", "recs_too_narrow_boxed_in", "forced_recs_in_playlist",
]);

export default function Themes() {
  const e = useJSON(getEngine);
  const x = useJSON(getExtra);
  if (!e) return <p className="muted">Loading…</p>;
  const td = e.theme_detection;

  return (
    <>
      <h1>Themes</h1>
      <p className="page-sub">
        The most common discovery pain points, recommendation failures, repetition drivers,
        unmet needs, and which Spotify features frustrate users most — all from review evidence.
      </p>

      <Tag>Top Discovery Problems</Tag>
      <Card>
        <table>
          <thead><tr><th className="num">Reviews</th><th>Cluster (top terms)</th></tr></thead>
          <tbody>
            {td.top_discovery_problems.map((c, i) => (
              <tr key={i}><td className="num">{c.size.toLocaleString()}</td>
                <td>{c.top_terms.slice(0, 6).join(", ")}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Tag>Recommendation Failure Themes</Tag>
      <Card>
        <table>
          <thead><tr><th className="num">Reviews</th><th>Cluster (top terms)</th></tr></thead>
          <tbody>
            {td.top_recommendation_complaints.map((c, i) => (
              <tr key={i}><td className="num">{c.size.toLocaleString()}</td>
                <td>{c.top_terms.slice(0, 6).join(", ")}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Tag>Repetition Drivers</Tag>
      <Card>
        <BarList
          data={td.top_unmet_needs.filter((n) => REPETITION_NEEDS.has(n.need))
            .map((n) => [n.need.replace(/_/g, " "), n.evidence_count] as [string, number])}
        />
      </Card>

      <Tag>Unmet Needs (evidence count)</Tag>
      <Card>
        <BarList data={td.top_unmet_needs.map((n) =>
          [n.need.replace(/_/g, " "), n.evidence_count] as [string, number])} />
      </Card>

      <Tag>Feature Frustration Map</Tag>
      <Card>
        {!x ? <span className="na">Loading…</span> : (
          <table>
            <thead><tr>
              <th>Feature</th><th className="num">Mentions</th>
              <th className="num">Frustration</th><th>Representative quote</th>
            </tr></thead>
            <tbody>
              {x.feature_frustration_map.map((f, i) => (
                <tr key={i}>
                  <td><b>{f.feature}</b></td>
                  {f.evidence === "Not enough evidence" ? (
                    <><td className="num">{f.mentions}</td>
                      <td colSpan={2} className="na">Not enough evidence</td></>
                  ) : (
                    <>
                      <td className="num">{f.mentions.toLocaleString()}</td>
                      <td className="num" style={{ color: (f.frustration_rate ?? 0) > 0.6 ? "#e64a4a" : "#e6b34a" }}>
                        {((f.frustration_rate ?? 0) * 100).toFixed(0)}%
                      </td>
                      <td style={{ maxWidth: 360, color: "#cfcfcf", fontStyle: "italic" }}>
                        {f.quote ? `“${f.quote.text.slice(0, 130)}…”` : <span className="na">{NA}</span>}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="note">Frustration % = share of mentions tagged as a discovery problem
          (discovery_issue / repetition_issue / algorithm_mismatch). Features below the evidence
          threshold show “Not enough evidence”.</div>
      </Card>
    </>
  );
}
