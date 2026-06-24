// Typed loaders for the frozen JSON exports in public/data/.
// No backend, no external APIs — pure static fetch on the client.

export const NA = "Not available";

export interface Engine {
  review_analytics: Record<string, number>;
  sentiment_distribution: { counts: Record<string, number>; share: Record<string, number>; net_sentiment: number };
  trend: { month: string; reviews: number; problem_rate: number; repetition_rate: number; positive_rate: number }[];
  theme_detection: {
    top_discovery_problems: { label: string; top_terms: string[]; size: number }[];
    top_recommendation_complaints: { label: string; top_terms: string[]; size: number }[];
    top_unmet_needs: { need: string; evidence_count: number; problem_share: number }[];
    emerging_themes: { theme: string; recent_share: number; prior_share: number; delta: number }[];
  };
  segmentation: {
    by_platform: Record<string, SegRow>;
    by_region: Record<string, SegRow>;
    by_language: Record<string, SegRow>;
    by_user_type: Record<string, SegRow>;
    most_affected_by_repetition: (SegRow & { cohort: string })[];
  };
  insights: Insight[];
  priority_radar: Radar[];
  weekly_pulse: Pulse;
}

export interface SegRow {
  total: number; repetition_rate: number; discovery_issue_rate: number;
  algorithm_mismatch_rate: number; problem_rate: number; positive_rate: number;
}
export interface Insight {
  title: string; category: string; evidence_count: number; negativity: number;
  reach_regions: number; affected_segment: string; severity_score: number;
  representative_quotes: { source: string; region: string; rating: string; text: string }[];
}
export interface Radar {
  opportunity: string; impact: number; frequency: number;
  priority_score: number; quadrant: string; category: string;
}
export interface Pulse {
  current_period?: string; prior_period?: string;
  key_trends?: { review_volume: number; volume_delta_vs_prev: number; problem_rate: number; problem_rate_prev: number };
  rising_issues?: { issue: string; current_share: number; delta_vs_prev: number }[];
  notable_discoveries?: { text: string; region: string }[];
  recommendation_system_risk?: { current: number; prior: number; direction: string };
  note?: string;
}
export interface Summary {
  totals: Record<string, number>;
  by_category: Record<string, number>;
  by_source: Record<string, number>;
  by_layer: Record<string, number>;
  by_sentiment: Record<string, number>;
  by_user_type: Record<string, number>;
  by_region: Record<string, number>;
  by_language: Record<string, number>;
  sentiment_distribution: Engine["sentiment_distribution"];
  review_analytics: Record<string, number>;
  trend: Engine["trend"];
}
export interface ReviewRow {
  id: string; source: string; country: string; lang: string; region: string;
  category: string; layer: string; sentiment: string; rating: string; text: string;
}
export interface ReviewsFile {
  full_total: number; sample_size: number;
  filters: { categories: string[]; sources: string[]; regions: string[]; sentiments: string[] };
  rows: ReviewRow[];
}

async function fetchJSON<T>(path: string): Promise<T> {
  // no-store so newly exported fields (source_detail, recent_reviews, …) are
  // never served from a stale browser cache of an older JSON build.
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

export interface Extra {
  friction: {
    average: number; distribution: Record<string, number>;
    by_category: Record<string, number>; explanation: string;
    top_high_friction_themes: { theme: string; avg_friction: number; count: number }[];
  };
  journey: {
    heuristic: boolean; distribution: Record<string, number>;
    avg_friction_by_stage: Record<string, number>;
    most_painful_stage: string; implications: Record<string, string>;
  };
  emotion: {
    heuristic: boolean; distribution: Record<string, number>;
    quotes: Record<string, { text: string; source: string; region: string; rating: string }>;
    explanation: string;
  };
  feature_frustration_map: {
    feature: string; mentions: number; evidence?: string;
    frustration_rate?: number;
    quote?: { text: string; source: string; region: string; rating: string } | null;
  }[];
  context_signals: {
    mood_context_mentions: number; control_wanted_mentions: number;
    workarounds: Record<string, number>;
  };
  segment_cards: {
    segment: string; total: number; heuristic: boolean;
    repetition_rate: number; problem_rate: number; top_pain_point: string;
    product_implication: string;
    quote?: { text: string; source: string; region: string; rating: string } | null;
  }[];
  root_cause_table: { theme: string; root_cause: string; opportunity: string; evidence: number | null }[];
  opportunities: { name: string; user_pain: string; evidence: number | null; segment: string; why: string }[];
  top5_insights: Insight[];
  free_paid: {
    heuristic: boolean; label: string; paid: number; free: number; unknown: number;
    paid_share: number; free_share: number;
  };
  source_detail?: { source: string; label: string; count: number;
    year_min: string | null; year_max: string | null; top_year: string | null;
    by_year: Record<string, number> }[];
  top_problem?: {
    title: string; category: string; count: number; pct_total: number;
    sentiment: Record<string, number>; frustration_pct: number; avg_friction: number;
    top_region: string | null; severity: number | null;
    quote?: { text: string; source: string; region: string; rating: string } | null;
  };
  recent_reviews?: { source: string; region: string; rating: string; date: string;
    sentiment: string; category: string; frustration: string; text: string }[];
  emotion_tier?: Record<string, { free: number; paid: number }>;
  year_distribution?: Record<string, number>;
  rating_distribution?: Record<string, number>;
  plan_breakdown?: Record<string, number>;
  per_platform?: Record<string, { reviews: number; avg_rating: number | null;
    positive_pct: number; frustrated_pct: number; theme_count: number; trend_reviews: number | null }>;
  desired_discovery_types: { type: string; evidence: number | string; count: number }[];
  listening_behaviors: { behavior: string; evidence: number }[];
  ai_pilot: {
    q: string; a: string; evidence: number | null; implication?: string; key_insight?: string;
    quote?: { text: string; source: string; region: string; rating: string } | null;
  }[];
}

export const getEngine = () => fetchJSON<Engine>("/data/engine_output.json");
export const getSummary = () => fetchJSON<Summary>("/data/dashboard_summary.json");
export const getReviews = () => fetchJSON<ReviewsFile>("/data/reviews_sample.json");
export const getExtra = () => fetchJSON<Extra>("/data/analysis_extra.json");

export const PROJECT = {
  title: "Spotify Discovery Intelligence Engine",
  subtitle:
    "AI-powered review analysis of Spotify discovery, recommendation quality, and repetitive listening behavior.",
  context:
    "Spotify has strong recommendation systems, but users still return to repeat playlists, " +
    "familiar artists, and previously discovered tracks. This engine analyzes user feedback at " +
    "scale to identify where discovery breaks, who is affected, and what Spotify should build next.",
  coreQuestions: [
    "Why do Spotify users keep returning to repeat playlists, familiar artists, and previously discovered songs?",
    "What specific recommendation failures make users feel stuck in a repetition loop?",
    "Which Spotify discovery features create the most frustration: Discover Weekly, Release Radar, Daily Mix, Radio, Smart Shuffle, AI DJ, or Home?",
    "What types of discovery do users actually want: new artists, new songs, new genres, niche music, regional music, or deeper cuts?",
    "Do users feel Spotify understands their current mood, context, and short-term listening intent?",
    "What signals do users want more control over: likes, dislikes, skips, blocks, reset taste profile, or 'not interested'?",
    "Which user segments face different discovery problems: casual listeners, power users, playlist-heavy users, niche listeners, multilingual listeners, or long-term users?",
    "What workarounds do users use when Spotify discovery fails, such as TikTok, YouTube, Reddit, friends, manual search, or old playlists?",
    "What emotional reactions appear most often in reviews: boredom, frustration, distrust, fatigue, disappointment, or loss of excitement?",
    "What unmet needs appear repeatedly across App Store reviews, Play Store reviews, Reddit, forums, and social conversations?",
  ],
  helpsDecide: [
    "Where music discovery breaks down across the user journey",
    "Which user segments and regions are most affected by repetition",
    "Which discovery features (Discover Weekly, Release Radar, Shuffle…) frustrate users most",
    "Which product opportunities to prioritize by Impact × Frequency",
  ],
  sourceLabels: {
    play_store: "Play Store", app_store: "App Store",
    reddit: "Reddit", forums: "Spotify Community Forums",
  } as Record<string, string>,
};

// --- formatting helpers (show "Not available" when a metric is missing) ---
export const num = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? NA : v.toLocaleString();
export const pct = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? NA : `${(v * 100).toFixed(digits)}%`;
export const tital = (s: string) => s.replace(/_/g, " ");
