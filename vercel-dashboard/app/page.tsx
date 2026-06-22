"use client";
import { getSummary, num, pct, NA } from "@/lib/data";
import { Metric, Card, BarList, LineChart, useJSON } from "./components/ui";

export default function Overview() {
  const s = useJSON(getSummary);
  if (!s) return <p className="muted">Loading…</p>;
  const a = s.review_analytics || {};
  const net = s.sentiment_distribution?.net_sentiment;

  const cats: [string, number][] = Object.entries(s.by_category || {})
    .sort((x, y) => y[1] - x[1]);
  const sent: [string, number][] = ["positive", "neutral", "frustrated"]
    .filter((k) => s.by_sentiment?.[k] !== undefined)
    .map((k) => [k, s.by_sentiment[k]]);
  const trend = s.trend || [];

  return (
    <>
      <h1>Review Analytics</h1>
      <p className="page-sub">Overview of the frozen discovery dataset.</p>

      <div className="grid cards">
        <Metric label="Total reviews" value={num(a.total_reviews)} />
        <Metric label="Discovery issue" value={num(a.discovery_issue)} />
        <Metric label="Repetition issue" value={num(a.repetition_issue)} />
        <Metric label="Algorithm mismatch" value={num(a.algorithm_mismatch)} />
        <Metric label="Discovery positive" value={num(a.discovery_positive)} />
      </div>
      <div className="grid cards" style={{ marginTop: 14 }}>
        <Metric label="Problem reviews" value={num(a.problem_reviews)}
          delta={pct(a.problem_rate)} />
        <Metric label="Net sentiment" value={net === undefined ? NA : net.toFixed(2)}
          dir={net && net >= 0 ? "up" : "down"} />
        <Metric label="Discovery-specific" value={num(s.totals?.discovery_specific)} />
        <Metric label="Adjacent signal" value={num(s.totals?.adjacent_signal)} />
      </div>

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <Card title="Category mix"><BarList data={cats} /></Card>
        <Card title="Sentiment distribution"><BarList data={sent} /></Card>
      </div>

      <h2>Trend tracking (monthly)</h2>
      <Card>
        <LineChart
          labels={trend.map((t) => t.month)}
          series={[
            { name: "problem rate", color: "#e64a4a", values: trend.map((t) => t.problem_rate) },
            { name: "repetition rate", color: "#e6b34a", values: trend.map((t) => t.repetition_rate) },
            { name: "positive rate", color: "#1db954", values: trend.map((t) => t.positive_rate) },
          ]}
        />
      </Card>
      <h2>Monthly review volume</h2>
      <Card>
        <BarList data={trend.map((t) => [t.month, t.reviews] as [string, number])} />
      </Card>
    </>
  );
}
