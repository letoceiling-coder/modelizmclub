import { useEffect, useState } from "react";
import { fetchPublicPlans, type SubscriptionPlanApi } from "@/lib/api/payment";
import {
  mapApiPlansToPricingPlans,
  PRICING_PLANS_FALLBACK,
  type PricingPlan,
} from "@/lib/config/pricing";

export function usePricingPlans(): { plans: PricingPlan[]; loading: boolean } {
  const [plans, setPlans] = useState<PricingPlan[]>(PRICING_PLANS_FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPublicPlans()
      .then((apiPlans) => {
        if (!active) return;
        setPlans(mapApiPlansToPricingPlans(apiPlans));
      })
      .catch(() => {
        if (active) setPlans(PRICING_PLANS_FALLBACK);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { plans, loading };
}

export type { PricingPlan, SubscriptionPlanApi };
