import { useEffect, useState } from "react";
import { fetchCategoryRoomStats, type CategoryRoomStats } from "@/lib/api/room-chat";
import { isDemoMode } from "@/lib/demo-mode";
import { getToken } from "@/lib/api/client";

const EMPTY: CategoryRoomStats = { bySubcategory: {}, byParent: {} };

let cache: CategoryRoomStats | null = null;
let inflight: Promise<CategoryRoomStats> | null = null;

export function useCategoryRoomStats(parentId?: string): CategoryRoomStats {
  const [stats, setStats] = useState<CategoryRoomStats>(cache ?? EMPTY);

  useEffect(() => {
    if (isDemoMode() || !getToken()) {
      setStats(EMPTY);
      return;
    }
    if (!parentId && cache) {
      setStats(cache);
      return;
    }
    let active = true;
    const load = inflight ?? fetchCategoryRoomStats(parentId);
    if (!parentId) inflight = load;
    load
      .then((data) => {
        if (!active) return;
        if (!parentId) cache = data;
        setStats(data);
      })
      .catch(() => {
        if (active) setStats(EMPTY);
      })
      .finally(() => {
        if (!parentId) inflight = null;
      });
    return () => {
      active = false;
    };
  }, [parentId]);

  return stats;
}

export function onlineForCategory(stats: CategoryRoomStats, categoryId: string): number {
  return stats.byParent[categoryId]?.online ?? 0;
}

export function onlineForSubcategory(stats: CategoryRoomStats, subcategoryId: string): number {
  return stats.bySubcategory[subcategoryId]?.online ?? 0;
}

export function membersForSubcategory(stats: CategoryRoomStats, subcategoryId: string): number {
  return stats.bySubcategory[subcategoryId]?.members ?? 0;
}

export function totalOnlineFromStats(stats: CategoryRoomStats): number {
  return Object.values(stats.byParent).reduce((sum, row) => sum + (row.online ?? 0), 0);
}
