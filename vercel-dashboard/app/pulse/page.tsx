"use client";
import { getEngine, NA } from "@/lib/data";
import { Metric, Card, Tag, useJSON } from "../components/ui";

export default function Pulse() {
  const e = useJSON(getEngine);
  if (!e) return <p className="muted">Loading…</p>;
  const wp = e.weekly_pulse;

  if (!wp || wp.note || !wp.key_trends) {
    return (
      <>
        <h1>Weekly Pulse</h1>
        <p className="page-sub">Executive PM summary of the latest period.</p>
        <div className="note">Trend unavailable from frozen dataset.</div>
        {wp?.note && <p className="na">{wp.note}</p>}
      </>
    );
  }

  const kt = wp.key_trends;
  const rr = wp.recommendation_system_risk!;
  const probDelta = (kt.problem_rate - kt.problem_rate_prev) * 100;
  const topRising = (wp.rising_issues || []).filter((r) => r.delta_vs_prev > 0)
    .sort((a, b) => b.delta_vs_prev - a.delta_vs_prev)[0];

  return (
    <>
      <h1>Weekly Pulse</h1>
      <p className="page-sub">
        Executive summary — latest period <b>{wp.current_period}</b> vs <b>{wp.prior_period}</b>.
        Review timestamps are daily/monthly, so this is a period-over-period (monthly) pulse.
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

      <Tag>What changed / what to watch</Tag>
      <div className="card">
        <p className="lead" style={{ margin: 0 }}>
          Recommendation-system risk (repetition + mismatch share) moved{" "}
          <b style={{ color: rr.direction === "up" ? "var(--red)" : "var(--green)" }}>{rr.direction}</b>{" "}
          to {(rr.current * 100).toFixed(0)}% of reviews.{" "}
          {topRising
            ? <>Fastest-rising issue: <b>{topRising.issue.replace(/_/g, " ")}</b> (+{(topRising.delta_vs_prev * 100).toFixed(1)} pts vs prior period) — watch this next cycle.</>
            : <>No issue category rose materially vs the prior period.</>}
        </p>
      </div>

      <Tag>Rising issues (share Δ vs prior period)</Tag>
      <Card>
        <table>
          <thead><tr><th>Issue</th><th className="num">Current share</th><th className="num">Δ vs prev</th></tr></thead>
          <tbody>
            {(wp.rising_issues || []).map((r, i) => (
              <tr key={i}><td>{r.issue.replace(/_/g, " ")}</td>
                <td className="num">{(r.current_share * 100).toFixed(1)}%</td>
                <td className="num" style={{ color: r.delta_vs_prev >= 0 ? "#e64a4a" : "#1db954" }}>
                  {r.delta_vs_prev >= 0 ? "+" : ""}{(r.delta_vs_prev * 100).toFixed(1)}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Tag>Notable quotes</Tag>
      <Card>
        {(wp.notable_discoveries || []).length === 0 && <span className="na">{NA}</span>}
        {(wp.notable_discoveries || []).map((n, i) => (
          <div className="quote" key={i}>{n.text}<span className="meta">— {n.region}</span></div>
        ))}
      </Card>
    </>
  );
}
