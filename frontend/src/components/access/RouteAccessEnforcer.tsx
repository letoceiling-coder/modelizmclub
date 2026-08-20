import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { enforceClientRouteAccess } from "@/lib/auth/enforceClientRouteAccess";

/**
 * Re-runs guest/auth route guards on the client after hydration and on every
 * navigation. Guests may only stay on public browse routes; everything else
 * goes to /login — never to a subscription paywall.
 */
export function RouteAccessEnforcer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    let alive = true;
    void enforceClientRouteAccess(pathname).then((redirect) => {
      if (!alive || !redirect) return;
      void navigate({
        to: redirect.to as "/feed",
        search: redirect.search,
        replace: redirect.replace ?? true,
      });
    });

    return () => {
      alive = false;
    };
  }, [pathname, navigate]);

  return null;
}
