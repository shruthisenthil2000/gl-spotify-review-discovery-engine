"use client";
import { getEngine, NA } from "@/lib/data";
import { Metric, Card, useJSON } from "../components/ui";

export default function Pulse() {
  const e = useJSON(getEngine);
  if (!e) return <p className="muted">Loading…</p>;
  const wp = e.weekly_pulse;
  if (!wp || wp.note) return (
    <><h1>Weekly Pulse</h1><p className="na">{wp?.note || NA}</p></>
  );
  const kt = wp.key_trends!;
  const rr = wp.recommendation_system_risk!;
  const probDelta = ((kt.problem_rate - kt.problem_rate_prev) * 100);

  return (
    <>
      <h1>Weekly Pulse</h1>
      <p className="page-sub">
        Latest period <b>{wp.current_period}</b> vs <b>{wp.prior_period}</b> —
        monthly granularity (review timestamps are daily/monthly).
      </p>

      <div className="grid cards">
        <Metric label="Review volume" value={kt.review_volume.toLocaleString()}
          delta={`${kt.volume_delta_vs_prev >= 0 ? "+" : ""}${kt.volume_delta_vs_prev}`}
          dir={kt.volume_delta_vs_prev >= 0 ? "up" : "down"} />
        <Metric label="Problem rate" value={`${(kt.problem_rate * 100).toFixed(0)}%`}
          delta={`${probDelta >= 0 ? "+" : ""}${probDelta.toFixed(1)} pts`}
          dir={probDelta <= 0 ? "up" : "down"} />
        <Metric label="Rec-system risk" value={`${(rr.current * 100).toFixed(0)}%`}
          delta={rr.direction} dir={rr.direction === "up" ? "down" : "up"} />
        <Metric label="Prior risk" value={`${(rr.prior * 100).toFixed(0)}%`} />
      </div>

      <h2>Rising issues (share Δ vs prior period)</h2>
      <Card>
        <table>
          <thead><tr><th>Issue</th><th className="num">Current share</th><th className="num">Δ vs prev</th></tr></thead>
          <tbody>
            {(wp.rising_issues || []).map((r, i) => (
              <tr key={i}>
                <td>{r.issue.replace(/_/g, " ")}</td>
                <td className="num">{(r.current_share * 100).toFixed(1)}%</td>
                <td className="num" style={{ color: r.delta_vs_prev >= 0 ? "#e64a4a" : "#1db954" }}>
                  {r.delta_vs_prev >= 0 ? "+" : ""}{(r.delta_vs_prev * 100).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <h2>Notable discoveries (positive signal)</h2>
      <Card>
        {(wp.notable_discoveries || []).length === 0 && <span className="na">{NA}</span>}
        {(wp.notable_discoveries || []).map((n, i) => (
          <div className="quote" key={i}>{n.text}<span className="meta">— {n.region}</span></div>
        ))}
      </Card>
    </>
  );
}
