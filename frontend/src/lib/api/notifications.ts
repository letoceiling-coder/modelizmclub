import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { demoNotifications } from "@/lib/demo-data";

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
  if (isDemoMode()) return demoNotifications();
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
  if (isDemoMode()) return demoNotifications().unread;
  try {
    const res = await api<{ data: { unread?: number } }>("/users/me/notifications/unread-count");
    return res.data?.unread ?? 0;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/users/me/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead(): Promise<void> {
  if (isDemoMode()) return;
  await api("/users/me/notifications/read-all", { method: "POST" });
}
