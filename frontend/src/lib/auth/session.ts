import { fetchMe, logout as apiLogout } from "@/lib/api/auth";
import { getToken, setToken } from "@/lib/api/client";
import { shutdownCalls } from "@/lib/calls";
import { GUEST_USER, setCurrentUser } from "@/lib/store";
import { startRealtimeHub, stopRealtimeHub } from "@/lib/realtime/hub";

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
  shutdownCalls();
  await startRealtimeHub(me.id);
  return true;
}

/** Clears the in-flight session promise (after login / logout). */
export function resetSessionCache(): void {
  sessionPromise = null;
  shutdownCalls();
  stopRealtimeHub();
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
  setCurrentUser(GUEST_USER);
}
