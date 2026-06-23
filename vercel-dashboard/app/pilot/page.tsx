"use client";
import { useEffect, useRef, useState } from "react";
import { getExtra } from "@/lib/data";
import { useJSON } from "../components/ui";

// Local fallback — the 12 project research questions ALWAYS render, even if
// analysis_extra.json fails to load. Order matches the precomputed answers.
const QUESTIONS = [
  "Why do users struggle to discover new music?",
  "What are the most common frustrations with recommendations?",
  "What listening behaviors are users trying to achieve?",
  "What causes users to repeatedly listen to the same content?",
  "Which user segments experience different discovery challenges?",
  "What unmet needs emerge consistently across reviews?",
  "Which Spotify discovery features frustrate users the most?",
  "What kind of new music do users want to find?",
  "Does Spotify understand users’ mood and current listening context?",
  "Do users want more control over their recommendations?",
  "Where do users go when Spotify discovery fails?",
  "How do users feel when recommendations become repetitive or irrelevant?",
];

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

function AssistantIcon() {
  return (
    <span className="copilot-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#04130a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v3M5 8h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
        <circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" />
      </svg>
    </span>
  );
}

export default function AiPilot() {
  const x = useJSON(getExtra);
  const answers = x?.ai_pilot ?? [];
  // questions always come from the local fallback (or data if it matches length)
  const questions = answers.length === 12 ? answers.map((a) => a.q) : QUESTIONS;

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (msgs.length) logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const ask = (text: string, exactIdx?: number) => {
    if (!text.trim() && exactIdx === undefined) return;
    const idx = exactIdx ?? matchIndex(text);
    const userText = exactIdx !== undefined ? questions[exactIdx] : text;
    setMsgs((m) => [...m, { role: "user", text: userText },
      idx >= 0 ? { role: "bot", idx } : { role: "bot-fallback" }]);
    setInput("");
  };

  const answerCard = (idx: number, key: number) => {
    const item = answers[idx];
    return (
      <div className="qa" key={key}>
        <div className="q"><span className="qnum">AI</span>{questions[idx]}</div>
        {!item ? <div className="a na">Answer data: Not available.</div> : (
          <>
            <div className="a">{item.a}</div>
            <div className="ans-grid">
              <div className="ans-row"><span className="ans-k">Evidence</span>
                <span className="ev">{item.evidence != null ? `${item.evidence.toLocaleString()} reviews` : "Not available"}</span></div>
              <div className="ans-row"><span className="ans-k">Key insight</span>
                <span className="ans-v">{item.key_insight || "Not available"}</span></div>
              <div className="ans-row"><span className="ans-k">PM implication</span>
                <span className="ans-v" style={{ color: "#cdebd7" }}>{item.implication || "Not available"}</span></div>
            </div>
            {item.quote ? (
              <div className="quote" style={{ marginTop: 10 }}>{item.quote.text}
                <span className="meta">— {item.quote.source} · {item.quote.region}
                  {item.quote.rating ? ` · ★${item.quote.rating}` : ""}</span></div>
            ) : <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Supporting quote: Not available</div>}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="copilot-label">Discovery Copilot</div>
      <p className="page-sub" style={{ marginBottom: 16 }}>
        Ask the AI product analyst about Spotify discovery feedback.
      </p>

      <div className="copilot-panel">
        <div className="copilot-head">
          <AssistantIcon />
          <div>
            <h2 style={{ margin: 0 }}>How can I help your discovery research?</h2>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              I analyze 26,823 Spotify reviews and discussions to answer PM discovery questions with
              evidence-backed insights.
            </div>
          </div>
        </div>

        {msgs.length > 0 && (
          <div className="chatlog" ref={logRef} style={{ marginTop: 16 }}>
            {msgs.map((m, i) => {
              if (m.role === "user") return <div className="bubble-user" key={i}>{m.text}</div>;
              if (m.role === "bot-fallback") return <div className="qa" key={i}><div className="a">{FALLBACK}</div></div>;
              return answerCard(m.idx, i);
            })}
          </div>
        )}

        <div className="copilot-cards-label">{msgs.length ? "Ask another research question" : "Research questions"}</div>
        <div className="qopts">
          {questions.map((q, i) => (
            <button className="qopt" key={i} onClick={() => ask(q, i)}>
              <span className="qopt-n">{String(i + 1).padStart(2, "0")}</span>
              <span>{q}</span>
            </button>
          ))}
        </div>
      </div>

      <form className="chatbar copilot-bar" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input type="text"
          placeholder="Ask about discovery, recommendations, repetition, segments, or unmet needs…"
          value={input} onChange={(e) => setInput(e.target.value)} style={{ flex: 1 }} />
        <button type="submit" className="send-btn">Send</button>
      </form>
    </>
  );
}
