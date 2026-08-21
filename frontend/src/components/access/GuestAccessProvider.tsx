import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getToken } from "@/lib/api/client";
import { selectors, useStore } from "@/lib/store";
import { isDemoMode } from "@/lib/demo-mode";
import {
  isAnonymousUser,
  isPhoneVerified,
  isPhoneVerificationRequired,
  isStaffUser,
} from "@/lib/auth/verification";
import { useMySubscription } from "@/lib/subscription";
import { ROUTES } from "@/lib/routes";
import {
  isGuestActionAllowed,
  loadFeedGuestAccess,
  subscribeFeedGuestAccess,
  type FeedGuestAccessConfig,
} from "@/lib/feed-guest-access/store";
import {
  FREE_WITHOUT_SUBSCRIPTION_ACTIONS,
  VERIFIED_BROWSE_ACTIONS,
} from "@/lib/feed-guest-access/registry";
import { GuestAuthDialog, guestReturnPath } from "@/components/access/GuestAuthDialog";
import { PhoneVerifyDialog } from "@/components/access/PhoneVerifyDialog";
import { SubscriptionPaywallDialog } from "@/components/access/SubscriptionPaywallDialog";

export const ACCESS_GATE_EVENT = "modelizm:access-gate";

interface GuestAccessContextValue {
  config: FeedGuestAccessConfig | null;
  loading: boolean;
  isGuest: boolean;
  needsPhone: boolean;
  needsSubscription: boolean;
  isAllowed: (actionKey: string) => boolean;
  guardAction: (actionKey: string, onAllowed: () => void, returnTo?: string) => void;
  /** Guest → login. Logged-in without SMS → phone dialog. Subscription is not required. */
  requireAccount: (onAllowed: () => void, returnTo?: string) => void;
  /** Guest → login. Does not require phone verification or a subscription. */
  requireLogin: (onAllowed: () => void) => void;
  /** Account gate, then subscription paywall for premium actions. */
  requirePremium: (onAllowed: () => void, returnTo?: string) => void;
}

const GuestAccessContext = createContext<GuestAccessContextValue | null>(null);

export function GuestAccessProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const me = useStore(selectors.currentUser);
  const sessionResolved = useStore(selectors.sessionResolved);
  const { sub, loading: subLoading } = useMySubscription();
  const isGuest = !getToken() || (sessionResolved && isAnonymousUser(me));
  const needsPhone =
    !isDemoMode() &&
    !isGuest &&
    isPhoneVerificationRequired(me) &&
    !isPhoneVerified(me);
  const needsSubscription =
    !isDemoMode() &&
    !isGuest &&
    !needsPhone &&
    !isStaffUser(me) &&
    !subLoading &&
    sub?.is_active !== true;
  const [config, setConfig] = useState<FeedGuestAccessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneReturnTo, setPhoneReturnTo] = useState("/feed");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const pendingAfterSub = useRef<{ onAllowed: () => void; actionKey?: string } | null>(null);
  const pendingPaywallEvent = useRef(false);

  useEffect(() => {
    let alive = true;
    void loadFeedGuestAccess().then((c) => {
      if (alive) {
        setConfig(c);
        setLoading(false);
      }
    });
    const unsub = subscribeFeedGuestAccess(() => {
      void loadFeedGuestAccess().then((c) => { if (alive) setConfig(c); });
    });
    return () => { alive = false; unsub(); };
  }, []);

  useEffect(() => {
    const onGate = (event: Event) => {
      const code = (event as CustomEvent<{ code?: string }>).detail?.code;
      if (code === "phone_not_verified") {
        if (!isGuest && getToken()) {
          setPhoneReturnTo(guestReturnPath());
          setPhoneOpen(true);
        }
        return;
      }
      if (code !== "subscription_required" || needsPhone || isGuest || !getToken()) return;
      if (isDemoMode() || isStaffUser(me) || sub?.is_active === true) return;
      if (subLoading) {
        pendingPaywallEvent.current = true;
        return;
      }
      setPaywallOpen(true);
    };
    window.addEventListener(ACCESS_GATE_EVENT, onGate);
    return () => window.removeEventListener(ACCESS_GATE_EVENT, onGate);
  }, [isGuest, needsPhone, subLoading, sub?.is_active, me]);

  const isAllowed = useCallback(
    (actionKey: string) => {
      if (isGuest) return isGuestActionAllowed(actionKey, config);
      if (needsPhone) return VERIFIED_BROWSE_ACTIONS.has(actionKey);
      if (subLoading) return true;
      if (needsSubscription) return FREE_WITHOUT_SUBSCRIPTION_ACTIONS.has(actionKey);
      return true;
    },
    [isGuest, needsPhone, needsSubscription, subLoading, config],
  );

  const openPhoneGate = useCallback((returnTo?: string) => {
    const path = returnTo?.startsWith("/") ? returnTo : guestReturnPath();
    setPhoneReturnTo(path);
    setPhoneOpen(true);
  }, []);

  const openPaywall = useCallback(() => {
    setPaywallOpen(true);
  }, []);

  const requireLogin = useCallback(
    (onAllowed: () => void) => {
      if (isGuest) {
        setAuthOpen(true);
        return;
      }
      onAllowed();
    },
    [isGuest],
  );

  const requireAccount = useCallback(
    (onAllowed: () => void, returnTo?: string) => {
      if (isGuest) {
        setAuthOpen(true);
        return;
      }
      if (needsPhone) {
        openPhoneGate(returnTo);
        return;
      }
      onAllowed();
    },
    [isGuest, needsPhone, openPhoneGate],
  );

  const requirePremium = useCallback(
    (onAllowed: () => void, returnTo?: string) => {
      if (isGuest) {
        setAuthOpen(true);
        return;
      }
      if (needsPhone) {
        openPhoneGate(returnTo);
        return;
      }
      if (subLoading) {
        pendingAfterSub.current = { onAllowed };
        return;
      }
      if (needsSubscription) {
        openPaywall();
        return;
      }
      onAllowed();
    },
    [isGuest, needsPhone, needsSubscription, subLoading, openPhoneGate, openPaywall],
  );

  const guardAction = useCallback(
    (actionKey: string, onAllowed: () => void, returnTo?: string) => {
      if (isGuest) {
        if (isAllowed(actionKey)) onAllowed();
        else setAuthOpen(true);
        return;
      }
      if (needsPhone) {
        if (isAllowed(actionKey)) onAllowed();
        else openPhoneGate(returnTo);
        return;
      }
      if (subLoading) {
        pendingAfterSub.current = { onAllowed, actionKey };
        return;
      }
      if (isAllowed(actionKey)) {
        onAllowed();
        return;
      }
      openPaywall();
    },
    [isAllowed, isGuest, needsPhone, subLoading, openPhoneGate, openPaywall],
  );

  useEffect(() => {
    if (subLoading) return;
    const pending = pendingAfterSub.current;
    pendingAfterSub.current = null;
    if (pending) {
      if (needsPhone) {
        if (pending.actionKey && VERIFIED_BROWSE_ACTIONS.has(pending.actionKey)) {
          pending.onAllowed();
        } else {
          openPhoneGate();
        }
      } else if (needsSubscription) {
        if (pending.actionKey && FREE_WITHOUT_SUBSCRIPTION_ACTIONS.has(pending.actionKey)) {
          pending.onAllowed();
        } else {
          openPaywall();
        }
      } else {
        pending.onAllowed();
      }
    }
    if (pendingPaywallEvent.current) {
      pendingPaywallEvent.current = false;
      if (needsSubscription) openPaywall();
    }
  }, [subLoading, needsPhone, needsSubscription, openPaywall, openPhoneGate]);

  const value = useMemo(
    () => ({
      config,
      loading,
      isGuest,
      needsPhone,
      needsSubscription,
      isAllowed,
      guardAction,
      requireAccount,
      requireLogin,
      requirePremium,
    }),
    [config, loading, isGuest, needsPhone, needsSubscription, isAllowed, guardAction, requireAccount, requireLogin, requirePremium],
  );

  return (
    <GuestAccessContext.Provider value={value}>
      {children}
      <GuestAuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onLogin={() => {
          setAuthOpen(false);
          navigate({ to: "/login", search: { redirect: guestReturnPath() } });
        }}
        onRegister={() => {
          setAuthOpen(false);
          navigate({ to: "/register" });
        }}
      />
      <PhoneVerifyDialog
        open={phoneOpen}
        onOpenChange={setPhoneOpen}
        onConfirm={() => {
          setPhoneOpen(false);
          navigate({
            to: "/settings/account",
            search: { redirect: phoneReturnTo },
          });
        }}
      />
      <SubscriptionPaywallDialog
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        onPrimary={() => {
          setPaywallOpen(false);
          navigate({ to: ROUTES.subscription });
        }}
      />
    </GuestAccessContext.Provider>
  );
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
