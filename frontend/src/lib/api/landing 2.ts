import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";

export interface LandingStats {
  users: number;
  communities: number;
  listing_categories: number;
}

const DEMO_STATS: LandingStats = {
  users: 1200,
  communities: 45,
  listing_categories: 8,
};

export async function fetchLandingStats(): Promise<LandingStats> {
  if (isDemoMode()) return DEMO_STATS;
  const res = await api<{ data: LandingStats }>("/public/landing-stats");
  return res.data ?? DEMO_STATS;
}

/** Format platform stat for hero badges, e.g. 1200 → "1 200+" */
export function formatLandingStat(value: number): string {
  if (value >= 100) {
    const rounded = value >= 1000 ? Math.floor(value / 100) * 100 : value;
    return `${rounded.toLocaleString("ru-RU")}+`;
  }
  return String(value);
}
