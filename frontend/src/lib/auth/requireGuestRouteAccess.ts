import { redirect } from "@tanstack/react-router";
import { isDemoMode } from "@/lib/demo-mode";
import { enforceClientRouteAccess } from "@/lib/auth/enforceClientRouteAccess";

/**
 * Root route guard: blocks guests, signed-in users and non-subscribers
 * according to admin «Права доступа /feed» min_tier settings.
 * SSR is skipped; RouteAccessEnforcer re-runs after hydration.
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
