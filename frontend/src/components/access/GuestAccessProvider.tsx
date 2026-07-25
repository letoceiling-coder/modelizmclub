import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getToken } from "@/lib/api/client";
import { selectors, useStore } from "@/lib/store";
import {
  isGuestActionAllowed,
  loadFeedGuestAccess,
  resolveDenyMode,
  subscribeFeedGuestAccess,
  type FeedGuestAccessConfig,
} from "@/lib/feed-guest-access/store";
import { SubscriptionPaywallDialog } from "@/components/access/SubscriptionPaywallDialog";
import { ROUTES } from "@/lib/routes";

interface GuestAccessContextValue {
  config: FeedGuestAccessConfig | null;
  loading: boolean;
  isGuest: boolean;
  isAllowed: (actionKey: string) => boolean;
  guardAction: (actionKey: string, onAllowed: () => void) => void;
}

const GuestAccessContext = createContext<GuestAccessContextValue | null>(null);

export function GuestAccessProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const me = useStore(selectors.currentUser);
  const isGuest = me.id === "guest" && !getToken();
  const [config, setConfig] = useState<FeedGuestAccessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [blockedAction, setBlockedAction] = useState<string | null>(null);

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

  const isAllowed = useCallback(
    (actionKey: string) => !isGuest || isGuestActionAllowed(actionKey, config),
    [isGuest, config],
  );

  const guardAction = useCallback(
    (actionKey: string, onAllowed: () => void) => {
      if (!isGuest || isGuestActionAllowed(actionKey, config)) {
        onAllowed();
        return;
      }
      const mode = resolveDenyMode(actionKey, config);
      if (mode === "redirect") {
        navigate({ to: ROUTES.subscription, search: { from: actionKey } });
        return;
      }
      setBlockedAction(actionKey);
      setPaywallOpen(true);
    },
    [isGuest, config, navigate],
  );

  const value = useMemo(
    () => ({ config, loading, isGuest, isAllowed, guardAction }),
    [config, loading, isGuest, isAllowed, guardAction],
  );

  return (
    <GuestAccessContext.Provider value={value}>
      {children}
      <SubscriptionPaywallDialog
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        config={config}
        actionKey={blockedAction}
        onPrimary={() => {
          setPaywallOpen(false);
          navigate({ to: ROUTES.subscription, search: blockedAction ? { from: blockedAction } : {} });
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
