"use client";
import { getEngine, getExtra, NA } from "@/lib/data";
import { Metric, Card, BarList, Histogram, Tag, useJSON } from "../components/ui";

const FRICTION_ORDER = ["0-20", "20-40", "40-60", "60-80", "80-100"];
// vibrant palette reused across the combined Theme Intelligence block
const PAL = ["#1db954", "#4a9ee6", "#e6b34a", "#b18cf2", "#e6843a", "#3ec6c6"];
const fricColor = (v: number) => (v >= 80 ? "#e64a4a" : v >= 65 ? "#e6b34a" : "#1db954");

export default function Lens() {
  const e = useJSON(getEngine);
  const x = useJSON(getExtra);
  if (!x) return <p className="muted">Loading…</p>;
  const f = x.friction, j = x.journey, em = x.emotion;

  const fricDist: [string, number][] = FRICTION_ORDER
    .filter((k) => f.distribution[k] !== undefined)
    .map((k) => [k, f.distribution[k]]);
  const byCat: [string, number][] = Object.entries(f.by_category)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => [k.replace(/_/g, " "), v]);
  const journeyDist: [string, number][] = Object.entries(j.distribution)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]);
  const emoDist: [string, number][] = Object.entries(em.distribution)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]);

  // --- combined Theme Intelligence data (folded in from the old Themes page) ---
  const td = e?.theme_detection;
  const problems = td?.top_discovery_problems ?? [];
  const complaints = td?.top_recommendation_complaints ?? [];
  const needs = td?.top_unmet_needs ?? [];
  const desired = x?.desired_discovery_types ?? [];
  const features = x?.feature_frustration_map ?? [];
  const maxNeed = Math.max(...needs.map((n) => n?.evidence_count ?? 0), 1);

  const ClusterList = ({ rows }: { rows: { size: number; top_terms: string[] }[] }) =>
    rows.length === 0 ? <span className="na">{NA}</span> : (
      <div className="ti-clusters">
        {rows.slice(0, 5).map((c, i) => (
          <div className="ti-cluster" key={i} style={{ borderLeftColor: PAL[i % PAL.length] }}>
            <div className="ti-cluster-top">
              <b>{(c?.top_terms ?? []).slice(0, 2).join(" · ") || `Theme ${i + 1}`}</b>
              <span className="ti-size" style={{ color: PAL[i % PAL.length] }}>{(c?.size ?? 0).toLocaleString()}</span>
            </div>
            <div className="ti-terms">
              {(c?.top_terms ?? []).slice(2, 8).map((term) => (
                <span className="ti-chip" key={term} style={{ borderColor: `${PAL[i % PAL.length]}44` }}>{term}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <>
      <h1>Discovery Lens</h1>
      <p className="page-sub">Derived heuristic signals that explain <b>why users struggle to discover
        new music</b>, <b>what causes repeat listening</b>, <b>whether mood/context is understood</b>,
        and <b>how users feel when recommendations go stale</b> — via a Discovery Friction Score,
        Journey Stage classification, and Emotion Detection. Transparent, keyword/category-based (no ML).</p>

      <Tag>Why This Lens Matters</Tag>
      <div className="why-grid">
        <div className="why-card" style={{ ["--wc" as any]: "#1db954" }}>
          <div className="why-ic">🔗</div>
          <h3>Auditable Insight Chain</h3>
          <p>Key findings are grounded in review evidence, confidence signals, and dissenting user
            quotes — not black-box AI summaries.</p>
        </div>
        <div className="why-card" style={{ ["--wc" as any]: "#4a9ee6" }}>
          <div className="why-ic">⚖️</div>
          <h3>Tension Detection</h3>
          <p>The engine highlights where users disagree, such as wanting more novelty while also
            rejecting recommendations that feel too unfamiliar.</p>
        </div>
        <div className="why-card" style={{ ["--wc" as any]: "#b18cf2" }}>
          <div className="why-ic">📊</div>
          <h3>Failure Quantification</h3>
          <p>Discovery friction is converted into measurable signals using repetition, mismatch,
            frustration, and control-related review patterns.</p>
        </div>
      </div>

      <Tag>Discovery Friction Score</Tag>
      <div className="grid cards">
        <Metric label="Average friction (0–100)" value={f.average} />
        <Metric label="High-friction reviews (≥60)"
          value={((f.distribution["60-80"] || 0) + (f.distribution["80-100"] || 0)).toLocaleString()} />
      </div>
      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <Card title="Friction score distribution"><Histogram data={fricDist} /></Card>
        <Card title="Average friction by category"><BarList data={byCat} fmt={(v) => v.toFixed(0)} /></Card>
      </div>
      <div className="note">{f.explanation}</div>
      <Card title="Top high-friction themes">
        <div className="fric-themes">
          {f.top_high_friction_themes.map((t, i) => {
            const c = fricColor(t.avg_friction);
            return (
              <div className="ft-row" key={i}>
                <span className="ft-name">{t.theme}</span>
                <div className="ft-track"><div className="ft-fill" style={{ width: `${Math.min(100, t.avg_friction)}%`, background: c }} /></div>
                <span className="ft-val" style={{ color: c }}>{t.avg_friction}</span>
                <span className="ft-rev">{t.count.toLocaleString()} reviews</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Tag>Journey Stage Classification {j.heuristic && <span className="badge grey">heuristic</span>}</Tag>
      <div className="grid cols-2">
        <Card title="Journey stage distribution"><BarList data={journeyDist} /></Card>
        <Card title="Most painful stage">
          <div className="metric"><div className="value" style={{ color: "var(--red)" }}>
            {j.most_painful_stage || NA}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>highest average friction among mapped stages</div>
          </div>
          <div style={{ marginTop: 12 }}>
            {Object.entries(j.implications).filter(([k]) => k !== "Unmapped").map(([k, v]) => (
              <div key={k} style={{ marginBottom: 8, fontSize: 12.5 }}>
                <b style={{ color: "var(--green)" }}>{k}:</b> <span className="muted">{v}</span></div>
            ))}
          </div>
        </Card>
      </div>

      <Tag>Emotion Detection {em.heuristic && <span className="badge grey">heuristic</span>}</Tag>
      <div className="grid cols-2">
        <Card title="Emotion distribution"><BarList data={emoDist} /></Card>
        <Card title="Quotes for strongest emotions">
          {emoDist.slice(0, 4).map(([emo]) => em.quotes[emo] && (
            <div className="quote" key={emo} style={{ fontSize: 13 }}>
              <span style={{ color: "var(--green)", fontStyle: "normal", fontWeight: 700 }}>{emo}: </span>
              {em.quotes[emo].text.slice(0, 150)}…
              <span className="meta">— {em.quotes[emo].source} · {em.quotes[emo].region}</span>
            </div>
          ))}
        </Card>
      </div>
      <div className="note">{em.explanation}</div>

      {/* ===== Theme Intelligence — folded in, vibrant colour-coded insights ===== */}
      <Tag>Theme Intelligence · what the scraped reviews reveal</Tag>
      <div className="grid cols-2">
        <Card title="🟢 Top discovery problems"><ClusterList rows={problems} /></Card>
        <Card title="🔴 Recommendation frustrations"><ClusterList rows={complaints} /></Card>
      </div>

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <Card title="🟡 Biggest unmet needs">
          {needs.length === 0 ? <span className="na">{NA}</span> : (
            <div className="ti-bars">
              {needs.slice(0, 6).map((n, i) => {
                const c = PAL[i % PAL.length], v = n?.evidence_count ?? 0;
                return (
                  <div className="ti-bar" key={i}>
                    <span className="ti-bar-name">{String(n?.need ?? "").replace(/_/g, " ")}</span>
                    <div className="ti-bar-track"><div className="ti-bar-fill" style={{ width: `${(v / maxNeed) * 100}%`, background: c }} /></div>
                    <span className="ti-bar-val" style={{ color: c }}>{v.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card title="🔵 What new music users want">
          {desired.length === 0 ? <span className="na">{NA}</span> : (
            <div className="ti-want">
              {desired.map((d, i) => {
                const c = PAL[i % PAL.length];
                return (
                  <div className="ti-want-card" key={i} style={{ borderColor: `${c}55`, background: `${c}12` }}>
                    <div className="ti-want-type">{d?.type ?? NA}</div>
                    <div className="ti-want-ev" style={{ color: c }}>
                      {typeof d?.evidence === "number" ? `${d.evidence.toLocaleString()} mentions` : "emerging signal"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Tag>Feature Frustration Map</Tag>
      <Card>
        {features.length === 0 ? <span className="na">{NA}</span> : (
          <div className="ti-feats">
            {features.map((ft, i) => {
              const enough = ft?.evidence !== "Not enough evidence";
              const fr = ft?.frustration_rate ?? 0;
              const c = fr > 0.6 ? "#e64a4a" : fr > 0.4 ? "#e6843a" : "#e6b34a";
              return (
                <div className="ti-feat" key={i} style={{ borderTopColor: enough ? c : "var(--border)" }}>
                  <div className="ti-feat-top">
                    <b>{ft?.feature ?? NA}</b>
                    {enough && <span className="ti-feat-fr" style={{ color: c, background: `${c}22`, borderColor: `${c}55` }}>{(fr * 100).toFixed(0)}% frustrated</span>}
                  </div>
                  <div className="ti-feat-meta">{enough ? `${(ft?.mentions ?? 0).toLocaleString()} mentions` : "Not enough evidence"}</div>
                  {enough && ft?.quote?.text && <div className="ti-feat-q">“{ft.quote.text.slice(0, 120)}…”</div>}
                </div>
              );
            })}
          </div>
        )}
        <div className="note">Frustration % = share of mentions tagged as a discovery problem
          (discovery_issue / repetition_issue / algorithm_mismatch). Features below the evidence
          threshold show “Not enough evidence”.</div>
      </Card>
    </>
  );
}
