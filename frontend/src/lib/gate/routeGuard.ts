import { ensureSession } from "@/lib/auth/session";
import { type Level } from "./levels";
import { openRouteGate } from "./routeGate";

export interface RouteGuardResult {
  /** SSR: render the page skeleton, decide after hydration. */
  ssrSkeleton: boolean;
  allowed: boolean;
}

/**
 * For `beforeLoad`: `await routeGuard("verified", location)`.
 * On the server nothing is decided — the page renders its skeleton and the
 * client re-runs the guard on hydration. On the client an insufficient level
 * opens the gate with a `navigate` intent and sends the user to /feed; the
 * navigation resumes by itself when the missing step succeeds.
 */
export async function routeGuard(
  level: Level,
  location?: { pathname: string; search?: string | Record<string, unknown> },
): Promise<RouteGuardResult> {
  if (typeof window === "undefined") return { ssrSkeleton: true, allowed: false };

  await ensureSession();

  const pathname = location?.pathname ?? window.location.pathname;
  const search = typeof location?.search === "string" ? location.search : window.location.search;
  if (!openRouteGate(level, pathname + search)) return { ssrSkeleton: false, allowed: true };

  // Адрес не меняем: окно открывается поверх запрошенной страницы, а она
  // отрисовывает свой скелетон под затемнением. См. gateRoute().
  return { ssrSkeleton: false, allowed: false };
}
