import { redirect } from "@tanstack/react-router";
import { ensureSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/demo-mode";
import { isAdminRoute } from "@/lib/feed-guest-access/routes";

function authenticatedRedirectTarget(redirectTo?: string): string {
  return redirectTo?.startsWith("/") ? redirectTo : "/feed";
}

/**
 * Route guard: redirects authenticated users away from guest-only pages (e.g. /login).
 */
export async function redirectIfAuthenticated(redirectTo?: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (isDemoMode()) return;

  const ok = await ensureSession();
  if (ok) {
    throw redirect({
      to: authenticatedRedirectTarget(redirectTo) as "/feed",
      replace: true,
    });
  }
}

/**
 * Route guard: a signed-out visitor gets the login *window* over the feed,
 * never a jump to /login — the page they asked for opens by itself once the
 * window succeeds. The admin panel keeps its own sign-in page.
 * Skips on SSR (client-only check after hydration).
 * In demo mode every route is open — no gate at all.
 */
export async function requireAuth(location?: {
  pathname: string;
  search?: string | Record<string, unknown>;
}): Promise<void> {
  if (typeof window === "undefined") return;
  if (isDemoMode()) return;

  const ok = await ensureSession();
  if (ok) return;

  const pathname = location?.pathname ?? window.location.pathname;
  const search = typeof location?.search === "string" ? location.search : window.location.search;

  if (isAdminRoute(pathname)) {
    throw redirect({ to: "/login", search: { redirect: pathname + search } });
  }

  // Imported lazily: lib/gate reads verification.ts, which imports this module.
  const { openRouteGate, gateFallbackPath } = await import("@/lib/gate/routeGate");
  openRouteGate("registered", pathname + search);
  const fallback = gateFallbackPath(pathname);
  if (fallback) throw redirect({ to: fallback as "/feed", replace: true });
}
