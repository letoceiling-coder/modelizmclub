import { fetchMe, logout as apiLogout } from "@/lib/api/auth";
import { getToken, setToken } from "@/lib/api/client";
import { shutdownCalls } from "@/lib/calls";
import { GUEST_USER, setCurrentUser } from "@/lib/store";
import { startRealtimeHub, stopRealtimeHub } from "@/lib/realtime/hub";
import { isDemoMode } from "@/lib/demo-mode";
import { seedDemoStore } from "@/lib/demo-data";

let sessionPromise: Promise<boolean> | null = null;

/**
 * Validates the stored token against /auth/me and hydrates the store.
 * Returns true when the user is authenticated.
 */
export async function ensureSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  // Demo mode: no token, no network — seed the store with the mock session.
  if (isDemoMode()) {
    seedDemoStore();
    return true;
  }
  if (!getToken()) return false;

  if (!sessionPromise) {
    sessionPromise = loadSession();
  }
  return sessionPromise;
}

async function loadSession(): Promise<boolean> {
  const me = await fetchMe();
  if (!me) {
    // fetchMe() only clears the token on a real 401 — anything else (a
    // transient network blip, a slow/failed CORS preflight, a timeout)
    // also resolves to null here, but the token is still valid. Without
    // this reset, sessionPromise permanently caches that one failed
    // attempt for the rest of the SPA session: every later ensureSession()
    // call (requireAuth, requireAdmin, the landing page, /admin,
    // /reviews/upload — anything that checks auth after the first one)
    // would keep getting the same stale "false" and render as a guest
    // even though the user is still logged in, until a full page reload
    // happens to retry successfully. Clearing it here lets the next call
    // make a fresh attempt instead of being stuck for the whole session.
    sessionPromise = null;
    return false;
  }
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
  const ok = await ensureSession();
  // Root-mount is the *only* unconditional session check — most pages
  // (e.g. /feed) never call ensureSession() themselves, they just read the
  // store reactively, so if this one attempt fails there's otherwise no
  // automatic retry until either the user navigates to one of the few
  // routes that do call ensureSession() again (requireAuth/requireAdmin
  // guards), or reloads the whole page. One immediate retry here — now a
  // genuine second attempt, since loadSession() resets sessionPromise on
  // failure — self-heals a transient first-attempt failure (network blip,
  // slow/failed CORS preflight) without either of those.
  if (!ok && getToken() && !isDemoMode()) {
    await ensureSession();
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export async function signOut(): Promise<void> {
  await apiLogout();
  resetSessionCache();
  setCurrentUser(GUEST_USER);
}
