"use client";
import { useEffect, useRef, useState } from "react";
import ANSWERS_JSON from "./pilot_answers.json";

// Answers are BUNDLED at build time (static import) — the page never depends on
// a runtime fetch, so clicking a question always resolves to a real answer.
type PilotAnswer = {
  id: string; q: string; a: string; evidence: number | null;
  key_insight?: string; implication?: string;
  quote?: { text: string; source: string; region: string; rating: string } | null;
};
const ANSWERS = ANSWERS_JSON as PilotAnswer[];

// Local fallback list of the 12 questions (used only if the bundled data were
// ever empty — guarantees the cards always render).
const FALLBACK_QUESTIONS = [
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
].map((q, i) => ({ id: `q${i + 1}`, q } as PilotAnswer));

const ITEMS: PilotAnswer[] = ANSWERS.length ? ANSWERS : FALLBACK_QUESTIONS;
const BY_ID: Record<string, PilotAnswer> = Object.fromEntries(ITEMS.map((it) => [it.id, it]));

const KEYWORDS: Record<string, string[]> = {
  q1: ["why", "struggle", "discover new", "find new", "discovery", "new music"],
  q2: ["frustration", "recommend", "recommendation", "suggestion", "irrelevant", "off-taste"],
  q3: ["behavior", "behaviour", "trying to achieve", "goal", "want to do", "listening behavior"],
  q4: ["repeat", "repetitive", "same", "loop", "shuffle", "over and over"],
  q5: ["segment", "cohort", "who", "users affected", "power user", "casual", "which user"],
  q6: ["unmet", "need", "needs", "missing", "consistent"],
  q7: ["feature", "discover weekly", "release radar", "daily mix", "radio", "ai dj", "home", "smart shuffle"],
  q8: ["kind of", "what music", "new artist", "new song", "genre", "niche", "regional", "deeper cut", "want to find"],
  q9: ["mood", "context", "vibe", "understand", "situation", "activity"],
  q10: ["control", "dislike", "reset", "tune", "not interested", "block", "more control"],
  q11: ["where", "go", "workaround", "alternative", "tiktok", "youtube", "apple music", "fails", "instead"],
  q12: ["feel", "emotion", "feeling", "bored", "frustrated", "fatigue", "distrust", "when recommendations"],
};

function matchId(query: string): string | null {
  const q = query.toLowerCase();
  let best: string | null = null, bestScore = 0;
  for (const [id, bag] of Object.entries(KEYWORDS)) {
    let score = bag.reduce((s, kw) => (q.includes(kw) ? s + 1 : s), 0);
    if (id === "q12" && /\bfeel|emotion|bored|fatigue/.test(q)) score += 1;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return bestScore > 0 ? best : null;
}

const FALLBACK_MSG =
  "I can answer the Spotify discovery research questions using the frozen review dataset. " +
  "Choose one of the suggested questions.";

type Msg = { role: "user"; text: string } | { role: "bot"; id: string } | { role: "bot-fallback" };

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
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (msgs.length) logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const ask = (text: string, id?: string) => {
    if (!text.trim() && !id) return;
    const matched = id ?? matchId(text);
    const userText = id ? BY_ID[id]?.q ?? text : text;
    setMsgs((m) => [...m, { role: "user", text: userText },
      matched ? { role: "bot", id: matched } : { role: "bot-fallback" }]);
    setInput("");
  };

  const answerCard = (id: string, key: number) => {
    const item = BY_ID[id];
    if (!item) return <div className="qa" key={key}><div className="a na">Not available.</div></div>;
    return (
      <div className="qa" key={key}>
        <div className="q"><span className="qnum">AI</span>{item.q}</div>
        <div className="a">{item.a || "Not available"}</div>
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
              if (m.role === "bot-fallback") return <div className="qa" key={i}><div className="a">{FALLBACK_MSG}</div></div>;
              return answerCard(m.id, i);
            })}
          </div>
        )}

        <div className="copilot-cards-label">{msgs.length ? "Ask another research question" : "Research questions"}</div>
        <div className="qopts">
          {ITEMS.map((it, i) => (
            <button className="qopt" key={it.id} onClick={() => ask(it.q, it.id)}>
              <span className="qopt-n">{String(i + 1).padStart(2, "0")}</span>
              <span>{it.q}</span>
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
