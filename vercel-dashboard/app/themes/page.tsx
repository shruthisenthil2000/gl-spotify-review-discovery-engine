"use client";
import { getEngine, getExtra, NA } from "@/lib/data";
import { Card, BarList, Tag, useJSON } from "../components/ui";

const REPETITION_NEEDS = new Set([
  "shuffle_repeats_small_pool", "recs_too_narrow_boxed_in", "forced_recs_in_playlist",
]);

export default function Themes() {
  const e = useJSON(getEngine);
  const x = useJSON(getExtra);
  if (!e && !x) return <p className="muted">Loading…</p>;

  // Safe fallbacks everywhere — never crash on a missing key/array.
  const td = e?.theme_detection;
  const problems = td?.top_discovery_problems ?? [];
  const complaints = td?.top_recommendation_complaints ?? [];
  const needs = td?.top_unmet_needs ?? [];
  const desired = x?.desired_discovery_types ?? [];
  const features = x?.feature_frustration_map ?? [];

  const clusterTable = (rows: { size: number; top_terms: string[] }[]) =>
    rows.length === 0 ? <span className="na">{NA}</span> : (
      <table>
        <thead><tr><th className="num">Reviews</th><th>Cluster (top terms)</th></tr></thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={i}>
              <td className="num">{(c?.size ?? 0).toLocaleString()}</td>
              <td>{(c?.top_terms ?? []).slice(0, 6).join(", ") || NA}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  return (
    <>
      <h1>Themes</h1>
      <p className="page-sub">
        The most common discovery pain points, recommendation frustrations, repetition drivers,
        unmet needs, the features that frustrate users most, and the kinds of new music users want.
      </p>

      <Tag>Top Discovery Problems</Tag>
      <Card>{clusterTable(problems)}</Card>

      <Tag>Recommendation Frustrations</Tag>
      <Card>{clusterTable(complaints)}</Card>

      <Tag>Repetition Drivers</Tag>
      <Card>
        <BarList data={needs.filter((n) => REPETITION_NEEDS.has(n?.need))
          .map((n) => [String(n?.need ?? "").replace(/_/g, " "), n?.evidence_count ?? 0] as [string, number])} />
      </Card>

      <Tag>Unmet Needs (evidence count)</Tag>
      <Card>
        <BarList data={needs.map((n) =>
          [String(n?.need ?? "").replace(/_/g, " "), n?.evidence_count ?? 0] as [string, number])} />
      </Card>

      <Tag>Desired Discovery Types — what new music users want</Tag>
      <Card>
        {desired.length === 0 ? <span className="na">{NA}</span> : (
          <table>
            <thead><tr><th>Discovery type</th><th className="num">Evidence</th></tr></thead>
            <tbody>
              {desired.map((d, i) => (
                <tr key={i}>
                  <td>{d?.type ?? NA}</td>
                  <td className="num">{typeof d?.evidence === "number"
                    ? d.evidence.toLocaleString()
                    : <span className="na">Not enough evidence</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Tag>Feature Frustration Map</Tag>
      <Card>
        {features.length === 0 ? <span className="na">{NA}</span> : (
          <table>
            <thead><tr>
              <th>Feature</th><th className="num">Mentions</th>
              <th className="num">Frustration</th><th>Representative quote</th>
            </tr></thead>
            <tbody>
              {features.map((f, i) => {
                const enough = f?.evidence !== "Not enough evidence";
                return (
                  <tr key={i}>
                    <td><b>{f?.feature ?? NA}</b></td>
                    {!enough ? (
                      <><td className="num">{f?.mentions ?? 0}</td>
                        <td colSpan={2} className="na">Not enough evidence</td></>
                    ) : (
                      <>
                        <td className="num">{(f?.mentions ?? 0).toLocaleString()}</td>
                        <td className="num" style={{ color: (f?.frustration_rate ?? 0) > 0.6 ? "#e64a4a" : "#e6b34a" }}>
                          {((f?.frustration_rate ?? 0) * 100).toFixed(0)}%
                        </td>
                        <td style={{ maxWidth: 360, color: "#cfcfcf", fontStyle: "italic" }}>
                          {f?.quote?.text ? `“${f.quote.text.slice(0, 130)}…”` : <span className="na">{NA}</span>}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
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
