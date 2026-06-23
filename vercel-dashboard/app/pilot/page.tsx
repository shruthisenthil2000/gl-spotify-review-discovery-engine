"use client";
import { getExtra, NA } from "@/lib/data";
import { useJSON } from "../components/ui";

export default function AiPilot() {
  const x = useJSON(getExtra);
  if (!x) return <p className="muted">Loading…</p>;
  const qa = x.ai_pilot || [];

  return (
    <>
      <div className="hero">
        <h1>AI Pilot</h1>
        <div className="subtitle">Executive answer engine</div>
        <p className="lead">
          Synthesizes the strongest evidence from the frozen dataset into direct, PM-ready answers.
          Every number below is real and traceable to the analyzed reviews — nothing is invented.
        </p>
      </div>

      <div style={{ marginTop: 18 }}>
        {qa.length === 0 ? <p className="na">{NA}</p> : qa.map((item, i) => (
          <div className="qa" key={i}>
            <div className="q"><span className="qnum">{String(i + 1).padStart(2, "0")}</span>{item.q}</div>
            <div className="a">{item.a}</div>
            {item.evidence != null && (
              <span className="ev">{item.evidence.toLocaleString()} reviews of evidence</span>
            )}
            {item.quote && (
              <div className="quote" style={{ marginTop: 10 }}>{item.quote.text}
                <span className="meta">— {item.quote.source} · {item.quote.region}
                  {item.quote.rating ? ` · ★${item.quote.rating}` : ""}</span></div>
            )}
          </div>
        ))}
      </div>

      <div className="note" style={{ marginTop: 8 }}>
        Answers are evidence summaries built only from the frozen dataset and derived heuristic
        signals (friction, journey, emotion, feature mentions, workarounds). Where a count is
        unavailable, it is omitted rather than invented.
      </div>
    </>
  );
}
