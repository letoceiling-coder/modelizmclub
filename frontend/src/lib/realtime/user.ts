import type { AppNotification } from "@/lib/api/notifications";
import { mapMessage, type ApiMessage } from "@/lib/api/chat";
import { getToken } from "@/lib/api/client";
import { GUEST_USER, ingestIncomingMessage } from "@/lib/store";
import { ingestCallSignal } from "@/lib/calls";
import { subscribeUser } from "@/lib/realtime/echo";

interface ApiNotificationPayload {
  id: string;
  type?: string;
  title?: string;
  body?: string;
  link?: string | null;
  read?: boolean;
  created_at?: string;
}

function mapRealtimeNotification(n: ApiNotificationPayload): AppNotification {
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

let unsub: (() => void) | null = null;
let initGen = 0;
let watchingDialogId: string | null = null;

const notificationListeners = new Set<(n: AppNotification) => void>();
const unreadBumpListeners = new Set<() => void>();

export function setWatchingDialog(id: string | null): void {
  watchingDialogId = id;
}

export function onRealtimeNotification(cb: (n: AppNotification) => void): () => void {
  notificationListeners.add(cb);
  return () => notificationListeners.delete(cb);
}

export function onUnreadBump(cb: () => void): () => void {
  unreadBumpListeners.add(cb);
  return () => unreadBumpListeners.delete(cb);
}

function handleEvent(payload: { type?: string; payload?: unknown }): void {
  const type = payload.type;
  const data = payload.payload;
  if (!type || !data) return;

  if (type === "message") {
    const p = data as { conversation_uuid?: string; message?: ApiMessage };
    if (!p.conversation_uuid || !p.message) return;
    const message = mapMessage(p.message);
    const incrementUnread = watchingDialogId !== p.conversation_uuid;
    ingestIncomingMessage(p.conversation_uuid, message, incrementUnread);
    return;
  }

  if (type === "notification") {
    const p = data as { notification?: ApiNotificationPayload };
    if (!p.notification) return;
    const n = mapRealtimeNotification(p.notification);
    notificationListeners.forEach((cb) => cb(n));
    unreadBumpListeners.forEach((cb) => cb());
    return;
  }

  if (type === "call") {
    ingestCallSignal(data as { type: string; [k: string]: unknown });
  }
}

/** Subscribe to the logged-in user's personal realtime channel. */
export async function initUserRealtime(userUuid: string): Promise<void> {
  if (!userUuid || userUuid === GUEST_USER.id) return;
  if (!getToken()) return;

  const gen = ++initGen;
  if (unsub) {
    unsub();
    unsub = null;
  }

  const off = await subscribeUser(userUuid, handleEvent);
  if (gen !== initGen) {
    off();
    return;
  }
  unsub = off;
}

export function resetUserRealtime(): void {
  initGen++;
  if (unsub) {
    unsub();
    unsub = null;
  }
  watchingDialogId = null;
}
