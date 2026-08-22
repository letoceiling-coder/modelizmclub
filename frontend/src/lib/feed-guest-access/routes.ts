import { ROUTES } from "@/lib/routes";

const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/recover",
  "/reset-password",
  "/verify-email",
  "/oauth/",
  "/legal/",
  "/help",
  "/subscription",
  "/payment",
  "/refund",
  "/how-it-works",
  "/info/",
  "/auth",
  "/landing",
  "/onboarding",
] as const;

/** Pages guests may open without an account: feed + ads catalog (read-only), plus auth/legal. */
export function isPublicGuestRoute(pathname: string): boolean {
  if (pathname === ROUTES.home || pathname === ROUTES.feed || pathname.startsWith("/feed/")) {
    return true;
  }
  if (pathname === ROUTES.ads) return true;
  if (
    pathname.startsWith("/ads/") &&
    pathname !== ROUTES.adCreate &&
    !pathname.startsWith(`${ROUTES.adCreate}/`)
  ) {
    return true;
  }
  if (pathname.startsWith("/user/")) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

/** Logged-in users must confirm SMS before using these routes. */
export function isVerifiedRequiredRoute(pathname: string): boolean {
  if (pathname === ROUTES.friends || pathname.startsWith("/friends/")) return true;
  if (pathname === ROUTES.messenger || pathname.startsWith("/messenger/")) return true;
  if (pathname === ROUTES.adCreate || pathname.startsWith("/ads/new")) return true;
  return false;
}

/** Maps app routes to guest-access action keys (admin → «Защита страниц» / nav keys). */
export function pathnameToRouteAction(pathname: string): string | null {
  if (isPublicGuestRoute(pathname)) return null;

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
  [ROUTES.profile]: "route.profile",
};

export const GROUP_LABELS: Record<string, string> = {
  feed_filters: "Лента — фильтры",
  feed_content: "Лента — контент",
  feed_directions: "Лента — направления",
  layout_nav: "Меню и шапка",
  route_guard: "Защита страниц",
};

/** Nav items are always visible; access is enforced on click and via route guards. */
export function isNavVisibleToGuest(_route: string, _isAllowed: (key: string) => boolean): boolean {
  return true;
}
