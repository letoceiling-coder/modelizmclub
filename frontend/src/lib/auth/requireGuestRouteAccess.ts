import { redirect } from "@tanstack/react-router";
import { isDemoMode } from "@/lib/demo-mode";
import { enforceClientRouteAccess } from "@/lib/auth/enforceClientRouteAccess";

/**
 * Root route guard: blocks guests from pages the admin marked as restricted.
 * Also runs on client navigations; SSR is handled by RouteAccessEnforcer.
 */
export async function requireGuestRouteAccess(location: { pathname: string }): Promise<void> {
  if (typeof window === "undefined") return;
  if (isDemoMode()) return;

  const denial = await enforceClientRouteAccess(location.pathname);
  if (!denial) return;

  throw redirect({
    to: denial.to as "/feed",
    search: denial.search,
    replace: denial.replace ?? true,
  });
}
