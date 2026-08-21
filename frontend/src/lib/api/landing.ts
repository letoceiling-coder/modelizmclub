import { api } from "./client";

export interface LandingStats {
  users: number;
  communities: number;
  listing_categories: number;
}

/** Empty fallback when API has no data — never use mock stats on production. */
const EMPTY_LANDING_STATS: LandingStats = { users: 0, communities: 0, listing_categories: 0 };

export async function fetchLandingStats(): Promise<LandingStats> {
  const res = await api<{ data: LandingStats }>("/public/landing-stats", { auth: false });
  return res.data ?? EMPTY_LANDING_STATS;
}

/** Format platform stat for hero badges, e.g. 1200 → "1 200+" */
export function formatLandingStat(value: number): string {
  if (value >= 100) {
    const rounded = value >= 1000 ? Math.floor(value / 100) * 100 : value;
    return `${rounded.toLocaleString("ru-RU")}+`;
  }
  return String(value);
}
