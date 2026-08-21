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

export function usePublicPlacementPricing(): {
  registeredRub: number;
  paymentEnabled: boolean;
  loading: boolean;
} {
  const [registeredRub, setRegisteredRub] = useState(20);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  return { registeredRub, paymentEnabled, loading };
}
