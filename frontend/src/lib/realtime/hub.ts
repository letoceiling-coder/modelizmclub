import type { Message } from "@/lib/mock";
import { getToken } from "@/lib/api/client";
import { GUEST_USER } from "@/lib/store";
import { calls } from "@/lib/calls";
import { initUserRealtime, resetUserRealtime } from "@/lib/realtime/user";
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
let convUnsub: (() => void) | null = null;

async function bindConversation(): Promise<void> {
  if (convUnsub) {
    convUnsub();
    convUnsub = null;
  }
  if (!convId || !convHandler || !getToken()) return;
  convUnsub = await subscribeConversation(convId, convHandler);
}

/** Re-subscribe personal channels after socket (re)connect. */
export async function resubscribeRealtime(): Promise<void> {
  if (!hubUser || hubUser === GUEST_USER.id || !getToken()) return;
  await getEcho();
  await calls.init(hubUser);
  await initUserRealtime(hubUser);
  await bindConversation();
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
    void ensureConnection();
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
export function setHubConversation(id: string | null, onMessage?: (m: Message) => void): void {
  convId = id;
  convHandler = onMessage ?? null;
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
  resetUserRealtime();
  resetEcho();
}
