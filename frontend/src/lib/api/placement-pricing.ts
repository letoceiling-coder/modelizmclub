import { useEffect, useState } from "react";
import { api } from "./client";

export interface PublicPlacementPricing {
  registered_price_cents: number;
  guest_price_cents: number;
  subscriber_default_price_cents: number;
  payment_enabled: boolean;
}

export async function fetchPublicPlacementPricing(): Promise<PublicPlacementPricing> {
  const res = await api<{ data: PublicPlacementPricing }>("/public/placement-pricing", {
    auth: false,
  });
  return res.data;
}

/**
 * @param initial pricing fetched by a route loader. `payment_enabled` decides
 *   whether a whole block renders, so learning it after mount inserts that
 *   block into a page the visitor is already reading. The feature flag from the
 *   public bootstrap is the same setting but is not applied until after the
 *   first paint, so it cannot stand in for this.
 */
export function usePublicPlacementPricing(initial?: PublicPlacementPricing | null): {
  registeredRub: number;
  paymentEnabled: boolean;
  loading: boolean;
} {
  const [registeredRub, setRegisteredRub] = useState(
    initial ? Math.round(initial.registered_price_cents / 100) : 20,
  );
  const [paymentEnabled, setPaymentEnabled] = useState(Boolean(initial?.payment_enabled));
  const [loading, setLoading] = useState(!initial);

  useEffect(() => {
    if (initial) return;
    let active = true;
    fetchPublicPlacementPricing()
      .then((data) => {
        if (!active) return;
        setRegisteredRub(Math.round(data.registered_price_cents / 100));
        setPaymentEnabled(Boolean(data.payment_enabled));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initial]);

  return { registeredRub, paymentEnabled, loading };
}
