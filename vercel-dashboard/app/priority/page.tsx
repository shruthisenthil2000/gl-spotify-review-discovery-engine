"use client";
import { getEngine, getExtra, num, NA } from "@/lib/data";
import { Card, Scatter, Tag, useJSON } from "../components/ui";

const QCOLOR: Record<string, string> = {
  "Quick win / Now": "#1db954", "Strategic bet": "#e6b34a",
  "Monitor": "#4a90e6", "Backlog": "#888",
};
const PAL = ["#1db954", "#4a9ee6", "#e6b34a", "#b18cf2", "#e6843a", "#3ec6c6", "#e64a4a"];
const TOTAL = 26823;
// humanise the region/language codes that appear as a "segment"
const SEG_LABEL: Record<string, string> = {
  tr: "Turkish listeners", id: "Indonesian listeners", es: "Spanish-speaking listeners",
  pt: "Portuguese-speaking listeners", MEA: "Middle East & Africa", LATAM: "Latin America",
  ANZ: "Australia & New Zealand", "SE Asia": "Southeast Asia", "Forum(global)": "Community forum (global)",
};
const segLabel = (s: string) => SEG_LABEL[s] || s;

export default function Priority() {
  const e = useJSON(getEngine);
  const x = useJSON(getExtra);
  if (!e) return <p className="muted">Loading…</p>;
  const radar = e.priority_radar || [];
  const insights = e.insights || [];
  // findings derived from the scraped reviews (for the summary)
  const top3 = radar.slice(0, 3);
  const top3sum = top3.reduce((a, r) => a + r.frequency, 0);
  const segsByProblem = (x?.segment_cards ?? []).slice().sort((a, b) => (b.problem_rate || 0) - (a.problem_rate || 0));
  const oppsByEv = (x?.opportunities ?? []).filter((o) => o.evidence != null)
    .slice().sort((a, b) => (b.evidence as number) - (a.evidence as number));

  return (
    <>
      <p className="page-sub wide wide-line">Product strategy view — opportunities ranked by impact × frequency; top-right means high impact and high frequency, so act there first.</p>

      <Tag>Impact × Frequency matrix</Tag>
      <p className="sec-desc wide-line">Each bubble is an opportunity — further right = mentioned more often, higher up = more severe; the top-right corner deserves attention first.</p>
      <Card>
        <Scatter points={radar.map((r, i) => ({
          x: r.frequency, y: r.impact, r: r.priority_score,
          label: r.opportunity, color: PAL[i % PAL.length],
        }))} />
      </Card>

      <Tag>Ranked opportunities</Tag>
      <p className="sec-desc wide-line">Every opportunity scored and ordered by priority — impact weighted by how often it shows up in the reviews.</p>
      <Card>
        <table>
          <thead><tr><th className="num">#</th><th>Theme</th><th className="num">Impact</th><th className="num">Evidence</th>
            <th className="num">Priority</th><th>Quadrant</th></tr></thead>
          <tbody>
            {radar.map((r, i) => (
              <tr key={i}><td className="num"><b>{i + 1}</b></td><td><b>{r.opportunity}</b></td><td className="num">{r.impact}</td>
                <td className="num">{r.frequency.toLocaleString()}</td><td className="num">{r.priority_score}</td>
                <td><span className="badge" style={{ background: "transparent", color: QCOLOR[r.quadrant] }}>{r.quadrant}</span></td></tr>
            ))}
          </tbody>
        </table>
        <div className="note wide-line"><b>How to read it:</b> <b>Impact</b> = how severe the pain is (0–100) · <b>Evidence</b> = number of reviews raising it · <b>Priority</b> = impact weighted by evidence, so a higher number means act on it sooner.</div>
      </Card>

      <Tag>Root Cause → Product Opportunity</Tag>
      <p className="sec-desc wide-line">What is driving each theme, and the product move that fixes it; the badge shows how many reviews raise it and its share of all 26,823.</p>
      {!x ? <span className="na">Loading…</span> : (
        <div className="rc-grid">
          {x.root_cause_table.map((r, i) => {
            const c = PAL[i % PAL.length];
            const ev = r.evidence;
            return (
              <div className="rc-card" key={i} style={{ borderLeftColor: c }}>
                <div className="rc-top">
                  <b style={{ color: c }}>{r.theme}</b>
                  {ev != null && <span className="rc-ev" style={{ color: c, background: `${c}22`, borderColor: `${c}55` }}>{ev.toLocaleString()} reviews · {((ev / TOTAL) * 100).toFixed(1)}% of all</span>}
                </div>
                <div className="rc-cause"><span className="rc-k cause">Root cause</span> {r.root_cause}</div>
                <div className="rc-opp"><span className="rc-k opp">Opportunity</span> {r.opportunity}</div>
              </div>
            );
          })}
        </div>
      )}

      <Tag>Most Affected User Segments</Tag>
      <p className="sec-desc wide-line">Which cohorts hit the most repetition and discovery friction — and what that implies for the product.</p>
      {!x ? <p className="na">Loading…</p> : (
        <div className="card-grid">
          {x.segment_cards.map((sgc, i) => {
            const c = PAL[i % PAL.length];
            return (
              <div className="scard" key={sgc.segment} style={{ borderTop: `3px solid ${c}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ color: c }}>{sgc.segment}</h3>
                  {sgc.heuristic && <span className="badge grey">heuristic</span>}
                </div>
                <div className="row"><span className="k">Reviews</span><span>{sgc.total.toLocaleString()}</span></div>
                <div className="row"><span className="k">Repetition rate</span><span>{(sgc.repetition_rate * 100).toFixed(1)}%</span></div>
                <div className="row"><span className="k">Problem rate</span><span>{(sgc.problem_rate * 100).toFixed(1)}%</span></div>
                <div className="row"><span className="k">Top pain</span><span>{sgc.top_pain_point}</span></div>
                <div className="impl"><b>Implication:</b> {sgc.product_implication}</div>
              </div>
            );
          })}
        </div>
      )}
      <Tag>What Should Spotify Build?</Tag>
      <p className="sec-desc wide-line">The highest-leverage things to ship — and a one-line reason each one matters.</p>
      {!x ? <p className="na">Loading…</p> : (
        <div className="card-grid">
          {x.opportunities.map((o, i) => (
            <div className="scard" key={o.name} style={{ borderTop: `3px solid ${PAL[i % PAL.length]}` }}>
              <h3 style={{ color: PAL[i % PAL.length] }}>{o.name}</h3>
              <div className="row"><span className="k">User pain</span><span style={{ textAlign: "right", maxWidth: 180 }}>{o.user_pain}</span></div>
              <div className="row"><span className="k">Evidence</span><span>{o.evidence == null ? NA : `${o.evidence.toLocaleString()} (${((o.evidence / TOTAL) * 100).toFixed(1)}%)`}</span></div>
              <div className="row"><span className="k">Affected segment</span><span>{segLabel(o.segment)}</span></div>
              <div className="impl"><b>Why it matters:</b> {o.why}</div>
            </div>
          ))}
        </div>
      )}

      <Tag>Expected Impact · data-backed</Tag>
      <p className="sec-desc wide-line">How each build helps users, sized against the reviews we actually scraped.</p>
      {!x ? <p className="na">Loading…</p> : (
        <div className="card-grid">
          {x.opportunities.map((o, i) => {
            const c = PAL[i % PAL.length];
            const ev = o.evidence;
            return (
              <div className="scard" key={o.name} style={{ borderLeft: `4px solid ${c}` }}>
                <h3 style={{ color: c }}>{o.name}</h3>
                <div className="row"><span className="k">Backed by</span><span>{ev == null ? NA : `${ev.toLocaleString()} reviews (${((ev / TOTAL) * 100).toFixed(1)}%)`}</span></div>
                <div className="row"><span className="k">Helps most</span><span>{segLabel(o.segment)}</span></div>
                <div className="impl"><b>Expected impact:</b> directly relieves “{o.user_pain.toLowerCase()}” for {segLabel(o.segment).toLowerCase()}{ev != null && <> — addressing the {ev.toLocaleString()} scraped reviews that raise it</>}.</div>
              </div>
            );
          })}
        </div>
      )}

      <Tag>PM-ready insights</Tag>
      <p className="sec-desc wide-line">Severity (0–100) blends how <b>often</b> an issue appears (45%), how <b>negative</b> those reviews are (35%), and how <b>widely</b> it spans regions (20%) — higher means more urgent to fix.</p>
      {insights.length === 0 && <p className="na">{NA}</p>}
      {insights.map((ins, i) => {
        const c = PAL[i % PAL.length];
        return (
          <div className="card insight" key={i} style={{ borderLeft: `4px solid ${c}` }}>
            <div className="head">
              <div>
                <h2 style={{ margin: "0 0 6px", color: c }}>{ins.title}</h2>
                <div className="muted" style={{ fontSize: 13 }}>
                  Evidence <b>{num(ins.evidence_count)}</b> · Affected: {ins.affected_segment}
                  {" "}· Negativity {(ins.negativity * 100).toFixed(0)}% · <span className="badge grey">{ins.category}</span>
                </div>
              </div>
              <div className="sev-wrap"><div className="sev" style={{ color: c }}>{ins.severity_score}</div><div className="lbl">severity</div></div>
            </div>
            {ins.representative_quotes?.slice(0, 2).map((q, j) => (
              <div className="quote" key={j} style={{ borderLeftColor: c }}>{q.text}<span className="meta">— {q.source} · {q.region} · ★{q.rating || "—"}</span></div>
            ))}
          </div>
        );
      })}

      <Tag>Section summary · what the reviews tell us</Tag>
      <div className="concl-card">
        <ul className="concl">
          {radar[0] && <li><b style={{ color: PAL[0] }}>Discovery is the #1 problem —</b> “{radar[0].opportunity}” is both the most-raised ({radar[0].frequency.toLocaleString()} reviews) and most severe (impact {radar[0].impact}) issue, well ahead of everything else.</li>}
          {top3.length === 3 && <li><b style={{ color: PAL[1] }}>Three themes carry the load —</b> discovery friction, repetition, and recommendation mismatch together account for <b>{top3sum.toLocaleString()}</b> reviews of high-priority evidence.</li>}
          <li><b style={{ color: PAL[2] }}>One common root cause —</b> across themes, complaints trace back to the algorithm leaning on familiar listening history and giving users too little control to steer it.</li>
          {segsByProblem.length >= 2 && <li><b style={{ color: PAL[3] }}>Non-English and heavy users hurt most —</b> {segsByProblem[0].segment} ({(segsByProblem[0].problem_rate * 100).toFixed(0)}% problem rate) and {segsByProblem[1].segment} ({(segsByProblem[1].problem_rate * 100).toFixed(0)}%) face the worst discovery friction.</li>}
          {oppsByEv[0] && <li><b style={{ color: PAL[4] }}>Clear, sizeable demand for fixes —</b> the most-backed build, “{oppsByEv[0].name}”, maps to {(oppsByEv[0].evidence as number).toLocaleString()} reviews ({(((oppsByEv[0].evidence as number) / TOTAL) * 100).toFixed(0)}% of the dataset).</li>}
          <li><b style={{ color: PAL[5] }}>Negative sentiment is concentrated —</b> frustration clusters in repetition and discovery-failure reviews, repeated consistently in real user quotes across regions.</li>
          <li><b style={{ color: PAL[6] }}>Bottom line —</b> Spotify's discovery problem is one of control and freshness, not catalogue — users want to steer recommendations away from the familiar and toward genuinely new music.</li>
        </ul>
      </div>
    </>
  );
}
