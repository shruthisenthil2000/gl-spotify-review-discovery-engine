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
  const res = await fetch(path, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

export const getEngine = () => fetchJSON<Engine>("/data/engine_output.json");
export const getSummary = () => fetchJSON<Summary>("/data/dashboard_summary.json");
export const getReviews = () => fetchJSON<ReviewsFile>("/data/reviews_sample.json");

// --- formatting helpers (show "Not available" when a metric is missing) ---
export const num = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? NA : v.toLocaleString();
export const pct = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? NA : `${(v * 100).toFixed(digits)}%`;
export const tital = (s: string) => s.replace(/_/g, " ");
