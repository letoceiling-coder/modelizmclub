import type { Level } from "./levels";

/**
 * What the user was trying to do when a gate stopped them. Survives a full
 * navigation (register page, OAuth round-trip) in sessionStorage, so the
 * action can resume once the missing rung is reached.
 */
export interface Intent {
  /** "navigate" is resumed by the host itself; any other key is informational. */
  key: string;
  params?: Record<string, unknown>;
  /** Where to bring the user back to — defaults to the page the gate opened on. */
  returnTo?: string;
  /** The rung that was required. */
  level?: Level;
  createdAt: number;
}

const STORAGE_KEY = "gate.intent";
const MAX_AGE_MS = 30 * 60_000;

export function saveIntent(intent: Omit<Intent, "createdAt"> & { createdAt?: number }): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ createdAt: Date.now(), ...intent }));
  } catch {
    // Private mode / quota — the in-memory pending action still covers the same-page flow.
  }
}

export function readIntent(): Intent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Intent;
    if (!parsed || typeof parsed.key !== "string") return null;
    if (Date.now() - (parsed.createdAt ?? 0) > MAX_AGE_MS) {
      clearIntent();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function currentPath(): string {
  if (typeof window === "undefined") return "/feed";
  const path = `${window.location.pathname}${window.location.search}`;
  if (path.startsWith("/login") || path.startsWith("/register")) return "/feed";
  return path;
}
