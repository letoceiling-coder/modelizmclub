import { redirect } from "@tanstack/react-router";
import { ensureSession } from "@/lib/auth/session";
import { getSession } from "@/lib/session";
import { firstFailingStep, levelOf, meets, type Level } from "./levels";
import { saveIntent } from "./intent";
import { openGate, setPendingAction } from "./gateStore";

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
  const have = levelOf(getSession());
  if (meets(have, level)) return { ssrSkeleton: false, allowed: true };

  const pathname = location?.pathname ?? window.location.pathname;
  const search = typeof location?.search === "string" ? location.search : window.location.search;
  const to = pathname + search;
  const intent = { key: "navigate", params: { to }, returnTo: to, level, createdAt: Date.now() };
  saveIntent(intent);
  setPendingAction({
    level,
    intent,
    run: () => {
      window.location.assign(to);
    },
  });
  const step = firstFailingStep(have, level);
  if (step) openGate(step, to);

  throw redirect({ to: "/feed" });
}
