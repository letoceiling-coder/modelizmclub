import { useMemo } from "react";
import { getToken } from "@/lib/api/client";
import { selectors, useStore } from "@/lib/store";
import { useMySubscription } from "@/lib/subscription";
import {
  accessTierLabel,
  canCreateContent,
  canViewReviews,
  resolveAccessTier,
  tierMeetsCapability,
  type AccessCapability,
  type AccessTier,
} from "@/lib/access/accessTier";

export function useAccessTier(): {
  tier: AccessTier;
  label: string;
  loading: boolean;
  isGuest: boolean;
  can: (capability: AccessCapability) => boolean;
  canViewReviews: boolean;
  canCreateContent: boolean;
} {
  const me = useStore(selectors.currentUser);
  const sessionResolved = useStore(selectors.sessionResolved);
  const hasToken = !!getToken();
  const { sub, loading: subLoading } = useMySubscription();

  const tier = useMemo(
    () =>
      resolveAccessTier({
        hasToken,
        user: me.id === "guest" ? null : me,
        subscriptionActive: sub?.is_active === true,
      }),
    [hasToken, me, sub?.is_active],
  );

  const loading = !sessionResolved || (hasToken && me.id === "guest") || (hasToken && subLoading);

  return {
    tier,
    label: accessTierLabel(tier),
    loading,
    isGuest: tier === "guest",
    can: (capability: AccessCapability) => tierMeetsCapability(tier, capability),
    canViewReviews: canViewReviews(tier),
    canCreateContent: canCreateContent(tier),
  };
}
