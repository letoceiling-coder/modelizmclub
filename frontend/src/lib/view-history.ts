// Client-side "recently viewed" list with optional server sync when authenticated.

export interface ViewHistoryItem {
  id: string;
  kind: "ad" | "profile" | "review" | "community";
  title: string;
  thumb?: string;
  viewedAt: string;
}

const KEY = "modelizm_view_history";
const CAP = 50;

export function getViewHistory(): ViewHistoryItem[] {
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

export function recordView(item: Omit<ViewHistoryItem, "viewedAt">): void {
  if (typeof window === "undefined") return;
  const entry: ViewHistoryItem = { ...item, viewedAt: new Date().toISOString() };
  const rest = getViewHistory().filter((x) => !(x.kind === entry.kind && x.id === entry.id));
  const next = [entry, ...rest].slice(0, CAP);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  void import("@/lib/api/view-history-api").then(({ recordViewHistory }) => recordViewHistory(item));
}

export function clearViewHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
