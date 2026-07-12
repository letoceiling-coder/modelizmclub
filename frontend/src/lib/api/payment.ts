import { api } from "./client";

/**
 * Billing / payments client. Wraps the backend Billing module
 * (backend/app/Modules/Billing). These are REAL-backend calls — there is
 * deliberately no demo-mode branch here: faking a successful payment would
 * be dishonest, and demo hosts (neeklo/local) have no billing backend. The
 * caller gates on isDemoMode() and keeps the honest "оплата будет доступна"
 * message there; only the real backend (production, acquiring enabled)
 * runs this flow.
 *
 * Contract mirrored from:
 *   POST   /payments                      CreatePaymentController   { plan_slug, idempotency_key? }
 *   GET    /payments/{uuid}               ShowPaymentController
 *   POST   /payments/{uuid}/sync          SyncPaymentController
 *   POST   /payments/{uuid}/confirm-stub  ConfirmStubPaymentController  (dev/stub only)
 *   GET    /users/me/subscription         MySubscriptionController
 *   GET    /plans                         IndexPlansController
 */

/** Result of creating a checkout. `checkout_url` is the provider's hosted
 *  payment page for vtb/yookassa (redirect there); it's null for the stub
 *  provider (no hosted page — confirm via confirmStubPayment instead). */
export interface PaymentCheckout {
  payment_uuid: string;
  checkout_url: string | null;
  status: string; // "pending" | "paid" | ...
  provider: string; // "vtb" | "yookassa" | "stub"
}

export interface PaymentStatus {
  payment_uuid: string;
  status: string;
  provider: string | null;
  amount_cents: number;
  currency: string;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface SubscriptionPlanApi {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  price_rub: number;
  period_days: number;
  features: string[];
  badge_label: string | null;
  sort_order: number;
}

export interface MySubscription {
  id: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  auto_renew: boolean;
  is_active: boolean;
  days_left: number | null;
  plan?: SubscriptionPlanApi | null;
}

/** Best-effort idempotency key so a double-tap doesn't create two payments
 *  (backend enforces uniqueness on payments.idempotency_key). */
function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Create a subscription checkout for the given plan slug.
 * NOTE ON slug: the frontend pricing config (src/lib/config/pricing.ts) uses
 * ids "month" | "half" | "year"; the backend expects a plan_slug that
 * exists in subscription_plans.slug. These MUST match — documented in
 * docs/backend-endpoints-needed.md. Only subscription is supported by the
 * current CreatePaymentController; paid listings / boosts (Stage 5) are a
 * separate payable type not wired here yet.
 */
export async function createSubscriptionPayment(planSlug: string): Promise<PaymentCheckout> {
  const res = await api<{ data: PaymentCheckout }>("/payments", {
    method: "POST",
    json: { plan_slug: planSlug, idempotency_key: newIdempotencyKey() },
  });
  return res.data;
}

export async function fetchPayment(uuid: string): Promise<PaymentStatus> {
  const res = await api<{ data: PaymentStatus }>(`/payments/${uuid}`);
  return res.data;
}

export async function syncPayment(uuid: string): Promise<{ status: string; payment_uuid: string }> {
  const res = await api<{ data: { status: string; payment_uuid: string } }>(`/payments/${uuid}/sync`, {
    method: "POST",
  });
  return res.data;
}

/** Dev/test-contour only: confirm a stub payment (no hosted page). Backend
 *  rejects this unless the payment's provider is "stub". */
export async function confirmStubPayment(uuid: string): Promise<void> {
  await api(`/payments/${uuid}/confirm-stub`, { method: "POST" });
}

/** Current subscription, or null when the user is on the free tier. */
export async function fetchMySubscription(): Promise<MySubscription | null> {
  const res = await api<{ data: MySubscription | null }>("/users/me/subscription");
  return res.data ?? null;
}
