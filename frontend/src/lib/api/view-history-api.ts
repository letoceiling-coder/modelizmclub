import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import type { ViewHistoryItem } from "@/lib/view-history";

interface ApiViewHistoryRow {
  id: string;
  kind: "ad" | "profile" | "review";
  title: string;
  thumb?: string | null;
  viewed_at: string;
}

function mapRow(row: ApiViewHistoryRow): ViewHistoryItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    thumb: row.thumb ?? undefined,
    viewedAt: row.viewed_at,
  };
}

export async function fetchViewHistory(perPage = 50): Promise<ViewHistoryItem[]> {
  if (isDemoMode()) {
    const { getViewHistory } = await import("@/lib/view-history");
    return getViewHistory();
  }
  const res = await api<{ data: ApiViewHistoryRow[] }>("/me/view-history", {
    query: { per_page: perPage },
  });
  return (res.data ?? []).map(mapRow);
}

export async function recordViewHistory(item: Omit<ViewHistoryItem, "viewedAt">): Promise<void> {
  if (isDemoMode()) {
    const { recordView } = await import("@/lib/view-history");
    recordView(item);
    return;
  }
  try {
    await api("/me/view-history", {
      method: "POST",
      json: {
        id: item.id,
        kind: item.kind,
        title: item.title,
        thumb: item.thumb ?? null,
      },
    });
  } catch {
    // Non-critical — page view still works if history sync fails.
  }
}

export async function clearViewHistoryRemote(): Promise<void> {
  if (isDemoMode()) {
    const { clearViewHistory } = await import("@/lib/view-history");
    clearViewHistory();
    return;
  }
  await api("/me/view-history", { method: "DELETE" });
}
