import { redirect } from "@tanstack/react-router";
import { ensureSession } from "@/lib/auth/session";
import { getState, selectors } from "@/lib/store";

/**
 * Route guard for the admin panel.
 * 1. Redirects to /login when there is no valid session.
 * 2. Redirects to / when the authenticated user is not a superadmin.
 * Runs client-only (after hydration).
 */
export async function requireAdmin(location?: {
  pathname: string;
  search?: string | Record<string, unknown>;
}): Promise<void> {
  if (typeof window === "undefined") return;

  const ok = await ensureSession();
  if (!ok) {
    const pathname = location?.pathname ?? window.location.pathname;
    const search =
      typeof location?.search === "string" ? location.search : window.location.search;
    throw redirect({ to: "/login", search: { redirect: pathname + search } });
  }

  const me = selectors.currentUser(getState());
  if (!me.isAdmin) {
    throw redirect({ to: "/" });
  }
}
