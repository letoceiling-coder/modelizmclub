import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";

export interface SellerStats {
  active: number;
  total: number;
  views_total: number;
  favorites_total: number;
  by_status: Record<string, number>;
}

export interface ViewsDailyPoint {
  date: string;
  count: number;
}

export async function fetchMyStats(): Promise<SellerStats> {
  if (isDemoMode()) {
    const { fetchMyListings } = await import("@/lib/api/listings");
    const rows = await fetchMyListings();
    const byStatus: Record<string, number> = {};
    let views = 0;
    let favorites = 0;
    let active = 0;
    for (const { ad, status } of rows) {
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      views += ad.views ?? 0;
      favorites += ad.likes ?? 0;
      if (status === "active") active++;
    }
    return {
      active,
      total: rows.length,
      views_total: views,
      favorites_total: favorites,
      by_status: byStatus,
    };
  }
  return api<SellerStats>("/users/me/stats");
}

export async function fetchViewsDaily(range = "30d"): Promise<ViewsDailyPoint[]> {
  if (isDemoMode()) return [];
  const res = await api<{ data: ViewsDailyPoint[] }>("/users/me/stats/views-daily", {
    query: { range },
  });
  return res.data ?? [];
}
