import { ROUTES } from "@/lib/routes";

const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/recover",
  "/reset-password",
  "/verify-email",
  "/oauth/",
  "/legal/",
  "/rules",
  "/safe-deal",
  "/help",
  "/subscription",
  "/payment",
  "/pay/",
  "/refund",
  "/how-it-works",
  "/info/",
  "/auth",
  "/landing",
  "/onboarding",
  "/wallet",
  "/balance",
  "/referral",
] as const;

/** Auth, legal and marketing pages — never gated by admin access rules. */
export function isAlwaysPublicRoute(pathname: string): boolean {
  if (pathname === ROUTES.home) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

/** @deprecated Use pathnameToRouteAction + min_tier. Kept for callers that only need a boolean. */
export function isPublicGuestRoute(pathname: string): boolean {
  if (isAlwaysPublicRoute(pathname)) return true;
  if (pathname === ROUTES.feed || pathname.startsWith("/feed/")) return true;
  if (pathname === ROUTES.ads) return true;
  if (
    pathname.startsWith("/ads/") &&
    pathname !== ROUTES.adCreate &&
    !pathname.startsWith(`${ROUTES.adCreate}/`)
  ) {
    return true;
  }
  if (pathname.startsWith("/user/")) return true;
  return false;
}

/**
 * Sections that greet a guest with an in-page "войдите в аккаунт" stub and the
 * shared auth dialog, instead of bouncing them to /login.
 */
export function isGuestStubRoute(pathname: string): boolean {
  if (pathname === ROUTES.messenger || pathname.startsWith("/messenger")) return true;
  if (pathname === ROUTES.reviews || pathname.startsWith("/reviews")) return true;
  if (pathname === ROUTES.deals || pathname.startsWith("/deals")) return true;
  if (pathname.startsWith("/user/")) return true;
  return false;
}

/** Logged-in users must confirm SMS before using these routes. */
export function isVerifiedRequiredRoute(pathname: string): boolean {
  if (pathname === ROUTES.friends || pathname.startsWith("/friends/")) return true;
  if (pathname === ROUTES.messenger || pathname.startsWith("/messenger/")) return true;
  if (pathname === ROUTES.adCreate || pathname.startsWith("/ads/new")) return true;
  return false;
}

/** Maps app routes to guest-access action keys (admin → «Защита страниц»). */
export function pathnameToRouteAction(pathname: string): string | null {
  if (isAlwaysPublicRoute(pathname)) return null;

  if (pathname === ROUTES.feed || pathname.startsWith("/feed/")) return "route.feed";
  if (pathname === ROUTES.adCreate || pathname.startsWith("/ads/new")) return "route.ads_new";
  if (pathname === ROUTES.ads || pathname.startsWith("/ads/")) return "route.ads";
  if (pathname === ROUTES.myAds || pathname.startsWith("/my-ads")) return "route.my_ads";
  if (pathname === ROUTES.deals || pathname.startsWith("/deals")) return "route.deals";
  if (pathname === ROUTES.favorites || pathname.startsWith("/favorites")) return "route.favorites";
  if (pathname === ROUTES.reviews || pathname.startsWith("/reviews")) return "route.reviews";
  if (pathname === ROUTES.channels || pathname.startsWith("/channels") || pathname.startsWith("/channel/")) {
    return "route.channels";
  }
  if (pathname === ROUTES.messenger || pathname.startsWith("/messenger")) return "route.messenger";
  if (pathname === ROUTES.friends || pathname.startsWith("/friends")) return "route.friends";
  if (pathname === ROUTES.communities || pathname.startsWith("/communities")) return "route.communities";
  if (pathname === ROUTES.categories || pathname.startsWith("/categories")) return "route.categories";
  if (pathname === ROUTES.notifications || pathname.startsWith("/notifications")) return "route.notifications";
  if (pathname === ROUTES.settings || pathname.startsWith("/settings")) return "route.settings";
  if (pathname === ROUTES.profile || pathname.startsWith("/profile")) return "route.profile";
  if (pathname.startsWith("/user/")) return "route.user";

  return null;
}

export const NAV_ROUTE_TO_ACTION: Record<string, string> = {
  [ROUTES.feed]: "layout.nav.feed",
  [ROUTES.ads]: "layout.nav.ads",
  [ROUTES.adCreate]: "layout.nav.ad_create",
  [ROUTES.myAds]: "layout.nav.my_ads",
  [ROUTES.deals]: "layout.nav.deals",
  [ROUTES.favorites]: "layout.nav.favorites",
  [ROUTES.communities]: "layout.nav.communities",
  [ROUTES.reviews]: "layout.nav.reviews",
  [ROUTES.channels]: "layout.nav.channels",
  [ROUTES.messenger]: "layout.nav.messenger",
  [ROUTES.friends]: "layout.nav.friends",
  [ROUTES.settings]: "layout.nav.settings",
  [ROUTES.wallet]: "layout.nav.settings",
  [ROUTES.profile]: "route.profile",
};

export const GROUP_LABELS: Record<string, string> = {
  feed_filters: "Лента — фильтры",
  feed_content: "Лента — контент",
  feed_directions: "Лента — направления",
  layout_nav: "Меню и шапка",
  route_guard: "Защита страниц",
  marketplace: "Объявления и сделки",
};

/** Nav items are always visible; access is enforced on click and via route guards. */
export function isNavVisibleToGuest(_route: string, _isAllowed: (key: string) => boolean): boolean {
  return true;
}
