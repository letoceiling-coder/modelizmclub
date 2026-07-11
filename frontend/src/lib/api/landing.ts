import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { categories } from "@/lib/mock";

export interface LandingStats {
  users: number;
  communities: number;
  listing_categories: number;
}

/** listing_categories is derived from the categories list — a hardcoded
 *  count here previously drifted (stuck at 8 after the list grew to 20). */
function demoStats(): LandingStats {
  return { users: 1200, communities: 45, listing_categories: categories.length };
}

export async function fetchLandingStats(): Promise<LandingStats> {
  if (isDemoMode()) return demoStats();
  const res = await api<{ data: LandingStats }>("/public/landing-stats");
  return res.data ?? demoStats();
}

/** Format platform stat for hero badges, e.g. 1200 → "1 200+" */
export function formatLandingStat(value: number): string {
  if (value >= 100) {
    const rounded = value >= 1000 ? Math.floor(value / 100) * 100 : value;
    return `${rounded.toLocaleString("ru-RU")}+`;
  }
  return String(value);
}
