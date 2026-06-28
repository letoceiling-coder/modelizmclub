import { fetchMe, logout as apiLogout } from "@/lib/api/auth";
import { getToken, setToken } from "@/lib/api/client";
import { setCurrentUser } from "@/lib/store";
import { resetEcho } from "@/lib/realtime/echo";

let sessionPromise: Promise<boolean> | null = null;

/**
 * Validates the stored token against /auth/me and hydrates the store.
 * Returns true when the user is authenticated.
 */
export async function ensureSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!getToken()) return false;

  if (!sessionPromise) {
    sessionPromise = loadSession();
  }
  return sessionPromise;
}

async function loadSession(): Promise<boolean> {
  const me = await fetchMe();
  if (!me) return false;
  setCurrentUser(me);
  // Reconnect WebSocket with a validated token (fixes broadcast/auth 403 after boot).
  resetEcho();
  return true;
}

/** Clears the in-flight session promise (after login / logout). */
export function resetSessionCache(): void {
  sessionPromise = null;
  resetEcho();
}

// Restore the authenticated user into the store on app boot.
export async function restoreSession(): Promise<void> {
  await ensureSession();
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export async function signOut(): Promise<void> {
  await apiLogout();
  resetSessionCache();
}
