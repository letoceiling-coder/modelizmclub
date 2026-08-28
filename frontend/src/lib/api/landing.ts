import { api } from "./client";

export interface LandingStats {
  users: number;
  communities: number;
  listing_categories: number;
}

/** Empty fallback when API has no data — never use mock stats on production. */
const EMPTY_LANDING_STATS: LandingStats = { users: 0, communities: 0, listing_categories: 0 };

let cached: LandingStats | null = null;

export function seedLandingStats(data: LandingStats): void {
  cached = data;
}

export function getCachedLandingStats(): LandingStats | null {
  return cached;
}

export async function fetchLandingStats(): Promise<LandingStats> {
  if (cached) return cached;
  try {
    const { startPublicBootstrap } = await import("./bootstrap");
    const boot = await startPublicBootstrap();
    if (boot?.landing_stats) {
      cached = boot.landing_stats;
      return cached;
    }
  } catch {
    /* dedicated endpoint below */
  }
  const res = await api<{ data: LandingStats }>("/public/landing-stats", { auth: false });
  cached = res.data ?? EMPTY_LANDING_STATS;
  return cached;
}

/** Format platform stat for hero badges, e.g. 1200 → "1 200+" */
export function formatLandingStat(value: number): string {
  if (value >= 100) {
    const rounded = value >= 1000 ? Math.floor(value / 100) * 100 : value;
    return `${rounded.toLocaleString("ru-RU")}+`;
  }
  return String(value);
}
