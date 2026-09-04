import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getToken } from "@/lib/api/client";
import { getSession, useCurrentUser, useSessionResolved } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { ensureSession } from "@/lib/auth/session";
import {
  isAnonymousUser,
  isPhoneVerified,
  isPhoneVerificationRequired,
  isStaffUser,
} from "@/lib/auth/verification";
import { useMySubscription } from "@/lib/subscription";
import {
  getFeedGuestAccessSync,
  isActionAllowedForTier,
  loadFeedGuestAccess,
  resolveMinTier,
  subscribeFeedGuestAccess,
} from "@/lib/feed-guest-access/store";
import type { AccessTier, FeedGuestAccessConfig } from "@/lib/api/feed-guest-access";
import {
  currentPath,
  firstFailingStep,
  gateRequire,
  levelFromAccessTier,
  levelOf,
  openGate,
  type Level,
} from "@/lib/gate";

export const ACCESS_GATE_EVENT = "modelizm:access-gate";

interface GuestAccessContextValue {
  config: FeedGuestAccessConfig | null;
  loading: boolean;
  /** False until guest-access config and (for signed-in users) subscription status are known. */
  ready: boolean;
  isGuest: boolean;
  needsPhone: boolean;
  needsSubscription: boolean;
  isAllowed: (actionKey: string) => boolean;
  guardAction: (actionKey: string, onAllowed: () => void, returnTo?: string) => void;
  /** Guest → login window. Logged-in without SMS → verify window. */
  requireAccount: (onAllowed: () => void, returnTo?: string) => void;
  /** Guest → login window. Does not require phone verification or a subscription. */
  requireLogin: (onAllowed: () => void) => void;
  /** Account gate, then the subscription window for premium actions. */
  requirePremium: (onAllowed: () => void, returnTo?: string) => void;
}

const GuestAccessContext = createContext<GuestAccessContextValue | null>(null);

/**
 * Adapter over `lib/gate`. The old call sites (~50 files) keep this API, but
 * every refusal now goes through the single gate: one window over the current
 * page, the blocked action stored as the pending intent and replayed the
 * moment the missing rung is reached. No call site navigates to /login.
 */
export function GuestAccessProvider({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  const sessionReady = useSessionResolved();
  const { sub, loading: subLoading } = useMySubscription();
  const isGuest = !getToken() || (sessionReady && isAnonymousUser(me));
  const needsPhone =
    !isDemoMode() && !isGuest && isPhoneVerificationRequired(me) && !isPhoneVerified(me);
  const needsSubscription =
    !isDemoMode() &&
    !isGuest &&
    !needsPhone &&
    !isStaffUser(me) &&
    !subLoading &&
    sub?.is_active !== true;
  const [config, setConfig] = useState<FeedGuestAccessConfig | null>(() =>
    getFeedGuestAccessSync(),
  );
  const [loading, setLoading] = useState(() => !getFeedGuestAccessSync());

  useEffect(() => {
    let alive = true;
    if (getFeedGuestAccessSync()) {
      setLoading(false);
    } else {
      void loadFeedGuestAccess().then((c) => {
        if (alive) {
          setConfig(c);
          setLoading(false);
        }
      });
    }
    const unsub = subscribeFeedGuestAccess(() => {
      void loadFeedGuestAccess().then((c) => {
        if (alive) setConfig(c);
      });
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  // Legacy escape hatch: modules that only know how to shout ("phone not
  // verified", "subscription required") still open the same single window.
  useEffect(() => {
    const onGate = (event: Event) => {
      const code = (event as CustomEvent<{ code?: string }>).detail?.code;
      if (isDemoMode() || !getToken()) return;
      if (code === "phone_not_verified") {
        openGate("verify", currentPath());
        return;
      }
      if (code === "subscription_required") {
        // Still one window at a time: an account that has not passed SMS yet
        // sees verification first, a verified one sees the subscription.
        const step = firstFailingStep(levelOf(getSession()), "subscriber");
        if (step) openGate(step, currentPath());
      }
    };
    window.addEventListener(ACCESS_GATE_EVENT, onGate);
    return () => window.removeEventListener(ACCESS_GATE_EVENT, onGate);
  }, []);

  const isAllowed = useCallback(
    (actionKey: string) => {
      if (isDemoMode() || isStaffUser(me)) return true;
      if (isGuest) return isActionAllowedForTier(actionKey, "guest", config);
      if (subLoading) return isActionAllowedForTier(actionKey, "auth", config);
      const userTier: AccessTier = sub?.is_active === true ? "subscription" : "auth";
      return isActionAllowedForTier(actionKey, userTier, config);
    },
    [isGuest, subLoading, sub?.is_active, config, me],
  );

  /**
   * The one refusal path. `gateRequire` runs the action immediately when the
   * viewer already meets the level, otherwise it stores it and opens exactly
   * one window; `resumeIntent` replays it after the window succeeds.
   */
  const runGate = useCallback(
    async (need: Level, onAllowed: () => void, intent?: { key: string; returnTo?: string }) => {
      if (isDemoMode()) {
        onAllowed();
        return;
      }
      // A click can land before the session probe resolves; without this the
      // gate would read "guest" and show the login window to a signed-in user.
      if (getToken() && !getSession()) await ensureSession();
      await gateRequire(need, onAllowed, {
        intent: intent ? { key: intent.key, returnTo: intent.returnTo } : undefined,
      });
    },
    [],
  );

  const requireLogin = useCallback(
    (onAllowed: () => void) => void runGate("registered", onAllowed),
    [runGate],
  );

  const requireAccount = useCallback(
    (onAllowed: () => void, returnTo?: string) =>
      void runGate("verified", onAllowed, { key: "action", returnTo }),
    [runGate],
  );

  const requirePremium = useCallback(
    (onAllowed: () => void, returnTo?: string) =>
      void runGate("subscriber", onAllowed, { key: "action", returnTo }),
    [runGate],
  );

  const guardAction = useCallback(
    (actionKey: string, onAllowed: () => void, returnTo?: string) => {
      if (isAllowed(actionKey)) {
        onAllowed();
        return;
      }
      // Admin-configured minimum for this action → the rung the gate asks for.
      const need = levelFromAccessTier(resolveMinTier(actionKey, config));
      void runGate(need, onAllowed, { key: actionKey, returnTo });
    },
    [isAllowed, config, runGate],
  );

  const ready =
    !loading && (isGuest || isDemoMode() || isStaffUser(me) || !getToken() || sessionReady);

  const value = useMemo(
    () => ({
      config,
      loading,
      ready,
      isGuest,
      needsPhone,
      needsSubscription,
      isAllowed,
      guardAction,
      requireAccount,
      requireLogin,
      requirePremium,
    }),
    [
      config,
      loading,
      ready,
      isGuest,
      needsPhone,
      needsSubscription,
      isAllowed,
      guardAction,
      requireAccount,
      requireLogin,
      requirePremium,
    ],
  );

  // The windows themselves live in <GateHost /> (mounted once in the root):
  // one auth dialog, one verify dialog, one paywall for the whole app.
  return <GuestAccessContext.Provider value={value}>{children}</GuestAccessContext.Provider>;
}

export function useGuestAccess(): GuestAccessContextValue {
  const ctx = useContext(GuestAccessContext);
  if (!ctx) {
    throw new Error("useGuestAccess must be used within GuestAccessProvider");
  }
  return ctx;
}

/** Safe hook for modules that may render outside provider during SSR. */
export function useGuestAccessOptional(): GuestAccessContextValue | null {
  return useContext(GuestAccessContext);
}
