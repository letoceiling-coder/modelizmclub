import { getToken } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import { ensureSession } from "@/lib/auth/session";
import { fetchMe } from "@/lib/api/auth";
import { isPhoneVerified, isPhoneVerificationRequired } from "@/lib/auth/verification";
import { isPublicGuestRoute, isVerifiedRequiredRoute } from "@/lib/feed-guest-access/routes";
import { ROUTES } from "@/lib/routes";
import { getFeatureFlags, loadFeatureFlagsFromServer } from "@/lib/config/featureFlags";
import { getState, selectors, setCurrentUser } from "@/lib/store";

export type ClientRouteRedirect = {
  to: string;
  search?: Record<string, string>;
  replace?: boolean;
};

/** Routes that always require a logged-in account (not guest-access configurable). */
function isAdminRoute(pathname: string): boolean {
  return pathname === ROUTES.admin || pathname.startsWith("/admin/");
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

  if (isAdminRoute(pathname)) {
    if (!getToken()) {
      return { to: "/login", search: { redirect: pathname }, replace: true };
    }
    return null;
  }

  if (!getToken()) {
    if (isPublicGuestRoute(pathname)) return null;
    const from = pathname + (typeof window !== "undefined" ? window.location.search : "");
    return { to: "/login", search: { redirect: from }, replace: true };
  }

  if (isVerifiedRequiredRoute(pathname)) {
    const ok = await ensureSession();
    if (!ok) {
      return { to: "/login", search: { redirect: pathname }, replace: true };
    }
    let user = selectors.currentUser(getState());
    if (user.id === "guest") {
      const me = await fetchMe();
      if (me) {
        setCurrentUser(me);
        user = me;
      }
    }
    if (isPhoneVerificationRequired(user) && !isPhoneVerified(user)) {
      const from = pathname + (typeof window !== "undefined" ? window.location.search : "");
      return { to: "/settings/account", search: { redirect: from }, replace: true };
    }
  }

  return null;
}
