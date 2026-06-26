import { apiRequest } from "./client";
import { getAuthToken } from "./auth";

export type PaymentCheckout = {
  payment_uuid: string;
  checkout_url: string | null;
  status: string;
  provider: "vtb" | "yookassa" | "stub" | string;
};

export type PaymentStatus = PaymentCheckout & {
  amount_cents: number;
  currency: string;
  paid_at: string | null;
  metadata?: Record<string, unknown>;
};

export type SubscriptionPlan = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  price_rub: number;
  period_days: number;
  features: string[] | Record<string, unknown>;
  badge_label: string | null;
};

export async function fetchPlans(): Promise<SubscriptionPlan[]> {
  const res = await apiRequest<{ data: SubscriptionPlan[] }>("/plans");
  return res.data ?? [];
}

export async function createPayment(planSlug: string, idempotencyKey?: string): Promise<PaymentCheckout> {
  const token = getAuthToken();
  const res = await apiRequest<{ data: PaymentCheckout }>("/payments", {
    method: "POST",
    token,
    json: {
      plan_slug: planSlug,
      idempotency_key: idempotencyKey,
    },
  });
  return res.data;
}

export async function syncPayment(uuid: string): Promise<PaymentCheckout> {
  const token = getAuthToken();
  const res = await apiRequest<{ data: PaymentCheckout }>(`/payments/${uuid}/sync`, {
    method: "POST",
    token,
  });
  return res.data;
}

export async function confirmStubPayment(uuid: string): Promise<void> {
  const token = getAuthToken();
  await apiRequest(`/payments/${uuid}/confirm-stub`, { method: "POST", token });
}

export async function getPayment(uuid: string): Promise<PaymentStatus> {
  const token = getAuthToken();
  const res = await apiRequest<{ data: PaymentStatus }>(`/payments/${uuid}`, { token });
  return res.data;
}
