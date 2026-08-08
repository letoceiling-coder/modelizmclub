/** Client-side "watch later" list for reviews until a server bookmark API exists. */

export interface WatchLaterItem {
  id: string;
  title: string;
  posterUrl?: string;
  addedAt: string;
}

const KEY = "modelizm_watch_later_reviews";
const CAP = 100;

export function getWatchLater(): WatchLaterItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function isWatchLater(id: string): boolean {
  return getWatchLater().some((x) => x.id === id);
}

export function toggleWatchLater(item: Omit<WatchLaterItem, "addedAt">): boolean {
  if (typeof window === "undefined") return false;
  const list = getWatchLater();
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    window.localStorage.setItem(KEY, JSON.stringify(list));
    return false;
  }
  const next: WatchLaterItem[] = [{ ...item, addedAt: new Date().toISOString() }, ...list].slice(0, CAP);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return true;
}
