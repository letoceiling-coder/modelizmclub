import type { Message } from "@/lib/mock";
import { getToken } from "@/lib/api/client";
import { GUEST_USER } from "@/lib/store";
import { calls, syncIncomingOffer } from "@/lib/calls";
import { initUserRealtime, resetUserRealtime } from "@/lib/realtime/user";
import { initPresence, resetPresence } from "@/lib/realtime/presence";
import { startPresenceHeartbeat, stopPresenceHeartbeat } from "@/lib/presence-heartbeat";
import {
  getEcho,
  isEchoConnected,
  onEchoReconnect,
  reconnectEcho,
  resetEcho,
  subscribeConversation,
} from "@/lib/realtime/echo";

const WATCHDOG_MS = 20_000;

let hubUser: string | null = null;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let lifecycleBound = false;
let reconnectHooked = false;

/*
 * Подписки на беседы — по одной на идентификатор, а не одна на всё.
 *
 * Здесь стояла единственная ячейка `convId`/`convHandler`, и писали в неё два
 * места: мессенджер и чат направления. Пока они разные маршруты и не живут
 * одновременно, беды не было. Первый же чат, открытый поверх другого —
 * мессенджер шторкой над страницей направления, — молча отписал бы нижний:
 * второй вызов затирал ячейку, а закрытие верхнего звало `null` и снимало
 * то, что осталось. Выглядело бы это как «сообщения перестали приходить
 * сами», а не как ошибка (разведка 21.09).
 *
 * Каждая беседа держит свою запись. Уходит только та, которую закрыли.
 */
interface ConvSub {
  handler: (m: Message) => void;
  onDelete?: (messageUuid: string) => void;
  /** Снятие подписки; пока идёт привязка — `null`. */
  unsub: (() => void) | null;
  /** Номер попытки: ответ устаревшей привязки не должен перетирать свежую. */
  seq: number;
}

const convs = new Map<string, ConvSub>();
let bindSeq = 0;

async function bindConversation(id: string): Promise<void> {
  const sub = convs.get(id);
  if (!sub) return;
  const seq = ++bindSeq;
  sub.seq = seq;
  if (sub.unsub) {
    sub.unsub();
    sub.unsub = null;
  }
  if (!getToken()) return;
  const unsub = await subscribeConversation(id, sub.handler, sub.onDelete);
  const current = convs.get(id);
  // Пока ходили за подпиской, беседу могли закрыть или перепривязать.
  if (!current || current.seq !== seq) {
    unsub();
    return;
  }
  current.unsub = unsub;
}

async function bindAllConversations(): Promise<void> {
  await Promise.all([...convs.keys()].map((id) => bindConversation(id)));
}

function dropConversation(id: string): void {
  const sub = convs.get(id);
  if (!sub) return;
  // Номер меняем до снятия: привязка, которая сейчас в полёте, увидит
  // несовпадение и отпишется сама.
  sub.seq = ++bindSeq;
  if (sub.unsub) sub.unsub();
  convs.delete(id);
}

/** Re-subscribe personal channels after socket (re)connect. */
export async function resubscribeRealtime(): Promise<void> {
  if (!hubUser || hubUser === GUEST_USER.id || !getToken()) return;
  await getEcho();
  await calls.init(hubUser);
  await initUserRealtime(hubUser);
  resetPresence();
  await initPresence(hubUser);
  startPresenceHeartbeat();
  await bindAllConversations();
  syncIncomingOffer();
}

async function ensureConnection(): Promise<void> {
  if (!hubUser || !getToken()) return;
  if (!isEchoConnected()) {
    await reconnectEcho();
    await resubscribeRealtime();
  }
}

function bindLifecycle(): void {
  if (lifecycleBound || typeof window === "undefined") return;
  lifecycleBound = true;

  const wake = (): void => {
    void ensureConnection().then(() => syncIncomingOffer());
  };

  window.addEventListener("online", wake);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") wake();
  });
}

/**
 * Keep the user on realtime channels: auto-reconnect + re-subscribe on wake.
 */
export async function startRealtimeHub(userUuid: string): Promise<void> {
  if (!userUuid || userUuid === GUEST_USER.id || !getToken()) return;

  hubUser = userUuid;

  if (!reconnectHooked) {
    onEchoReconnect(() => void resubscribeRealtime());
    reconnectHooked = true;
  }

  if (!watchdogTimer) {
    watchdogTimer = setInterval(() => void ensureConnection(), WATCHDOG_MS);
  }

  bindLifecycle();
  await resubscribeRealtime();
}

/**
 * Открыть живую подписку на беседу. Возвращает снятие — вызывать в уборке
 * эффекта, и только оно снимает именно эту беседу.
 *
 * Подписки переживают переподключение сокета: `resubscribeRealtime`
 * привязывает заново все открытые.
 */
export function openHubConversation(
  id: string,
  onMessage: (m: Message) => void,
  onMessageDeleted?: (messageUuid: string) => void,
): () => void {
  convs.set(id, { handler: onMessage, onDelete: onMessageDeleted, unsub: null, seq: 0 });
  void bindConversation(id);
  return () => dropConversation(id);
}

export function stopRealtimeHub(): void {
  hubUser = null;
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
  // Выход из учётки снимает все беседы разом — в отличие от закрытия одной.
  [...convs.keys()].forEach(dropConversation);
  resetUserRealtime();
  resetPresence();
  stopPresenceHeartbeat();
  resetEcho();
}
