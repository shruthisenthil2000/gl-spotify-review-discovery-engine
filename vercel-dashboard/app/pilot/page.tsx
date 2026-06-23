"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import ANSWERS_JSON from "./pilot_answers.json";

type Review = {
  source: string; region: string; lang: string; rating: string;
  date: string; text: string; matched_theme: string;
};
type PilotAnswer = {
  id: string; q: string; a: string; evidence: number | null;
  key_insight?: string; implication?: string;
  funnel?: { label: string; count: number }[];
  quotes?: Review[]; evidence_reviews?: Review[];
};
const ANSWERS = ANSWERS_JSON as PilotAnswer[];

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
const SRC_LABEL: Record<string, string> = {
  play_store: "Play Store", app_store: "App Store", reddit: "Reddit", forums: "Spotify Community",
};

const KEYWORDS: Record<string, string[]> = {
  q1: ["why", "struggle", "discover new", "find new", "discovery", "new music"],
  q2: ["frustration", "recommend", "recommendation", "suggestion", "irrelevant", "off-taste"],
  q3: ["behavior", "behaviour", "trying to achieve", "goal", "listening behavior"],
  q4: ["repeat", "repetitive", "same", "loop", "shuffle", "over and over"],
  q5: ["segment", "cohort", "who", "power user", "casual", "which user"],
  q6: ["unmet", "need", "needs", "missing", "consistent"],
  q7: ["feature", "discover weekly", "release radar", "daily mix", "radio", "ai dj", "home", "smart shuffle"],
  q8: ["kind of", "what music", "new artist", "new song", "genre", "niche", "regional", "deeper cut"],
  q9: ["mood", "context", "vibe", "understand", "situation", "activity"],
  q10: ["control", "dislike", "reset", "tune", "not interested", "block", "more control"],
  q11: ["where", "go", "workaround", "alternative", "tiktok", "youtube", "apple music", "fails"],
  q12: ["feel", "emotion", "feeling", "bored", "frustrated", "fatigue", "distrust"],
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

const fmt = (n: number) => n.toLocaleString();
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(n / d < 0.01 ? 2 : 1)}%` : "—");

/* ---------- Funnel ---------- */
function Funnel({ stages }: { stages: { label: string; count: number }[] }) {
  if (!stages?.length) return null;
  const top = stages[0].count || 1;
  const disc = stages[1]?.count;
  return (
    <div className="funnel">
      {stages.map((s, i) => (
        <div className="funnel-row" key={i}>
          <div className="funnel-bar" style={{ width: `${Math.max((s.count / top) * 100, 6)}%` }} />
          <div className="funnel-meta">
            <span className="funnel-label">{s.label}</span>
            <b>{fmt(s.count)}</b>
            <span className="funnel-pct">{pct(s.count, top)} of total{i > 1 && disc ? ` · ${pct(s.count, disc)} of discovery` : ""}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Evidence drawer with filters ---------- */
function EvidenceDrawer({ answer, onClose }: { answer: PilotAnswer; onClose: () => void }) {
  const reviews = answer.evidence_reviews ?? [];
  const [src, setSrc] = useState(""); const [reg, setReg] = useState("");
  const [rat, setRat] = useState(""); const [from, setFrom] = useState("");
  const opts = (key: keyof Review) => Array.from(new Set(reviews.map((r) => r[key]).filter(Boolean)));
  const filtered = reviews.filter((r) =>
    (!src || r.source === src) && (!reg || r.region === reg) &&
    (!rat || r.rating === rat) && (!from || (r.date && r.date >= from)));
  const active = [src && SRC_LABEL[src], reg, rat && `★${rat}`, from && `from ${from}`].filter(Boolean);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" }}>Evidence behind the claim</div>
            <h2 style={{ margin: "2px 0 0", fontSize: 17 }}>{answer.q}</h2>
          </div>
          <button className="copy-btn" onClick={onClose}>✕ close</button>
        </div>
        <div className="ev-filters">
          <select value={src} onChange={(e) => setSrc(e.target.value)}>
            <option value="">All sources</option>
            {opts("source").map((s) => <option key={s} value={s}>{SRC_LABEL[s] || s}</option>)}
          </select>
          <select value={reg} onChange={(e) => setReg(e.target.value)}>
            <option value="">All regions</option>
            {opts("region").map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={rat} onChange={(e) => setRat(e.target.value)}>
            <option value="">All ratings</option>
            {opts("rating").sort().map((s) => <option key={s} value={s}>★ {s}</option>)}
          </select>
          <input type="text" placeholder="From date YYYY-MM-DD" value={from}
            onChange={(e) => setFrom(e.target.value)} style={{ width: 160 }} />
        </div>
        <div className="ev-status">
          Filtered evidence sample · {filtered.length} of {reviews.length} reviews
          {active.length > 0 && <span> · {active.map((a, i) => <span className="filter-chip" key={i}>{a}</span>)}</span>}
        </div>
        <div className="ev-list">
          {filtered.length === 0 ? <div className="na">Evidence details not available for these filters.</div> :
            filtered.map((r, i) => (
              <div className="ev-card" key={i}>
                <div className="ev-meta">
                  <span className="badge green">{SRC_LABEL[r.source] || r.source}</span>
                  {r.region && <span className="badge grey">{r.region}</span>}
                  {r.lang && r.lang !== "en/unknown" && <span className="badge grey">{r.lang}</span>}
                  {r.rating && <span className="badge amber">★ {r.rating}</span>}
                  {r.date && <span className="muted" style={{ fontSize: 11 }}>{r.date}</span>}
                </div>
                <div className="ev-text">{r.text}</div>
                <div className="ev-theme">Supports: {r.matched_theme}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Reusable Answer card ---------- */
function AnswerCard({ item, onEvidence, onAsk }:
  { item: PilotAnswer; onEvidence: (id: string) => void; onAsk: (id: string) => void }) {
  const quotes = item.quotes ?? [];
  const idx = ITEMS.findIndex((x) => x.id === item.id);
  const followups = [1, 2, 3].map((o) => ITEMS[(idx + o) % ITEMS.length]).filter((f) => f.id !== item.id);
  return (
    <div className="qa">
      <div className="q"><span className="qnum">AI</span>{item.q}</div>
      <Funnel stages={item.funnel ?? []} />
      <div className="a">{item.a || "Not available"}</div>
      <div className="ans-grid">
        <div className="ans-row"><span className="ans-k">Evidence</span>
          {item.evidence != null
            ? <button className="ev-btn" onClick={() => onEvidence(item.id)}>{fmt(item.evidence)} reviews ↗ inspect</button>
            : <span className="na">Not available</span>}</div>
        <div className="ans-row"><span className="ans-k">Key insight</span>
          <span className="ans-v">{item.key_insight || "Not available"}</span></div>
      </div>

      <div className="rev-label">Representative reviews</div>
      {quotes.length === 0 ? <div className="na">Evidence details not available</div> :
        quotes.map((q, i) => (
          <div className="quote" key={i}>{q.text}
            <span className="meta">— {SRC_LABEL[q.source] || q.source}
              {q.region ? ` · ${q.region}` : ""}{q.rating ? ` · ★${q.rating}` : ""}{q.date ? ` · ${q.date}` : ""}</span></div>
        ))}

      <div className="impl" style={{ marginTop: 12 }}><b>PM implication:</b> {item.implication || "Not available"}</div>

      {followups.length > 0 && (
        <>
          <div className="rev-label" style={{ marginTop: 14 }}>Follow-up questions</div>
          <div className="followups">
            {followups.map((f) => (
              <button className="followup-chip" key={f.id} onClick={() => onAsk(f.id)}>{f.q}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Page ---------- */
type Msg = { role: "user"; text: string } | { role: "bot"; id: string } | { role: "bot-fallback" };

export default function AiPilot() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [modalId, setModalId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (msgs.length) logRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [msgs]);

  const ask = (text: string, id?: string) => {
    if (!text.trim() && !id) return;
    const matched = id ?? matchId(text);
    const userText = id ? BY_ID[id]?.q ?? text : text;
    setMsgs((m) => [...m, { role: "user", text: userText },
      matched ? { role: "bot", id: matched } : { role: "bot-fallback" }]);
    setInput("");
  };

  const modalAnswer = useMemo(() => (modalId ? BY_ID[modalId] : null), [modalId]);

  return (
    <>
      <div className="copilot-label">Discovery Copilot</div>
      <p className="page-sub" style={{ margin: "2px 0 6px" }}>Ask the AI product analyst about Spotify discovery feedback.</p>
      <div className="dataset-status">Frozen v1 · 26,823 reviews analyzed · Dataset freeze date: Not available</div>

      <div className="copilot-panel">
        <div className="copilot-head">
          <span className="copilot-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#04130a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v3M5 8h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" /></svg>
          </span>
          <div>
            <h2 style={{ margin: 0 }}>How can I help your discovery research?</h2>
            <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>Evidence-backed answers from 26,823 Spotify reviews, Reddit discussions, and community forum posts.</div>
          </div>
        </div>

        <div className="copilot-cards-label">Research questions</div>
        <div className="qopts">
          {ITEMS.map((it, i) => (
            <button className="qopt" key={it.id} onClick={() => ask(it.q, it.id)}>
              <span className="qopt-n">{String(i + 1).padStart(2, "0")}</span><span>{it.q}</span>
            </button>
          ))}
        </div>

        {msgs.length > 0 && (
          <div className="chatlog" ref={logRef} style={{ marginTop: 16 }}>
            {msgs.map((m, i) => {
              if (m.role === "user") return <div className="bubble-user" key={i}>{m.text}</div>;
              if (m.role === "bot-fallback") return <div className="qa" key={i}><div className="a">{FALLBACK_MSG}</div></div>;
              const item = BY_ID[m.id];
              return item ? <AnswerCard key={i} item={item} onEvidence={setModalId} onAsk={(id) => ask("", id)} />
                : <div className="qa" key={i}><div className="a na">Not available.</div></div>;
            })}
          </div>
        )}
      </div>

      <form className="chatbar copilot-bar" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input type="text" placeholder="Ask about discovery, recommendations, repetition, segments, or unmet needs…"
          value={input} onChange={(e) => setInput(e.target.value)} style={{ flex: 1 }} />
        <button type="submit" className="send-btn">Send</button>
      </form>

      {modalAnswer && <EvidenceDrawer answer={modalAnswer} onClose={() => setModalId(null)} />}
    </>
  );
}
