import { getToken } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import { ensureSession } from "@/lib/auth/session";
import { fetchMe } from "@/lib/api/auth";
import { isPhoneVerified, isPhoneVerificationRequired, isStaffUser, requestPhoneVerificationModal } from "@/lib/auth/verification";
import { isAlwaysPublicRoute, isGuestStubRoute, isVerifiedRequiredRoute, pathnameToRouteAction } from "@/lib/feed-guest-access/routes";
import { loadFeedGuestAccess, resolveMinTier } from "@/lib/feed-guest-access/store";
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

/** Routes that always require a logged-in account (not guest-access configurable). */
function isAdminRoute(pathname: string): boolean {
  return pathname === ROUTES.admin || pathname.startsWith("/admin/") || pathname === "/diag";
}

/**
 * Client-side route access enforcement.
 * Root `beforeLoad` skips on SSR — this runs after hydration on every navigation.
 */
export async function enforceClientRouteAccess(pathname: string): Promise<ClientRouteRedirect | null> {
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
    const from = pathname + window.location.search;
    return { to: "/login", search: { redirect: from }, replace: true };
  }

  if (isVerifiedRequiredRoute(pathname)) {
    const ok = await ensureSession();
    if (!ok) {
      return { to: "/login", search: { redirect: pathname }, replace: true };
    }
    let user = getSessionUser();
    if (user.id === "guest") {
      const me = await fetchMe();
      if (me) {
        setCurrentUser(me);
        user = me;
      }
    }
    if (user.id === "guest") {
      return { to: "/login", search: { redirect: pathname }, replace: true };
    }
    if (isPhoneVerificationRequired(user) && !isPhoneVerified(user)) {
      requestPhoneVerificationModal();
      if (pathname === ROUTES.feed || pathname.startsWith("/feed/")) return null;
      return { to: ROUTES.feed, replace: true };
    }
  }

  if (minTier === "subscription") {
    const user = getSessionUser();
    if (isStaffUser(user)) return null;
    const sub = await getMySubscription();
    if (sub?.is_active === true) return null;
    return { to: ROUTES.subscription, replace: true };
  }

  return null;
}
