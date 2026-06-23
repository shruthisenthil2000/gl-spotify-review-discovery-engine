"use client";
import { useEffect, useRef, useState } from "react";
import { getExtra, Extra } from "@/lib/data";
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

const FALLBACK =
  "I can answer the 12 discovery research questions using the frozen review dataset. " +
  "Choose one of the suggested questions.";

type Msg = { role: "user"; text: string } | { role: "bot"; idx: number } | { role: "bot-fallback" };

function matchIndex(query: string): number {
  const q = query.toLowerCase();
  let best = -1, bestScore = 0;
  KEYWORDS.forEach((bag, i) => {
    const score = bag.reduce((s, kw) => (q.includes(kw) ? s + 1 : s), 0);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return bestScore > 0 ? best : -1;
}

export default function AiPilot() {
  const x = useJSON(getExtra);
  const qa = x?.ai_pilot ?? [];
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [msgs]);

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
        <h1>AI Pilot</h1>
        <div className="subtitle">Executive answer engine · chat</div>
        <p className="lead">Ask a discovery-research question. Answers are pulled from the frozen
          dataset’s precomputed evidence — no live model, no external API, nothing invented.</p>
      </div>

      {!x ? <p className="muted" style={{ marginTop: 18 }}>Loading…</p> : (
        <div className="chat">
          <div className="chatlog" ref={logRef}>
            {msgs.length === 0 && (
              <div className="qa"><div className="a">👋 Ask me anything about Spotify music
                discovery. Try a suggested question below, or type your own — I’ll match it to the
                closest of 12 evidence-backed answers.</div></div>
            )}
            {msgs.map((m, i) => {
              if (m.role === "user") return <div className="bubble-user" key={i}>{m.text}</div>;
              if (m.role === "bot-fallback") return <div className="qa" key={i}><div className="a">{FALLBACK}</div></div>;
              const item = qa[m.idx];
              if (!item) return <div className="qa" key={i}><div className="a">Not available.</div></div>;
              return (
                <div className="qa" key={i}>
                  <div className="q"><span className="qnum">A</span>{item.q}</div>
                  <div className="a">{item.a}</div>
                  {item.evidence != null && <span className="ev">{item.evidence.toLocaleString()} reviews of evidence</span>}
                  {item.quote && (
                    <div className="quote" style={{ marginTop: 10 }}>{item.quote.text}
                      <span className="meta">— {item.quote.source} · {item.quote.region}
                        {item.quote.rating ? ` · ★${item.quote.rating}` : ""}</span></div>
                  )}
                  {item.implication && (
                    <div className="impl" style={{ marginTop: 10 }}><b>PM interpretation:</b> {item.implication}</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="chips">
            {qa.map((item, i) => (
              <button className="chip" key={i} onClick={() => ask(item.q, i)}>{item.q}</button>
            ))}
          </div>

          <form className="chatbar" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <input type="text" placeholder="Ask a discovery question…" value={input}
              onChange={(e) => setInput(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="send-btn">Ask</button>
          </form>
        </div>
      )}
    </>
  );
}
