import { getToken } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import { ensureSession } from "@/lib/auth/session";
import { fetchMe } from "@/lib/api/auth";
import { isPhoneVerified, isPhoneVerificationRequired, isStaffUser } from "@/lib/auth/verification";
import {
  isAdminRoute,
  isAlwaysPublicRoute,
  isGuestStubRoute,
  isVerifiedRequiredRoute,
  pathnameToRouteAction,
} from "@/lib/feed-guest-access/routes";
import { loadFeedGuestAccess, resolveMinTier } from "@/lib/feed-guest-access/store";
import { levelFromAccessTier, type Level } from "@/lib/gate/levels";
import { gateFallbackPath, openRouteGate } from "@/lib/gate/routeGate";
import { getMySubscription } from "@/lib/subscription";
import { ROUTES } from "@/lib/routes";
import { getFeatureFlags, loadFeatureFlagsFromServer } from "@/lib/config/featureFlags";
import { setCurrentUser } from "@/lib/store";
import { getSessionUser } from "@/lib/session";

export type ClientRouteRedirect = {
  to: string;
  search?: Record<string, string>;
  replace?: boolean;
};

/**
 * A route the viewer may not open: raise the one gate window over the feed
 * and remember where they were going. Never /login — the destination resumes
 * by itself once the missing step succeeds.
 */
function gateRoute(need: Level, pathname: string): ClientRouteRedirect | null {
  const search = typeof window === "undefined" ? "" : window.location.search;
  openRouteGate(need, pathname + search);
  const fallback = gateFallbackPath(pathname);
  return fallback ? { to: fallback, replace: true } : null;
}

/**
 * Client-side route access enforcement.
 * Root `beforeLoad` skips on SSR — this runs after hydration on every navigation.
 */
export async function enforceClientRouteAccess(
  pathname: string,
): Promise<ClientRouteRedirect | null> {
  if (typeof window === "undefined") return null;
  if (isDemoMode()) return null;

  if (pathname === ROUTES.communities || pathname.startsWith("/communities/")) {
    await loadFeatureFlagsFromServer();
    if (!getFeatureFlags().communitiesEnabled) {
      return { to: ROUTES.feed, replace: true };
    }
  }

  if (pathname === ROUTES.reviews || pathname.startsWith("/reviews/")) {
    await loadFeatureFlagsFromServer();
    if (!getFeatureFlags().reviewsEnabled) {
      return { to: ROUTES.feed, replace: true };
    }
  }

  // The admin panel is the single exception: it is a separate product with its
  // own sign-in page, not a window over the public site.
  if (isAdminRoute(pathname)) {
    if (!getToken()) {
      return { to: "/login", search: { redirect: pathname }, replace: true };
    }
    return null;
  }

  if (isAlwaysPublicRoute(pathname)) return null;

  await loadFeedGuestAccess();
  const action = pathnameToRouteAction(pathname);
  const minTier = action ? resolveMinTier(action) : "auth";

  if (!getToken()) {
    if (minTier === "guest") return null;
    if (isGuestStubRoute(pathname)) return null;
    return gateRoute(levelFromAccessTier(minTier), pathname);
  }

  if (isVerifiedRequiredRoute(pathname)) {
    const ok = await ensureSession();
    if (!ok) return gateRoute("verified", pathname);

    let user = getSessionUser();
    if (user.id === "guest") {
      const me = await fetchMe();
      if (me) {
        setCurrentUser(me);
        user = me;
      }
    }
    if (user.id === "guest") return gateRoute("verified", pathname);

    if (isPhoneVerificationRequired(user) && !isPhoneVerified(user)) {
      return gateRoute("verified", pathname);
    }
  }

  if (minTier === "subscription") {
    const user = getSessionUser();
    if (isStaffUser(user)) return null;
    const sub = await getMySubscription();
    if (sub?.is_active === true) return null;
    return gateRoute("subscriber", pathname);
  }

  return null;
}
