import type { AppNotification } from "@/lib/api/notifications";
import { mapMessage, type ApiMessage } from "@/lib/api/chat";
import { getToken } from "@/lib/api/client";
import { GUEST_USER, getState } from "@/lib/store";
import { messengerCache } from "@/lib/messenger";
import { ingestCallSignal } from "@/lib/calls";
import { subscribeUser } from "@/lib/realtime/echo";
import { playMessagePing } from "@/lib/callAudio";
import { claimMessagePing, isMessageSoundEnabled, shouldPlayMessagePing } from "@/lib/messageSound";

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

/** Вид объекта, о котором сервер сообщает владельцу. */
export type ObjectKind = "listing" | "post" | "deal";

export interface ObjectUpdate {
  kind: ObjectKind;
  uuid: string;
  status: string | null;
}

const objectListeners = new Set<(u: ObjectUpdate) => void>();

/**
 * Объект человека изменился на сервере — объявление прошло модерацию,
 * сделка сменила шаг.
 *
 * Экран до 21.09 показывал прежнее состояние, пока страницу не перезагрузят:
 * колокольчик говорил «объявление одобрено», а карточка рядом висела «на
 * проверке». Личный канал `user.{uuid}` для этого уже был — не хватало
 * события о самом объекте.
 *
 * Подписчик получает вид, идентификатор и новый статус. Содержимое объекта
 * перечитывается запросом: в событии его нет намеренно, иначе экран разошёлся
 * бы с сервером в полях, которых событие не несёт.
 */
export function onObjectUpdate(cb: (u: ObjectUpdate) => void): () => void {
  objectListeners.add(cb);
  return () => objectListeners.delete(cb);
}

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

export function bumpUnreadNotifications(): void {
  unreadBumpListeners.forEach((cb) => cb());
}

function handleEvent(payload: { type?: string; payload?: unknown }): void {
  const type = payload.type;
  const data = payload.payload;
  if (!type || !data) return;

  if (type === "message") {
    const p = data as {
      conversation_uuid?: string;
      message?: ApiMessage & { author?: { display_name?: string; name?: string }; body?: string };
    };
    if (!p.conversation_uuid || !p.message) return;
    const message = mapMessage(p.message);
    const notViewing = watchingDialogId !== p.conversation_uuid;
    messengerCache.ingestIncoming(p.conversation_uuid, message, notViewing);
    const muted = Boolean(getState().dialogMeta[p.conversation_uuid]?.muted);
    const play = shouldPlayMessagePing({
      watchingDialogId,
      conversationUuid: p.conversation_uuid,
      muted,
      soundEnabled: isMessageSoundEnabled(),
    });
    if (play) {
      void claimMessagePing(message.id).then((mine) => {
        if (!mine) return;
        try {
          playMessagePing();
        } catch {
          /* ignore */
        }
      });
    }
    return;
  }

  if (type === "conversation.read") {
    const p = data as { conversation_uuid?: string };
    if (!p.conversation_uuid) return;
    messengerCache.markOwnStatus(p.conversation_uuid, "read");
    return;
  }

  if (type === "notification") {
    const p = data as { notification?: ApiNotificationPayload };
    if (!p.notification) return;
    const notifType = p.notification.type ?? "";
    const link = p.notification.link ?? "";
    if (
      (notifType === "message" || notifType === "messages") &&
      watchingDialogId &&
      link.includes(watchingDialogId)
    ) {
      return;
    }
    const n = mapRealtimeNotification(p.notification);
    notificationListeners.forEach((cb) => cb(n));
    unreadBumpListeners.forEach((cb) => cb());
    return;
  }

  if (type === "object.updated") {
    const p = data as { kind?: string; uuid?: string; status?: string | null };
    if (!p.kind || !p.uuid) return;
    if (p.kind !== "listing" && p.kind !== "post" && p.kind !== "deal") return;
    const update: ObjectUpdate = { kind: p.kind, uuid: p.uuid, status: p.status ?? null };
    objectListeners.forEach((cb) => cb(update));
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
  /*
   * Подписчиков здесь не трогаем: их снимает уборка эффекта того, кто
   * подписался. Чистка списка на выходе из учётки молча отобрала бы
   * подписку у компонента, который остался на экране, — а вернуть её было
   * бы некому: его эффект уже отработал.
   */
  if (unsub) {
    unsub();
    unsub = null;
  }
  watchingDialogId = null;
}
