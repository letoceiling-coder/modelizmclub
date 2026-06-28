import { api } from "./client";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface ApiNotification {
  id: string;
  type?: string;
  title?: string;
  body?: string;
  link?: string | null;
  read?: boolean;
  created_at?: string;
}

function mapNotification(n: ApiNotification): AppNotification {
  return {
    id: n.id,
    type: n.type ?? "system",
    title: n.title ?? "",
    body: n.body ?? "",
    link: n.link ?? null,
    read: Boolean(n.read),
    createdAt: n.created_at ?? "",
  };
}

export async function fetchNotifications(): Promise<{ items: AppNotification[]; unread: number }> {
  const res = await api<{ data: ApiNotification[]; meta?: { unread?: number } }>(
    "/users/me/notifications",
    { query: { per_page: 30 } },
  );
  return {
    items: (res.data ?? []).map(mapNotification),
    unread: res.meta?.unread ?? 0,
  };
}

export async function fetchUnreadCount(): Promise<number> {
  try {
    const res = await api<{ data: { unread?: number } }>("/users/me/notifications/unread-count");
    return res.data?.unread ?? 0;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  await api(`/users/me/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api("/users/me/notifications/read-all", { method: "POST" });
}
