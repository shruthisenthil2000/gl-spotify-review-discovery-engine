"use client";
import { getEngine, getExtra, num, NA } from "@/lib/data";
import { Card, Scatter, Tag, useJSON } from "../components/ui";

const QCOLOR: Record<string, string> = {
  "Quick win / Now": "#1db954", "Strategic bet": "#e6b34a",
  "Monitor": "#4a90e6", "Backlog": "#888",
};
const PAL = ["#1db954", "#4a9ee6", "#e6b34a", "#b18cf2", "#e6843a", "#3ec6c6", "#e64a4a"];
const TOTAL = 26823;

export default function Priority() {
  const e = useJSON(getEngine);
  const x = useJSON(getExtra);
  if (!e) return <p className="muted">Loading…</p>;
  const radar = e.priority_radar || [];
  const insights = e.insights || [];

  return (
    <>
      <h1>PM Priority Radar</h1>
      <p className="page-sub wide">Product strategy view — opportunities ranked by Impact × Frequency.
        Top-right means high impact and high frequency, so act on those first.</p>

      <Tag>Impact × Frequency matrix</Tag>
      <p className="sec-desc">Each bubble is an opportunity — further right = mentioned more often,
        higher up = more severe. The top-right corner deserves attention first.</p>
      <Card>
        <Scatter points={radar.map((r, i) => ({
          x: r.frequency, y: r.impact, r: r.priority_score,
          label: r.opportunity, color: PAL[i % PAL.length],
        }))} />
      </Card>

      <Tag>Ranked opportunities</Tag>
      <p className="sec-desc">Every opportunity scored and ordered by priority — impact weighted by how
        often it shows up in the reviews.</p>
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
        <div className="note"><b>How to read it:</b> <b>Impact</b> = how severe the pain is (0–100) ·
          <b> Evidence</b> = number of reviews raising it · <b>Priority</b> = impact blended with frequency
          (0–100), so a higher number means act on it sooner.</div>
      </Card>

      <Tag>Root Cause → Product Opportunity</Tag>
      <p className="sec-desc">What is driving each theme (in <span style={{ color: "#ef8e8e" }}>red</span>),
        and the product move that fixes it (in <span style={{ color: "#6fdc97" }}>green</span>). The badge
        shows how many reviews raise the theme and its share of all 26,823.</p>
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
                <div className="rc-cause"><span className="rc-k">Root cause</span> {r.root_cause}</div>
                <div className="rc-opp"><span className="rc-k">Opportunity</span> {r.opportunity}</div>
              </div>
            );
          })}
        </div>
      )}

      <Tag>Most Affected User Segments</Tag>
      <p className="sec-desc">Which cohorts hit the most repetition and discovery friction — and what
        that implies for the product.</p>
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
      <div style={{ marginTop: 18 }}>
      <Card title="Most affected by repetition (region / language)">
        {e.segmentation?.most_affected_by_repetition
          ? <table><thead><tr><th>Cohort</th><th className="num">Reviews</th><th className="num">Repetition rate</th><th className="num">Problem rate</th></tr></thead>
            <tbody>{e.segmentation.most_affected_by_repetition.slice(0, 8).map((c, i) => (
              <tr key={i}><td>{c.cohort}</td><td className="num">{c.total.toLocaleString()}</td>
                <td className="num">{(c.repetition_rate * 100).toFixed(1)}%</td>
                <td className="num">{(c.problem_rate * 100).toFixed(1)}%</td></tr>))}</tbody></table>
          : <span className="na">{NA}</span>}
      </Card>
      </div>

      <Tag>What Should Spotify Build?</Tag>
      <p className="sec-desc">The highest-leverage things to ship — and a one-line reason each one matters.</p>
      {!x ? <p className="na">Loading…</p> : (
        <div className="card-grid">
          {x.opportunities.map((o, i) => (
            <div className="scard" key={o.name} style={{ borderTop: `3px solid ${PAL[i % PAL.length]}` }}>
              <h3 style={{ color: PAL[i % PAL.length] }}>{o.name}</h3>
              <div className="row"><span className="k">User pain</span><span style={{ textAlign: "right", maxWidth: 180 }}>{o.user_pain}</span></div>
              <div className="row"><span className="k">Evidence</span><span>{o.evidence == null ? NA : `${o.evidence.toLocaleString()} (${((o.evidence / TOTAL) * 100).toFixed(1)}%)`}</span></div>
              <div className="row"><span className="k">Affected segment</span><span>{o.segment}</span></div>
              <div className="impl"><b>Why it matters:</b> {o.why}</div>
            </div>
          ))}
        </div>
      )}

      <Tag>Expected Impact · data-backed</Tag>
      <p className="sec-desc">How each build helps users, sized against the reviews we actually scraped.</p>
      {!x ? <p className="na">Loading…</p> : (
        <div className="card-grid">
          {x.opportunities.map((o, i) => {
            const c = PAL[i % PAL.length];
            const ev = o.evidence;
            return (
              <div className="scard" key={o.name} style={{ borderLeft: `4px solid ${c}` }}>
                <h3 style={{ color: c }}>{o.name}</h3>
                <div className="row"><span className="k">Backed by</span><span>{ev == null ? NA : `${ev.toLocaleString()} reviews (${((ev / TOTAL) * 100).toFixed(1)}%)`}</span></div>
                <div className="row"><span className="k">Helps most</span><span>{o.segment}</span></div>
                <div className="impl"><b>Expected impact:</b> directly relieves “{o.user_pain.toLowerCase()}” for {o.segment.toLowerCase()}{ev != null && <> — addressing the {ev.toLocaleString()} scraped reviews that raise it</>}.</div>
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

      <Tag>Section summary</Tag>
      <div className="concl-card">
        <ul className="concl">
          <li><b style={{ color: PAL[0] }}>Impact × Frequency matrix —</b> plots every opportunity by how often it's mentioned vs how severe it is; the top-right cluster is where to act first.</li>
          <li><b style={{ color: PAL[1] }}>Ranked opportunities —</b> a single priority order; {radar[0] && <>“{radar[0].opportunity}” tops the list at priority {radar[0].priority_score}.</>}</li>
          <li><b style={{ color: PAL[2] }}>Root cause → opportunity —</b> ties each pain to its driver (red) and the product fix (green), sized by review evidence.</li>
          <li><b style={{ color: PAL[3] }}>Most affected segments —</b> regional/multilingual and power users carry the highest problem rates, so localisation and control features matter most.</li>
          <li><b style={{ color: PAL[4] }}>What should Spotify build —</b> the highest-leverage shippable features, each tied to a specific user pain.</li>
          <li><b style={{ color: PAL[5] }}>Expected impact —</b> every build is backed by a measurable slice of the 26,823 scraped reviews and a clear user it helps.</li>
          <li><b style={{ color: PAL[6] }}>PM-ready insights —</b> the issues ranked by severity, each with real review quotes as evidence.</li>
        </ul>
      </div>
    </>
  );
}
