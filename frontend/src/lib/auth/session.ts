import { fetchMe, logout as apiLogout } from "@/lib/api/auth";
import { getToken } from "@/lib/api/client";
import { fetchFavoriteListings } from "@/lib/api/listings";
import { fetchConversations } from "@/lib/api/chat";
import { shutdownCalls } from "@/lib/calls";
import { actions, setDialogs } from "@/lib/store";
import { startRealtimeHub, stopRealtimeHub } from "@/lib/realtime/hub";
import { isDemoMode } from "@/lib/demo-mode";
import { seedDemoStore } from "@/lib/demo-data";
import { getMySubscription, invalidateMySubscription } from "@/lib/subscription";
import { claimReferralCode } from "@/lib/api/referral";
import { peekStoredReferralCode, consumeStoredReferralCode } from "@/lib/referral-cookie";
import { GUEST_USER } from "@/lib/session/guest";
import { setSession } from "@/lib/session/cache";
import { getSessionQueryClient } from "@/lib/session/queryClient";
import { sessionQueryOptions } from "@/lib/session/options";
import { SESSION_KEY, type Session } from "@/lib/session/types";

/** Replace local favorite IDs with the server list (source of truth for the badge). */
export async function syncFavoritesFromServer(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!getToken() && !isDemoMode()) return;
  try {
    const list = await fetchFavoriteListings();
    actions.setFavoriteAdIds(list.map((ad) => ad.id));
  } catch {
    // Transient network error — keep optimistic local state.
  }
}

/** Load conversations so messenger unread badges work outside /messenger. */
export async function syncDialogsFromServer(meUuid: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!getToken() && !isDemoMode()) return;
  if (!meUuid || meUuid === GUEST_USER.id) return;
  try {
    const list = await fetchConversations(meUuid);
    setDialogs(list);
    list.forEach((d) => {
      if (d.listing) actions.setDialogAd(d.id, d.listing);
    });
  } catch {
    // Transient network error — realtime may still update the badge.
  }
}

/**
 * The single source of truth for "who is signed in": one fetch of /auth/me
 * plus the subscription, cached under ['session'].
 *
 * Resolves to null for a guest — no token, or a real 401 (fetchMe clears the
 * token on that). Any other failure while the token is still present (a
 * network blip, a slow/failed CORS preflight, a timeout) is *thrown*: React
 * Query then keeps the query in error state and the next ensureSession() or
 * mounted useSession() refetches, instead of a false "guest" being cached for
 * five minutes and every later auth check rendering the user as signed out.
 */
export async function fetchSession(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  // Demo mode: no token, no network — seed the store with the mock session.
  if (isDemoMode()) {
    seedDemoStore();
    await syncFavoritesFromServer();
    const me = await fetchMe();
    const sub = await getMySubscription();
    return me ? toSession(me, sub) : null;
  }

  if (!getToken()) return null;

  const me = await fetchMe();
  if (!me) {
    if (getToken()) throw new Error("session: /auth/me failed while the token is still valid");
    return null;
  }

  // Only the subscription blocks: levelOf() (lib/gate) needs it to tell a
  // subscriber from a free account, and a gate that guesses wrong shows a
  // paywall to someone who has already paid. Everything else — messenger,
  // favorites, LiveKit, the referral claim — catches up in the background,
  // which is what origin/master 00ac2f9 introduced: first paint must not
  // wait for them.
  const sub = await getMySubscription();
  void hydrateAuthenticatedSession(me.id);

  return toSession(me, sub);
}

/** Side effects that must never delay the session resolving. */
async function hydrateAuthenticatedSession(userId: string): Promise<void> {
  try {
    shutdownCalls();
    await startRealtimeHub(userId);
    await Promise.all([syncFavoritesFromServer(), syncDialogsFromServer(userId)]);
    const pendingRef = peekStoredReferralCode();
    if (pendingRef) {
      await claimReferralCode(pendingRef);
      consumeStoredReferralCode();
    }
  } catch {
    // Non-fatal: the session already resolved and the user can use the page.
    // A failed referral claim keeps the stored code for the next fetch.
  }
}

function toSession(user: Session["user"], sub: Awaited<ReturnType<typeof getMySubscription>>): Session {
  return {
    user,
    phoneVerified: user.phone_verified === true,
    subscription: {
      active: sub?.is_active === true,
      plan: sub?.plan?.slug ?? null,
      endsAt: sub?.ends_at ?? null,
    },
  };
}

/**
 * Route-guard entry point. Returns true when the user is authenticated.
 * Serves the cached session when there is one; fetches otherwise.
 */
export async function ensureSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const qc = getSessionQueryClient();
  if (!qc) return false;
  if (!getToken() && !isDemoMode()) return false;
  try {
    return Boolean(await qc.ensureQueryData(sessionQueryOptions));
  } catch {
    return false;
  }
}

/** Marks the session stale so the next read refetches (after login / logout). */
export function resetSessionCache(): void {
  shutdownCalls();
  stopRealtimeHub();
  invalidateMySubscription();
  void getSessionQueryClient()?.invalidateQueries({ queryKey: SESSION_KEY });
}

// Prefetch the session on app boot (root beforeLoad) and on bfcache restore.
export async function restoreSession(): Promise<void> {
  if (typeof window === "undefined") return;
  const qc = getSessionQueryClient();
  if (!qc) return;

  if (!getToken() && !isDemoMode()) {
    shutdownCalls();
    stopRealtimeHub();
    actions.setFavoriteAdIds([]);
    setSession(null);
    return;
  }

  // prefetchQuery never throws — a failed attempt leaves the query in error
  // state, which still counts as "resolved" for UI that gates on the probe.
  await qc.prefetchQuery(sessionQueryOptions);
  // Root-mount is the *only* unconditional session check — most pages just
  // read useSession() and never call ensureSession() themselves. One immediate
  // retry self-heals a transient first-attempt failure without a reload.
  if (getToken() && !isDemoMode() && qc.getQueryState(SESSION_KEY)?.status === "error") {
    await qc.prefetchQuery(sessionQueryOptions);
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export async function signOut(): Promise<void> {
  await apiLogout();
  // Synchronous null first so every mounted useSession() sees the sign-out
  // in the same tick; the invalidation below refetches to confirm.
  setSession(null);
  resetSessionCache();
  actions.setFavoriteAdIds([]);
}
