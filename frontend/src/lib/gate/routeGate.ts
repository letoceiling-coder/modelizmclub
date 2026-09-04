import { getSession } from "@/lib/session";
import { firstFailingStep, levelOf, meets, type Level } from "./levels";
import { saveIntent } from "./intent";
import { openGate, setPendingAction } from "./gateStore";

/** Where the viewer waits while the window is open — never the blocked page. */
export const GATE_FALLBACK_PATH = "/feed";

/**
 * The feed is the fallback, so a gate raised *on* the feed must not redirect
 * to it — that would bounce beforeLoad against itself forever. The window
 * simply opens over the page the viewer is already on.
 */
export function gateFallbackPath(pathname: string): string | null {
  if (pathname === GATE_FALLBACK_PATH || pathname.startsWith(`${GATE_FALLBACK_PATH}/`)) return null;
  return GATE_FALLBACK_PATH;
}

/**
 * A route the viewer may not open yet. Never a redirect to /login: the
 * destination is stored as a `navigate` intent, exactly one window opens —
 * the first missing rung — and the navigation finishes by itself once that
 * rung is reached.
 *
 * Returns false when the viewer already meets `need` (nothing was opened),
 * so callers can treat it as "blocked?".
 */
export function openRouteGate(need: Level, to: string): boolean {
  if (typeof window === "undefined") return false;
  const have = levelOf(getSession());
  if (meets(have, need)) return false;

  const intent = {
    key: "navigate",
    params: { to },
    returnTo: to,
    level: need,
    createdAt: Date.now(),
  };
  saveIntent(intent);
  setPendingAction({
    level: need,
    intent,
    run: () => {
      window.location.assign(to);
    },
  });
  const step = firstFailingStep(have, need);
  if (step) openGate(step, to);
  return true;
}
