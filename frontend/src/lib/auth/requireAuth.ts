import { redirect } from "@tanstack/react-router";
import { ensureSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/demo-mode";

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
 * Route guard: redirects to /login when there is no valid session.
 * Skips on SSR (client-only check after hydration).
 * In demo mode every route is open — no auth redirect.
 */
export async function requireAuth(location?: {
  pathname: string;
  search?: string | Record<string, unknown>;
}): Promise<void> {
  if (typeof window === "undefined") return;
  if (isDemoMode()) return;

  const ok = await ensureSession();
  if (!ok) {
    const pathname = location?.pathname ?? window.location.pathname;
    const search = typeof location?.search === "string" ? location.search : window.location.search;
    throw redirect({
      to: "/login",
      search: { redirect: pathname + search },
    });
  }
}
