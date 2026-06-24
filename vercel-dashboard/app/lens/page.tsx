"use client";
import { getEngine, getExtra, NA } from "@/lib/data";
import { Metric, Card, BarList, Histogram, Tag, useJSON } from "../components/ui";

const FRICTION_ORDER = ["0-20", "20-40", "40-60", "60-80", "80-100"];
// vibrant palette reused across the combined Theme Intelligence block
const PAL = ["#1db954", "#4a9ee6", "#e6b34a", "#b18cf2", "#e6843a", "#3ec6c6"];
const fricColor = (v: number) => (v >= 80 ? "#e64a4a" : v >= 65 ? "#e6b34a" : "#1db954");
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function Lens() {
  const e = useJSON(getEngine);
  const x = useJSON(getExtra);
  if (!x) return <p className="muted">Loading…</p>;
  const f = x.friction, j = x.journey, em = x.emotion;

  const fricDist: [string, number][] = FRICTION_ORDER
    .filter((k) => f.distribution[k] !== undefined)
    .map((k) => [k, f.distribution[k]]);
  const byCat: [string, number][] = Object.entries(f.by_category)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => [cap(k.replace(/_/g, " ")), v]);
  const journeyDist: [string, number][] = Object.entries(j.distribution)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => [cap(k), v]);
  const emoDist: [string, number][] = Object.entries(em.distribution)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]); // keep raw key (used for quote lookup)
  const highFriction = (f.distribution["60-80"] || 0) + (f.distribution["80-100"] || 0);

  // --- combined Theme Intelligence data (folded in from the old Themes page) ---
  const td = e?.theme_detection;
  const problems = td?.top_discovery_problems ?? [];
  const complaints = td?.top_recommendation_complaints ?? [];
  const needs = td?.top_unmet_needs ?? [];
  const desired = x?.desired_discovery_types ?? [];
  const features = x?.feature_frustration_map ?? [];
  const maxNeed = Math.max(...needs.map((n) => n?.evidence_count ?? 0), 1);

  // --- conclusion data (grounded in the dataset) ---
  const segs = (x.segment_cards ?? []).slice().sort((a, b) => (b.problem_rate || 0) - (a.problem_rate || 0));
  const negEmo = emoDist.filter(([k]) => k !== "excitement");
  const topNeed = needs[0];

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
      <p className="page-sub wide">Derived heuristic signals that explain <b>why users struggle to discover
        new music</b>, <b>what causes repeat listening</b>, <b>whether mood/context is understood</b>,
        and <b>how users feel when recommendations go stale</b> — via a Discovery Friction Score,
        Journey Stage classification, and Emotion Detection. Transparent, keyword/category-based (no ML).</p>

      <Tag>Discovery Friction Score</Tag>
      <p className="sec-desc">The Discovery Friction Score (0–100) estimates how hard it is to surface
        genuinely <b>new</b> music in a review — higher means more friction. It is built from the review's
        category, repetition and recommendation-mismatch signals, and sentiment (transparent, no ML).</p>
      <div className="grid cards">
        <Metric label="Average friction (0–100)" value={f.average} />
        <Metric label="High-friction reviews (≥60)" value={highFriction.toLocaleString()} />
      </div>
      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <Card title="Friction score distribution">
          <p className="card-desc">How many reviews fall into each friction band.</p>
          <Histogram data={fricDist} />
        </Card>
        <Card title="Average friction by category">
          <p className="card-desc">Average friction (0–100) per review category — higher means harder discovery.</p>
          <div className="ti-bars">
            {byCat.map(([name, v]) => {
              const c = fricColor(v);
              return (
                <div className="ti-bar" key={name}>
                  <span className="ti-bar-name">{name}</span>
                  <div className="ti-bar-track"><div className="ti-bar-fill" style={{ width: `${v}%`, background: c }} /></div>
                  <span className="ti-bar-val" style={{ color: c }}>{v.toFixed(0)}<span className="ti-bar-unit">/100</span></span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      <Card title="Top high-friction themes">
        <p className="card-desc">The review categories carrying the most friction, by average score.</p>
        <div className="fric-themes compact">
          {f.top_high_friction_themes.map((t, i) => {
            const c = fricColor(t.avg_friction);
            return (
              <div className="ft-row" key={i}>
                <span className="ft-name">{cap(t.theme)}</span>
                <div className="ft-track"><div className="ft-fill" style={{ width: `${Math.min(100, t.avg_friction)}%`, background: c }} /></div>
                <span className="ft-val" style={{ color: c }}>{t.avg_friction}</span>
                <span className="ft-rev">{t.count.toLocaleString()} reviews</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Tag>Journey Stage Classification {j.heuristic && <span className="badge grey">heuristic</span>}</Tag>
      <p className="sec-desc">Each review is mapped to the listening-journey stage it describes — from first
        discovery to long-term fatigue — so we can see <b>where in the journey discovery breaks down</b> and
        which stage carries the most friction.</p>
      <div className="grid cols-2">
        <Card title="Journey stage distribution">
          <p className="card-desc">Share of reviews mapped to each stage of the listening journey.</p>
          <BarList data={journeyDist} />
        </Card>
        <Card title="Most painful stage">
          <p className="card-desc">The journey stage with the highest average friction.</p>
          <div className="metric"><div className="value" style={{ color: "var(--red)" }}>
            {cap(j.most_painful_stage || NA)}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>highest average friction among mapped stages</div>
          </div>
          <div style={{ marginTop: 12 }}>
            {Object.entries(j.implications).filter(([k]) => k !== "Unmapped").map(([k, v]) => (
              <div key={k} style={{ marginBottom: 8, fontSize: 12.5 }}>
                <b style={{ color: "var(--green)" }}>{cap(k)}:</b> <span className="muted">{v}</span></div>
            ))}
          </div>
        </Card>
      </div>

      <Tag>Emotion Detection {em.heuristic && <span className="badge grey">heuristic</span>}</Tag>
      <p className="sec-desc">Reviews are scanned for emotional language to show <b>how users feel</b> about
        discovery — frustration and fatigue when it fails, excitement when it works.</p>
      <div className="grid cols-2">
        <Card title="Emotion distribution">
          <p className="card-desc">Count of reviews expressing each emotion.</p>
          <BarList data={emoDist.map(([k, v]) => [cap(k), v] as [string, number])} />
        </Card>
        <Card title="Quotes for strongest emotions">
          <p className="card-desc">Representative review quotes behind the top emotions.</p>
          {emoDist.slice(0, 4).map(([emo], i) => em.quotes[emo] && (
            <div className="emo-quote" key={emo} style={{ borderLeftColor: PAL[i % PAL.length] }}>
              <span className="emo-quote-tag" style={{ color: PAL[i % PAL.length] }}>{cap(emo)}</span>
              <span className="emo-quote-text">{em.quotes[emo].text.slice(0, 150)}…</span>
              <span className="meta">— {em.quotes[emo].source} · {em.quotes[emo].region}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* ===== Theme Intelligence — folded in, vibrant colour-coded insights ===== */}
      <Tag>Theme Intelligence</Tag>
      <p className="sec-desc">Recurring topics mined from the scraped reviews — the specific problems,
        recommendation complaints, unmet needs, and feature pain points that appear <b>most often</b>.</p>
      <div className="grid cols-2">
        <Card title="🟢 Top discovery problems">
          <p className="card-desc">Clusters of reviews where users say they can't surface new music.</p>
          <ClusterList rows={problems} />
        </Card>
        <Card title="🔴 Recommendation frustrations">
          <p className="card-desc">Where recommendations actively miss — repeats, wrong taste, ads.</p>
          <ClusterList rows={complaints} />
        </Card>
      </div>

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <Card title="🟡 Biggest unmet needs">
          <p className="card-desc">What users repeatedly ask for but don't get (by evidence count).</p>
          {needs.length === 0 ? <span className="na">{NA}</span> : (
            <div className="ti-bars">
              {needs.slice(0, 6).map((n, i) => {
                const c = PAL[i % PAL.length], v = n?.evidence_count ?? 0;
                return (
                  <div className="ti-bar" key={i}>
                    <span className="ti-bar-name">{cap(String(n?.need ?? "").replace(/_/g, " "))}</span>
                    <div className="ti-bar-track"><div className="ti-bar-fill" style={{ width: `${(v / maxNeed) * 100}%`, background: c }} /></div>
                    <span className="ti-bar-val" style={{ color: c }}>{v.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card title="🔵 What new music users want">
          <p className="card-desc">The kinds of discovery users say they are looking for.</p>
          {desired.length === 0 ? <span className="na">{NA}</span> : (
            <div className="ti-want">
              {desired.map((d, i) => {
                const c = PAL[i % PAL.length];
                return (
                  <div className="ti-want-card" key={i} style={{ borderColor: `${c}55`, background: `${c}12` }}>
                    <div className="ti-want-type">{cap(d?.type ?? NA)}</div>
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
      <p className="sec-desc">Which Spotify discovery features users complain about most, and how often those
        mentions read as frustration.</p>
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
                    <b>{cap(ft?.feature ?? NA)}</b>
                    {enough && <span className="ti-feat-fr" style={{ color: c, background: `${c}22`, borderColor: `${c}55` }}>{(fr * 100).toFixed(0)}% frustrated</span>}
                  </div>
                  <div className="ti-feat-meta">{enough ? `${(ft?.mentions ?? 0).toLocaleString()} mentions` : "Not enough evidence"}</div>
                  {enough && ft?.quote?.text && <div className="ti-feat-q">“{ft.quote.text.slice(0, 120)}…”</div>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ===== bottom conclusion ===== */}
      <Tag>Conclusion · what the reviews tell us</Tag>
      <div className="concl-card">
        <ul className="concl">
          <li><b>Discovery — not catalogue size — is the core complaint.</b> {byCat[0] && <>“{byCat[0][0]}” carries the highest average friction ({byCat[0][1].toFixed(0)}/100), and <b>{highFriction.toLocaleString()}</b> of 26,823 reviews score ≥60 friction.</>}</li>
          <li><b>Repetition is the sharpest pain.</b> {topNeed && <>The most-asked-for fix is <b>{cap(String(topNeed.need).replace(/_/g, " "))}</b> ({topNeed.evidence_count.toLocaleString()} mentions) — users feel stuck recycling a small pool of songs.</>}</li>
          <li><b>Emotionally, frustration and fatigue dominate.</b> {negEmo[0] && negEmo[1] && <>“{cap(negEmo[0][0])}” ({negEmo[0][1].toLocaleString()}) and “{cap(negEmo[1][0])}” ({negEmo[1][1].toLocaleString()}) are the strongest negative signals when recommendations go stale.</>}</li>
          {segs.length >= 3 && (
            <li><b>The segments least able to find new songs:</b> <span style={{ color: "#e64a4a" }}>{segs[0].segment}</span> ({(segs[0].problem_rate * 100).toFixed(0)}% problem rate, top pain: {segs[0].top_pain_point}), then <span style={{ color: "#e6843a" }}>{segs[1].segment}</span> ({(segs[1].problem_rate * 100).toFixed(0)}%) and <span style={{ color: "#e6b34a" }}>{segs[2].segment}</span> ({(segs[2].problem_rate * 100).toFixed(0)}%).</li>
          )}
          <li><b>Bottom line:</b> discovery breaks down most for regional/multilingual and high-engagement listeners, who fall back on repeat playlists because recommendations feel narrow, repetitive, or mismatched — a recommendation-and-control problem, not a content-availability one.</li>
        </ul>
      </div>
    </>
  );
}
