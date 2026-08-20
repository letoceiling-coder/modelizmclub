import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getToken } from "@/lib/api/client";
import { selectors, useStore } from "@/lib/store";
import {
  isGuestActionAllowed,
  loadFeedGuestAccess,
  subscribeFeedGuestAccess,
  type FeedGuestAccessConfig,
} from "@/lib/feed-guest-access/store";
import { GuestAuthDialog, guestReturnPath } from "@/components/access/GuestAuthDialog";

interface GuestAccessContextValue {
  config: FeedGuestAccessConfig | null;
  loading: boolean;
  isGuest: boolean;
  isAllowed: (actionKey: string) => boolean;
  guardAction: (actionKey: string, onAllowed: () => void) => void;
  /** Any account-required click: show login/register, never a subscription paywall. */
  requireAccount: (onAllowed: () => void) => void;
}

const GuestAccessContext = createContext<GuestAccessContextValue | null>(null);

export function GuestAccessProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const me = useStore(selectors.currentUser);
  const isGuest = me.id === "guest" && !getToken();
  const [config, setConfig] = useState<FeedGuestAccessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);

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

  const requireAccount = useCallback(
    (onAllowed: () => void) => {
      if (!isGuest) {
        onAllowed();
        return;
      }
      setAuthOpen(true);
    },
    [isGuest],
  );

  const guardAction = useCallback(
    (actionKey: string, onAllowed: () => void) => {
      if (!isGuest || isGuestActionAllowed(actionKey, config)) {
        onAllowed();
        return;
      }
      setAuthOpen(true);
    },
    [isGuest, config],
  );

  const value = useMemo(
    () => ({ config, loading, isGuest, isAllowed, guardAction, requireAccount }),
    [config, loading, isGuest, isAllowed, guardAction, requireAccount],
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
