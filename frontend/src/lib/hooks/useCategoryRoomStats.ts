import { useEffect, useState } from "react";
import { fetchCategoryRoomStats, type CategoryRoomStats } from "@/lib/api/room-chat";
import { isDemoMode } from "@/lib/demo-mode";
import { getToken } from "@/lib/api/client";

const EMPTY: CategoryRoomStats = { bySubcategory: {}, byParent: {} };

let cache: CategoryRoomStats | null = null;
let inflight: Promise<CategoryRoomStats> | null = null;

export function prefetchCategoryRoomStats(parentId?: string): Promise<CategoryRoomStats> {
  if (isDemoMode() || typeof window === "undefined" || !getToken()) {
    return Promise.resolve(parentId ? EMPTY : (cache ?? EMPTY));
  }
  if (!parentId && cache) return Promise.resolve(cache);
  const load = !parentId && inflight ? inflight : fetchCategoryRoomStats(parentId);
  if (!parentId) inflight = load;
  return load
    .then((data) => {
      if (!parentId) cache = data;
      return data;
    })
    .catch(() => (parentId ? EMPTY : (cache ?? EMPTY)))
    .finally(() => {
      if (!parentId) inflight = null;
    });
}

export function useCategoryRoomStats(parentId?: string): CategoryRoomStats {
  const [stats, setStats] = useState<CategoryRoomStats>(() => (!parentId && cache ? cache : EMPTY));

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
    void prefetchCategoryRoomStats(parentId).then((data) => {
      if (active) setStats(data);
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
