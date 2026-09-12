import type { Message } from "@/lib/mock";
import { getToken } from "@/lib/api/client";
import { GUEST_USER } from "@/lib/store";
/*
 * Звонковый стек — динамическим импортом.
 *
 * `lib/calls.ts` вместе с экранами звонка весит ~40 КБ до сжатия и лежал в
 * главном чанке: его качал и разбирал каждый посетитель ленты и каталога,
 * хотя звонок — действие из мессенджера. Статический импорт был здесь
 * единственной причиной, по которой модуль туда попадал.
 *
 * Подписку на входящие это не откладывает по смыслу: хаб и так поднимается
 * после готовности сессии, то есть уже за первым кадром. Импорт разрешается
 * один раз и кешируется движком модулей.
 */
type CallsModule = typeof import("@/lib/calls");
let callsModule: Promise<CallsModule> | null = null;
const loadCalls = (): Promise<CallsModule> => (callsModule ??= import("@/lib/calls"));
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

let convId: string | null = null;
let convHandler: ((m: Message) => void) | null = null;
let convDeleteHandler: ((messageUuid: string) => void) | null = null;
let convUnsub: (() => void) | null = null;

let bindSeq = 0;

async function bindConversation(): Promise<void> {
  const seq = ++bindSeq;
  if (convUnsub) {
    convUnsub();
    convUnsub = null;
  }
  if (!convId || !convHandler || !getToken()) return;
  const unsub = await subscribeConversation(convId, convHandler, convDeleteHandler ?? undefined);
  if (seq !== bindSeq) {
    unsub();
    return;
  }
  convUnsub = unsub;
}

/** Re-subscribe personal channels after socket (re)connect. */
export async function resubscribeRealtime(): Promise<void> {
  if (!hubUser || hubUser === GUEST_USER.id || !getToken()) return;
  await getEcho();
  const { calls } = await loadCalls();
  await calls.init(hubUser);
  await initUserRealtime(hubUser);
  resetPresence();
  await initPresence(hubUser);
  startPresenceHeartbeat();
  await bindConversation();
  (await loadCalls()).syncIncomingOffer();
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
    void ensureConnection().then(async () => (await loadCalls()).syncIncomingOffer());
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

/** Active chat — re-bound automatically after reconnect. */
export function setHubConversation(
  id: string | null,
  onMessage?: (m: Message) => void,
  onMessageDeleted?: (messageUuid: string) => void,
): void {
  convId = id;
  convHandler = onMessage ?? null;
  convDeleteHandler = onMessageDeleted ?? null;
  void bindConversation();
}

export function stopRealtimeHub(): void {
  hubUser = null;
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
  if (convUnsub) {
    convUnsub();
    convUnsub = null;
  }
  convId = null;
  convHandler = null;
  convDeleteHandler = null;
  resetUserRealtime();
  resetPresence();
  stopPresenceHeartbeat();
  resetEcho();
}
