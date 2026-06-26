// Mock-only in-app calling. No WebRTC, no audio, no network.
// Module-scope store mirrors src/lib/store.ts pattern.

import { useSyncExternalStore } from "react";

export type CallStatus = "ringing" | "connecting" | "connected" | "ended";
export type CallDirection = "outgoing" | "incoming";
export type CallResult = "answered" | "missed" | "ended";

export interface ActiveCall {
  id: string;
  peerId: string;
  direction: CallDirection;
  status: CallStatus;
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  result?: CallResult;
}

export interface CallRecord {
  id: string;
  peerId: string;
  direction: CallDirection;
  startedAt: number;
  durationSec: number;
  result: CallResult;
}

interface CallsState {
  active: ActiveCall | null;
  history: CallRecord[];
}

const MAX_CALL_MS = 60_000;
const RINGING_MS = 1600;
const CONNECTING_MS = 1400;
const AUTO_DISMISS_MS = 1400;

function seedHistory(): CallRecord[] {
  const now = Date.now();
  const day = 86_400_000;
  return [
    { id: "seed_c1", peerId: "u2", direction: "outgoing", startedAt: now - 2 * 3600_000, durationSec: 42, result: "answered" },
    { id: "seed_c2", peerId: "u3", direction: "incoming", startedAt: now - day - 1800_000, durationSec: 0, result: "missed" },
    { id: "seed_c3", peerId: "u4", direction: "incoming", startedAt: now - 2 * day, durationSec: 18, result: "answered" },
  ];
}

let state: CallsState = { active: null, history: seedHistory() };
const listeners = new Set<() => void>();
const emit = (): void => { listeners.forEach((l) => l()); };
const subscribe = (l: () => void): (() => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnap = (): CallsState => state;

let timers: ReturnType<typeof setTimeout>[] = [];
function clearTimers(): void {
  for (const t of timers) clearTimeout(t);
  timers = [];
}
function patchActive(patch: Partial<ActiveCall>): void {
  if (!state.active) return;
  state = { ...state, active: { ...state.active, ...patch } };
  emit();
}

export interface CallListener {
  onEnded?: (record: CallRecord) => void;
}
const callListeners = new Set<CallListener>();
export function onCallEvent(l: CallListener): () => void {
  callListeners.add(l);
  return () => { callListeners.delete(l); };
}

export const calls = {
  start(peerId: string, direction: CallDirection = "outgoing"): void {
    if (state.active) return;
    clearTimers();
    const active: ActiveCall = {
      id: `c_${Date.now()}`,
      peerId,
      direction,
      status: "ringing",
      startedAt: Date.now(),
    };
    state = { ...state, active };
    emit();
    timers.push(setTimeout(() => patchActive({ status: "connecting" }), RINGING_MS));
    timers.push(setTimeout(() => {
      patchActive({ status: "connected", connectedAt: Date.now() });
      timers.push(setTimeout(() => calls.end(), MAX_CALL_MS));
    }, RINGING_MS + CONNECTING_MS));
  },

  end(): void {
    const a = state.active;
    if (!a || a.status === "ended") return;
    clearTimers();
    const endedAt = Date.now();
    const wasConnected = a.status === "connected" && !!a.connectedAt;
    const durationSec = wasConnected ? Math.max(0, Math.round((endedAt - (a.connectedAt as number)) / 1000)) : 0;
    const result: CallResult = wasConnected ? "answered" : (a.direction === "incoming" ? "missed" : "ended");
    const record: CallRecord = {
      id: a.id,
      peerId: a.peerId,
      direction: a.direction,
      startedAt: a.startedAt,
      durationSec,
      result,
    };
    state = {
      active: { ...a, status: "ended", endedAt, result },
      history: [record, ...state.history],
    };
    emit();
    callListeners.forEach((l) => l.onEnded?.(record));
    timers.push(setTimeout(() => {
      state = { ...state, active: null };
      emit();
    }, AUTO_DISMISS_MS));
  },

  dismiss(): void {
    clearTimers();
    state = { ...state, active: null };
    emit();
  },
};

// hook
export function useCalls<T>(selector: (s: CallsState) => T): T {
  const snap = useSyncExternalStore(subscribe, getSnap, getSnap);
  return selector(snap);
}

export function formatCallDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
