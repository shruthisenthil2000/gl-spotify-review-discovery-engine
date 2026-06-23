"use client";
import { useEffect, useRef, useState } from "react";
import { getExtra } from "@/lib/data";
import { useJSON } from "../components/ui";

// Curated keyword bags for matching a typed question to one of the 12 answers.
const KEYWORDS: string[][] = [
  ["why", "struggle", "discover new", "find new", "discovery", "new music"],
  ["frustration", "recommend", "recommendation", "suggestion", "irrelevant", "off-taste"],
  ["behavior", "behaviour", "trying to achieve", "goal", "want to do", "listening behavior"],
  ["repeat", "repetitive", "same", "loop", "shuffle", "over and over"],
  ["segment", "cohort", "who", "users affected", "power user", "casual", "which user"],
  ["unmet", "need", "needs", "missing", "consistent"],
  ["feature", "discover weekly", "release radar", "daily mix", "radio", "ai dj", "home", "smart shuffle"],
  ["kind of", "what music", "new artist", "new song", "genre", "niche", "regional", "deeper cut", "want to find"],
  ["mood", "context", "vibe", "understand", "situation", "activity"],
  ["control", "dislike", "reset", "tune", "not interested", "block", "more control"],
  ["where", "go", "workaround", "alternative", "tiktok", "youtube", "apple music", "fails", "instead"],
  ["feel", "emotion", "feeling", "bored", "frustrated", "fatigue", "distrust", "when recommendations"],
];

// Bias emotion/feel queries toward Q12 over Q4 when both appear.
function matchIndex(query: string): number {
  const q = query.toLowerCase();
  let best = -1, bestScore = 0;
  KEYWORDS.forEach((bag, i) => {
    let score = bag.reduce((s, kw) => (q.includes(kw) ? s + 1 : s), 0);
    if (i === 11 && /\bfeel|emotion|bored|fatigue/.test(q)) score += 1;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return bestScore > 0 ? best : -1;
}

const FALLBACK =
  "I can answer the 12 Spotify discovery research questions using the frozen review dataset. " +
  "Choose one of the suggested questions.";

type Msg = { role: "user"; text: string } | { role: "bot"; idx: number } | { role: "bot-fallback" };

export default function AiPilot() {
  const x = useJSON(getExtra);
  const qa = x?.ai_pilot ?? [];
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msgs.length) logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const ask = (text: string, exactIdx?: number) => {
    if (!text.trim() && exactIdx === undefined) return;
    const idx = exactIdx ?? matchIndex(text);
    const userText = exactIdx !== undefined ? qa[exactIdx]?.q ?? text : text;
    setMsgs((m) => [...m, { role: "user", text: userText },
      idx >= 0 ? { role: "bot", idx } : { role: "bot-fallback" }]);
    setInput("");
  };

  return (
    <>
      <div className="hero">
        <h1>Ask the Spotify Discovery AI</h1>
        <p className="lead" style={{ margin: "8px 0 0" }}>
          Evidence-backed answers from 26,823 Spotify reviews, Reddit discussions, and community forum posts.
        </p>
      </div>

      {!x ? <p className="muted" style={{ marginTop: 18 }}>Loading…</p> : (
        <div className="chat">
          {/* conversation */}
          {msgs.length > 0 && (
            <div className="chatlog" ref={logRef}>
              {msgs.map((m, i) => {
                if (m.role === "user") return <div className="bubble-user" key={i}>{m.text}</div>;
                if (m.role === "bot-fallback") return <div className="qa" key={i}><div className="a">{FALLBACK}</div></div>;
                const item = qa[m.idx];
                if (!item) return <div className="qa" key={i}><div className="a">Not available.</div></div>;
                return (
                  <div className="qa" key={i}>
                    <div className="q"><span className="qnum">AI</span>{item.q}</div>
                    <div className="a">{item.a}</div>
                    <div className="ans-grid">
                      {item.evidence != null && (
                        <div className="ans-row"><span className="ans-k">Evidence</span>
                          <span className="ev">{item.evidence.toLocaleString()} reviews</span></div>
                      )}
                      {item.key_insight && (
                        <div className="ans-row"><span className="ans-k">Key insight</span>
                          <span className="ans-v">{item.key_insight}</span></div>
                      )}
                      {item.implication && (
                        <div className="ans-row"><span className="ans-k">PM implication</span>
                          <span className="ans-v" style={{ color: "#cdebd7" }}>{item.implication}</span></div>
                      )}
                    </div>
                    {item.quote ? (
                      <div className="quote" style={{ marginTop: 10 }}>{item.quote.text}
                        <span className="meta">— {item.quote.source} · {item.quote.region}
                          {item.quote.rating ? ` · ★${item.quote.rating}` : ""}</span></div>
                    ) : (
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Supporting quote: Not available</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* research question options */}
          <div className="nav-section-label" style={{ margin: "4px 0 2px" }}>Research questions</div>
          <div className="qopts">
            {qa.map((item, i) => (
              <button className="qopt" key={i} onClick={() => ask(item.q, i)}>
                <span className="qopt-n">{String(i + 1).padStart(2, "0")}</span>
                <span>{item.q}</span>
              </button>
            ))}
          </div>

          {/* type-your-own */}
          <form className="chatbar" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <input type="text" placeholder="Or type a similar question…" value={input}
              onChange={(e) => setInput(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="send-btn">Ask</button>
          </form>
        </div>
      )}
    </>
  );
}
