import { useSyncExternalStore } from "react";
import { getToken } from "@/lib/api/client";
import { fetchIncomingRequests } from "@/lib/api/social";
import { onRealtimeNotification } from "@/lib/realtime/user";

/**
 * Сколько входящих заявок в друзья ждут ответа — для счётчика в меню.
 *
 * Разбор 16.09: заявка приходила уведомлением (InAppNotify, тип
 * friend_request), но пункт «Друзья» в меню молчал — узнать о ней можно было,
 * только зайдя в раздел. Второго механизма не заводим: то же уведомление по
 * сокету служит сигналом пересчитать, число берём из списка заявок. Раз в
 * минуту и при возвращении на вкладку — перезапрос, на случай если сокет
 * отвалился.
 */

const POLL_MS = 60_000;
const REFRESH_TYPES = new Set(["friend_request", "friend_accept"]);

let count = 0;
let generation = 0;
const listeners = new Set<() => void>();
let stopWatching: (() => void) | null = null;

function emit(next: number) {
  if (next === count) return;
  count = next;
  listeners.forEach((cb) => cb());
}

export function setIncomingFriendRequestCount(next: number): void {
  // Раздел «Друзья» знает число точнее: он только что загрузил список или
  // ответил на заявку. Запрос, начатый раньше, это число не перетрёт.
  generation += 1;
  emit(Math.max(0, next));
}

export function refreshIncomingFriendRequests(): void {
  if (!getToken()) {
    generation += 1;
    emit(0);
    return;
  }
  const gen = ++generation;
  fetchIncomingRequests()
    .then((list) => {
      if (gen === generation) emit(list.length);
    })
    .catch(() => {
      /* число останется прежним до следующего пересчёта */
    });
}

function startWatching(): () => void {
  refreshIncomingFriendRequests();
  const unsubRealtime = onRealtimeNotification((n) => {
    if (REFRESH_TYPES.has(n.type)) refreshIncomingFriendRequests();
  });
  const timer = window.setInterval(refreshIncomingFriendRequests, POLL_MS);
  const onVisible = () => {
    if (document.visibilityState === "visible") refreshIncomingFriendRequests();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    unsubRealtime();
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (listeners.size === 1) stopWatching = startWatching();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      stopWatching?.();
      stopWatching = null;
    }
  };
}

export function useIncomingFriendRequestCount(): number {
  return useSyncExternalStore(
    subscribe,
    () => count,
    () => 0,
  );
}
