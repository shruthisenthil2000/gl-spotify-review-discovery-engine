"use client";
import { getEngine, NA } from "@/lib/data";
import { Card, BarList, SegTable, useJSON } from "../components/ui";

export default function Segments() {
  const e = useJSON(getEngine);
  if (!e) return <p className="muted">Loading…</p>;
  const sg = e.segmentation;
  if (!sg) return <p className="na">{NA}</p>;
  const ent = (o: Record<string, any>) => Object.entries(o || {});

  return (
    <>
      <h1>User Segmentation</h1>
      <p className="page-sub">Which cohorts are most affected by repetition & discovery issues.</p>

      <Card title="By platform"><SegTable rows={ent(sg.by_platform)} /></Card>
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Card title="By region"><SegTable rows={ent(sg.by_region)} /></Card>
        <Card title="By language"><SegTable rows={ent(sg.by_language)} /></Card>
      </div>
      <Card title="By user type"><div style={{ marginTop: 4 }}><SegTable rows={ent(sg.by_user_type)} /></div></Card>

      <h2>Most affected by repetition</h2>
      <Card>
        <BarList
          data={(sg.most_affected_by_repetition || []).map((c) => [c.cohort, c.repetition_rate] as [string, number])}
          fmt={(v) => `${(v * 100).toFixed(1)}%`}
        />
      </Card>
    </>
  );
}
