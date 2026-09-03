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

export function openGate(window: GateWindow, returnTo?: string): void {
  if (state.open === window && state.returnTo === returnTo) return;
  state = { open: window, returnTo };
  emit();
}

export function closeGate(): void {
  if (state.open === null) return;
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
