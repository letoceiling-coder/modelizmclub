// Client-side "hidden from my feed" list. There is no backend hide endpoint,
// so hidden post ids are persisted in localStorage and filtered out of the feed
// on load and after the action.

const KEY = "mc:hidden-posts:v1";

export function getHiddenPostIds(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persist(ids: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota errors */
  }
}

export function hidePostId(id: string): void {
  const ids = getHiddenPostIds();
  ids.add(id);
  persist(ids);
}

export function unhidePostId(id: string): void {
  const ids = getHiddenPostIds();
  ids.delete(id);
  persist(ids);
}
