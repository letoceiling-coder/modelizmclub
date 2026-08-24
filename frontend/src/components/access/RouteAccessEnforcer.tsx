import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { enforceClientRouteAccess } from "@/lib/auth/enforceClientRouteAccess";
import { subscribeFeedGuestAccess } from "@/lib/feed-guest-access/store";
import { selectors, useStore } from "@/lib/store";

/**
 * Re-runs guest / auth / subscription route guards after hydration,
 * after the session probe finishes, and whenever admin access rules change.
 */
export function RouteAccessEnforcer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const sessionResolved = useStore(selectors.sessionResolved);
  const [accessTick, setAccessTick] = useState(0);

  useEffect(() => subscribeFeedGuestAccess(() => setAccessTick((n) => n + 1)), []);

  useEffect(() => {
    if (!sessionResolved) return;

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
  }, [pathname, navigate, sessionResolved, accessTick]);

  return null;
}
