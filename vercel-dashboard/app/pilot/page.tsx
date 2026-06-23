"use client";
import { useEffect, useRef, useState } from "react";
import ANSWERS_JSON from "./pilot_answers.json";

type Review = {
  source: string; region: string; lang: string; rating: string;
  date: string; text: string; matched_theme: string;
};
type PilotAnswer = {
  id: string; q: string; a: string; evidence: number | null;
  key_insight?: string; implication?: string; match_label?: string;
  funnel?: { label: string; count: number }[];
  grounding?: { n: number; by_source?: Record<string, number>; avg_rating?: number | null; top_region?: string | null };
  quotes?: Review[]; evidence_reviews?: Review[];
  sub_needs?: { label: string; count: number }[];
  themes?: string[]; segments?: string[]; recommendations?: string[];
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

// Routing keywords (typed question -> closest answer id)
const KEYWORDS: Record<string, string[]> = {
  q1: ["why", "struggle", "discover", "find new", "new music"],
  q2: ["frustration", "recommend", "suggestion", "irrelevant", "off-taste"],
  q3: ["behavior", "trying to achieve", "goal", "listening behavior"],
  q4: ["repeat", "repetitive", "same", "loop", "shuffle"],
  q5: ["segment", "cohort", "who", "power user", "casual"],
  q6: ["unmet", "need", "needs", "missing"],
  q7: ["feature", "discover weekly", "release radar", "daily mix", "radio", "smart shuffle"],
  q8: ["kind of", "new artist", "new song", "genre", "niche", "regional"],
  q9: ["mood", "context", "vibe", "situation", "activity"],
  q10: ["control", "dislike", "reset", "tune", "not interested"],
  q11: ["where", "go", "tiktok", "youtube", "apple music", "fails"],
  q12: ["feel", "emotion", "bored", "frustrated", "fatigue"],
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

// Quote relevance scorer (req 8). NOTE: review-level tag quality is the
// bottleneck here — quotes are selected purely by keyword overlap with the
// claim concept; revisit if per-review theme tags become available.
const CLAIM_TERMS: Record<string, string[]> = {
  q1: ["discover", "new music", "new artist", "find new", "fresh", "recommend", "narrow", "same artist"],
  q2: ["recommend", "suggestion", "off", "irrelevant", "wrong", "algorithm", "not match", "bad recommend"],
  q3: ["my playlist", "control", "let me", "choose", "want", "mood", "my own"],
  q4: ["shuffle", "repeat", "repeated", "same song", "same track", "loop", "looping", "radio", "small pool", "stale", "over and over"],
  q5: ["premium", "years", "library", "power", "thousands", "since", "long time"],
  q6: ["shuffle", "dislike", "reset", "not interested", "narrow", "ai", "generated", "can't find"],
  q7: ["discover weekly", "release radar", "daily mix", "radio", "smart shuffle", "ai dj", "home"],
  q8: ["new artist", "new song", "genre", "niche", "regional", "deep cut", "fresh", "underground"],
  q9: ["mood", "vibe", "context", "workout", "study", "sleep", "driving"],
  q10: ["dislike", "reset", "not interested", "block", "control", "tune", "thumbs"],
  q11: ["youtube", "tiktok", "apple music", "soundcloud", "shazam", "switch", "instead"],
  q12: ["bored", "boring", "stale", "fatigue", "tired", "disappoint", "distrust", "frustrat"],
};
function scoredQuotes(item: PilotAnswer): Review[] {
  const terms = CLAIM_TERMS[item.id] ?? [];
  const pool = item.evidence_reviews ?? item.quotes ?? [];
  const scored = pool.map((r) => ({ r, s: terms.reduce((a, t) => (r.text.toLowerCase().includes(t) ? a + 1 : a), 0) }))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const out: Review[] = []; const seenSrc = new Set<string>();
  for (const { r } of scored) {            // prefer relevance, then source diversity
    if (!seenSrc.has(r.source)) { seenSrc.add(r.source); out.push(r); }
    if (out.length >= 3) break;
  }
  for (const { r } of scored) { if (out.length >= 3) break; if (!out.includes(r)) out.push(r); }
  return out.length >= 2 ? out.slice(0, 3) : (item.quotes ?? []).slice(0, 3);
}

const FALLBACK_MSG =
  "I can answer the Spotify discovery research questions using the frozen review dataset. " +
  "Choose one of the suggested questions.";
const fmt = (n: number) => n.toLocaleString();

/* ---------- compact funnel stepper ---------- */
function Funnel({ stages }: { stages: { label: string; count: number }[] }) {
  if (!stages?.length) return null;
  return (
    <div className="ac-funnel">
      {stages.map((s, i) => (
        <span className="acf-step" key={i}>
          <span className="acf-cl"><span className="acf-count">{fmt(s.count)}</span>
            <span className="acf-label">{s.label}</span></span>
          {i < stages.length - 1 && <span className="acf-arrow">→</span>}
        </span>
      ))}
    </div>
  );
}

/* ---------- expandable quote ---------- */
function QuoteCard({ r }: { r: Review }) {
  const [open, setOpen] = useState(false);
  const long = r.text.length > 140;
  return (
    <div className="evq">
      <div className={`evq-text ${open ? "" : "clamp2"}`}>{r.text}</div>
      <div className="evq-foot">
        <span className="evq-meta">{SRC_LABEL[r.source] || r.source}
          {r.region ? ` · ${r.region}` : ""}{r.rating ? ` · ★${r.rating}` : ""}{r.date ? ` · ${r.date}` : ""}</span>
        {long && <button className="link-btn" onClick={() => setOpen(!open)}>{open ? "less" : "more"}</button>}
      </div>
    </div>
  );
}

/* ---------- grounding line ---------- */
function groundingLine(item: PilotAnswer): string | null {
  const g = item.grounding;
  if (!g || !g.n) return null;
  const parts: string[] = [];
  const bs = g.by_source || {};
  const top = Object.entries(bs).sort((a, b) => b[1] - a[1]).slice(0, 2);
  top.forEach(([k, v]) => parts.push(`${Math.round(v * 100)}% ${SRC_LABEL[k] || k}`));
  if (g.avg_rating != null) parts.push(`avg rating ${g.avg_rating}`);
  if (g.top_region) parts.push(`top region ${g.top_region}`);
  return `Of ${fmt(g.n)} matching reviews: ${parts.join(" · ")}.`;
}

/* ---------- structured answer card ---------- */
function AnswerCard({ item, onEvidence, onAsk }:
  { item: PilotAnswer; onEvidence: (id: string) => void; onAsk: (id: string) => void }) {
  const quotes = scoredQuotes(item);
  const ground = groundingLine(item);
  const idx = ITEMS.findIndex((x) => x.id === item.id);
  const followups = [1, 2, 3].map((o) => ITEMS[(idx + o) % ITEMS.length]).filter((f) => f.id !== item.id);
  return (
    <div className="ac">
      {/* A · Executive summary */}
      <div className="ac-summary"><span className="ac-tag">Executive summary</span>{item.a || "Not available"}</div>

      {/* B · Theme breakdown */}
      {!!item.themes?.length && (
        <div className="ac-block"><div className="ac-label">Theme breakdown</div>
          <div className="chips">{item.themes.map((t) => <span className="chip-tag" key={t}>{t}</span>)}</div></div>
      )}
      {/* C · Affected user segments */}
      {!!item.segments?.length && (
        <div className="ac-block"><div className="ac-label">Affected user segments</div>
          <div className="chips">{item.segments.map((t) => <span className="chip-seg" key={t}>{t}</span>)}</div></div>
      )}

      {/* D · Evidence (funnel + grounding + quotes) */}
      <div className="ac-block">
        <div className="ac-label">Evidence</div>
        <Funnel stages={item.funnel ?? []} />
        {ground && <div className="ac-ground">{ground}</div>}
        {quotes.length === 0 ? <div className="na">Evidence details not available</div> :
          quotes.map((r, i) => <QuoteCard r={r} key={i} />)}
        <button className="link-btn strong" onClick={() => onEvidence(item.id)}>
          {item.evidence != null ? `See all ${fmt(item.evidence)} reviews →` : "Inspect matching reviews →"}
        </button>
      </div>

      {/* E · sub-need breakdown (honest math) */}
      {!!item.sub_needs?.length && (
        <div className="ac-block"><div className="ac-label">Top recurring sub-needs within the matching set</div>
          <div className="subneeds">
            {item.sub_needs.map((s) => (
              <div className="subneed" key={s.label}><span>{s.label}</span><b>{fmt(s.count)}</b></div>
            ))}
          </div></div>
      )}

      {/* F · Key insight */}
      {item.key_insight && <div className="ac-key"><span className="ac-keytag">Key insight</span>{item.key_insight}</div>}

      {/* G · Product recommendations */}
      {!!item.recommendations?.length && (
        <div className="ac-block"><div className="ac-label">Product recommendations</div>
          <ol className="recs">{item.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol></div>
      )}

      {/* follow-ups */}
      {followups.length > 0 && (
        <div className="ac-block"><div className="ac-label">Follow-up questions</div>
          <div className="followups">{followups.map((f) =>
            <button className="followup-chip" key={f.id} onClick={() => onAsk(f.id)}>{f.q}</button>)}</div></div>
      )}
    </div>
  );
}

/* ---------- evidence drawer ---------- */
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
          <div><div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" }}>Evidence behind the claim</div>
            <h2 style={{ margin: "2px 0 0", fontSize: 17 }}>{answer.q}</h2></div>
          <button className="copy-btn" onClick={onClose}>✕ close</button>
        </div>
        <div className="ev-filters">
          <select value={src} onChange={(e) => setSrc(e.target.value)}><option value="">All sources</option>
            {opts("source").map((s) => <option key={s} value={s}>{SRC_LABEL[s] || s}</option>)}</select>
          <select value={reg} onChange={(e) => setReg(e.target.value)}><option value="">All regions</option>
            {opts("region").map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <select value={rat} onChange={(e) => setRat(e.target.value)}><option value="">All ratings</option>
            {opts("rating").sort().map((s) => <option key={s} value={s}>★ {s}</option>)}</select>
          <input type="text" placeholder="From date YYYY-MM-DD" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 160 }} />
        </div>
        <div className="ev-status">Filtered evidence sample · {filtered.length} of {reviews.length} reviews
          {active.length > 0 && <span> · {active.map((a, i) => <span className="filter-chip" key={i}>{a}</span>)}</span>}</div>
        <div className="ev-list">
          {filtered.length === 0 ? <div className="na">Evidence details not available for these filters.</div> :
            filtered.map((r, i) => (
              <div className="ev-card" key={i}>
                <div className="ev-meta">
                  <span className="badge green">{SRC_LABEL[r.source] || r.source}</span>
                  {r.region && <span className="badge grey">{r.region}</span>}
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

/* ---------- page ---------- */
type Msg = { role: "user"; text: string } | { role: "bot"; id: string } | { role: "bot-fallback" };

export default function AiPilot() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [modalId, setModalId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (msgs.length) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const ask = (text: string, id?: string) => {
    if (!text.trim() && !id) return;
    const matched = id ?? matchId(text);
    const userText = id ? BY_ID[id]?.q ?? text : text;
    setMsgs((m) => [...m, { role: "user", text: userText },
      matched ? { role: "bot", id: matched } : { role: "bot-fallback" }]);
    setInput("");
  };
  const modalAnswer = modalId ? BY_ID[modalId] : null;

  return (
    <>
      <div className="copilot-header">
        <span className="copilot-icon big">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#04130a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v3M5 8h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" /></svg>
        </span>
        <div>
          <h1 style={{ margin: 0 }}>Discovery Copilot</h1>
          <div className="muted" style={{ fontSize: 14 }}>Ask the AI product analyst about music-discovery feedback.</div>
        </div>
      </div>
      <span className="dataset-status">Frozen v1 · 26,823 curated reviews analyzed</span>
      <div className="dataset-note">Frozen v1 is the curated analysis dataset after filtering, cleaning, and relevance selection.</div>

      <div className="copilot-body">
        {msgs.length === 0 && (
          <div className="copilot-empty">
            <h2 style={{ margin: "0 0 4px" }}>How can I help your discovery research?</h2>
            <div className="muted" style={{ fontSize: 13.5 }}>I analyze Spotify reviews and discussions to answer PM discovery questions with evidence-backed insights.</div>
          </div>
        )}

        {msgs.map((m, i) => {
          if (m.role === "user") return <div className="bubble-user" key={i}>{m.text}</div>;
          if (m.role === "bot-fallback") return <div className="ac" key={i}><div className="ac-summary">{FALLBACK_MSG}</div></div>;
          const item = BY_ID[m.id];
          return item ? <AnswerCard key={i} item={item} onEvidence={setModalId} onAsk={(id) => ask("", id)} />
            : <div className="ac" key={i}><div className="ac-summary na">Not available.</div></div>;
        })}

        <div className="copilot-cards-label">{msgs.length ? "Suggested questions" : "Research questions"}</div>
        <div className="qopts">
          {ITEMS.map((it, i) => (
            <button className="qopt" key={it.id} onClick={() => ask(it.q, it.id)}>
              <span className="qopt-n">{String(i + 1).padStart(2, "0")}</span><span>{it.q}</span>
            </button>
          ))}
        </div>
        <div ref={endRef} />
      </div>

      <form className="copilot-bar" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <div className="copilot-bar-row">
          <input type="text" placeholder="Ask about discovery, recommendations, themes, segments…"
            value={input} onChange={(e) => setInput(e.target.value)} />
          <button type="submit" className="send-btn">Send</button>
        </div>
        <div className="ground-note">Answers are grounded in real reviews via RAG.</div>
      </form>

      {modalAnswer && <EvidenceDrawer answer={modalAnswer} onClose={() => setModalId(null)} />}
    </>
  );
}
