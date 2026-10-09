import { useSyncExternalStore } from "react";
import type { GateWindow, Level } from "./levels";
import type { Intent } from "./intent";

/**
 * Tiny external store shared by the hook, the host and the route guard —
 * they all run in different places (components, beforeLoad, event handlers)
 * and must agree on which single window is open.
 */
interface GateState {
  open: GateWindow | null;
  returnTo?: string;
}

interface Pending {
  level: Level;
  run: () => void | Promise<void>;
  intent: Intent;
}

let state: GateState = { open: null };
let pending: Pending | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function getGateState(): GateState {
  return state;
}

export function subscribeGate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Окно подтверждения номера, закрытое человеком, в этом заходе само не
 * возвращается. Решение З3 от 09.10.
 *
 * Отказ помнится в `sessionStorage`: заход — это вкладка, и ровно столько
 * живёт `sessionStorage`. Чтение и запись — в try/catch, потому что в
 * приватном окне и при запрещённых данных сайта обращение бросает
 * исключение, а не возвращает пусто (`CLAUDE.md`, раздел про хранилище).
 *
 * Запоминается только `verify`. Окно входа и окно подписки закрываются по
 * своим правилам, и З3 их не касается.
 */
const DISMISS_KEY = "modelizm_gate_verify_dismissed";
let dismissedVerify = false;

function rememberDismissal(): void {
  dismissedVerify = true;
  try {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Приватное окно или запрещённые данные сайта: отказ остаётся в памяти
    // процесса, и этого достаточно — заход всё равно не переживёт вкладку.
  }
}

export function isVerifyGateDismissed(): boolean {
  if (dismissedVerify) return true;
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** После успешного подтверждения помнить отказ больше не о чем. */
export function clearVerifyGateDismissal(): void {
  dismissedVerify = false;
  try {
    window.sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    /* см. rememberDismissal */
  }
}

export interface OpenGateOptions {
  /**
   * Человек сам нажал действие, которому нужен этот шаг.
   *
   * Такое открытие проходит даже после отказа: З3 запрещает окну
   * возвращаться **само**, а не открываться по просьбе. Без этого признака
   * открытие считается непрошеным — возврат на страницу, ответ фонового
   * запроса, страж маршрута, — и после закрытия в этом заходе не повторяется.
   */
  byUserAction?: boolean;
}

export function openGate(
  window_: GateWindow,
  returnTo?: string,
  options: OpenGateOptions = {},
): void {
  if (window_ === "verify" && !options.byUserAction && isVerifyGateDismissed()) return;
  if (state.open === window_ && state.returnTo === returnTo) return;
  state = { open: window_, returnTo };
  emit();
}

export function closeGate(): void {
  if (state.open === null) return;
  if (state.open === "verify") rememberDismissal();
  state = { open: null };
  emit();
}

/** The action to replay once the rung is reached — same-page flow only. */
export function setPendingAction(next: Pending | null): void {
  pending = next;
}

export function takePendingAction(): Pending | null {
  const p = pending;
  pending = null;
  return p;
}

export function useGateState(): GateState {
  return useSyncExternalStore(subscribeGate, getGateState, getGateState);
}
