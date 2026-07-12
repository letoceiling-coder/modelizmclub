// Client-only "recently viewed" list (per-device). Server-side
// personalization is backend-track — see backend-endpoints-needed.md #24.

export interface ViewHistoryItem {
  id: string;
  kind: "ad" | "profile" | "review";
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
  // De-dupe by kind+id (move to front), then cap.
  const rest = getViewHistory().filter((x) => !(x.kind === entry.kind && x.id === entry.id));
  const next = [entry, ...rest].slice(0, CAP);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearViewHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
