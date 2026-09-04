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
 *   POST   /payments/{uuid}/confirm-stub  ConfirmStubPaymentController  (test acquiring outcomes)
 *   GET    /users/me/subscription         MySubscriptionController
 *   POST   /users/me/subscription/cancel  CancelSubscriptionController
 *   GET    /plans                         IndexPlansController
 */

/** Result of creating a checkout. `checkout_url` is the hosted page:
 *  VTB formUrl in battle mode, `/pay/stub/{uuid}` in test mode.
 *  Null for wallet payments (already `status: "paid"`, provider `"wallet"`). */
export interface PaymentCheckout {
  payment_uuid: string;
  checkout_url: string | null;
  status: string; // "pending" | "paid" | ...
  provider: string; // "vtb" | "wallet" | "stub"
}

export type StubPayOutcome = "paid" | "insufficient_funds" | "declined";

export interface StubPayResult {
  payment_uuid: string;
  status: "paid" | "failed" | string;
  redirect_url: string;
}

/** Payment source: `gateway` = external acquiring (VTB/stub), `wallet` = debit
 *  the internal balance immediately (backend returns status "paid"). */
export type PayWith = "gateway" | "wallet";

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
  features: string[] | Record<string, unknown>;
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

/** List active subscription plans (prices managed in admin). */
export async function fetchPublicPlans(): Promise<SubscriptionPlanApi[]> {
  const res = await api<{ data: SubscriptionPlanApi[] }>("/plans", { auth: false });
  return res.data ?? [];
}

/**
 * Create a subscription checkout for the given plan slug.
 * planSlug must exist in subscription_plans.slug (month | half | year).
 */
export async function createSubscriptionPayment(
  planSlug: string,
  payWith: PayWith = "gateway",
): Promise<PaymentCheckout> {
  const res = await api<{ data: PaymentCheckout }>("/payments", {
    method: "POST",
    json: { plan_slug: planSlug, pay_with: payWith, idempotency_key: newIdempotencyKey() },
  });
  return res.data;
}

/** One-time paid listing placement (99 ₽) — same checkout shape as
 *  subscription; backend credits `users.listing_placement_credits` on
 *  fulfillment. */
export async function createListingPlacementPayment(input?: {
  taxonomyId?: number;
  categoryId?: number;
  subcategoryId?: number;
  promocode?: string;
  listingUuid?: string;
  payWith?: PayWith;
}): Promise<PaymentCheckout> {
  const res = await api<{ data: PaymentCheckout }>("/payments", {
    method: "POST",
    json: {
      payable_type: "listing_placement",
      taxonomy_id: input?.taxonomyId,
      category_id: input?.categoryId,
      subcategory_id: input?.subcategoryId,
      promocode: input?.promocode?.trim() || undefined,
      listing_uuid: input?.listingUuid,
      pay_with: input?.payWith ?? "gateway",
      idempotency_key: newIdempotencyKey(),
    },
  });
  return res.data;
}

export async function fetchPayment(uuid: string): Promise<PaymentStatus> {
  const res = await api<{ data: PaymentStatus }>(`/payments/${uuid}`);
  return res.data;
}

export async function syncPayment(uuid: string): Promise<{ status: string; payment_uuid: string }> {
  const res = await api<{ data: { status: string; payment_uuid: string } }>(
    `/payments/${uuid}/sync`,
    {
      method: "POST",
    },
  );
  return res.data;
}

/** Test acquiring only: resolve a stub payment with a simulated bank outcome.
 *  Backend rejects this while BILLING_PROVIDER=vtb (live VTB). */
export async function resolveStubPayment(
  uuid: string,
  outcome: StubPayOutcome = "paid",
): Promise<StubPayResult> {
  const res = await api<{ data: StubPayResult }>(`/payments/${uuid}/confirm-stub`, {
    method: "POST",
    json: { outcome },
  });
  return res.data;
}

/** @deprecated Use resolveStubPayment — kept for callers that only need a paid outcome. */
export async function confirmStubPayment(uuid: string): Promise<void> {
  await resolveStubPayment(uuid, "paid");
}

export function paymentFailureCopy(reason: string | undefined, t: (key: string) => string): string {
  if (reason === "insufficient_funds") return t("pages.subscription.payFailedNoFunds");
  if (reason === "declined") return t("pages.subscription.payFailedBadCard");
  return t("pages.subscription.payFailed");
}

/** Current subscription, or null when the user is on the free tier. */
export async function fetchMySubscription(): Promise<MySubscription | null> {
  const res = await api<{ data: MySubscription | null }>("/users/me/subscription");
  return res.data ?? null;
}

/** Stops auto-renew. The subscription stays valid until `ends_at`. */
export async function cancelMySubscription(): Promise<MySubscription | null> {
  const res = await api<{ data: MySubscription | null }>("/users/me/subscription/cancel", {
    method: "POST",
  });
  return res.data ?? null;
}

/* ── Saved payment methods (cards for paying — subscription / paid placement) ──
 * We NEVER store a raw card number. The card is tokenized by the acquiring
 * provider (VTB/YooKassa) via their binding flow; our backend keeps only the
 * provider token + display fields (brand, last4). See
 * docs/backend-endpoints-needed.md for the exact contract — these endpoints
 * are backend-owned (frontend-only stage). */

export interface PaymentMethod {
  id: string;
  brand: string; // "visa" | "mastercard" | "mir" | ...
  last4: string; // last 4 digits, for "•••• 4242" display only
  is_default?: boolean;
}

/** List saved cards. */
export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const res = await api<{ data: PaymentMethod[] }>("/account/payment-methods");
  return res.data ?? [];
}

/** Start binding a new card. Backend creates a provider binding order and
 *  returns its hosted card-entry URL; the provider returns the user to
 *  /settings/payment-methods?card=added|failed after the tokenization
 *  (typically a small hold/charge that's refunded). */
export async function addPaymentMethodBinding(): Promise<{ binding_url: string }> {
  const res = await api<{ data: { binding_url: string } }>("/account/payment-methods", {
    method: "POST",
  });
  return res.data;
}

/** Remove a saved card (revokes the provider token server-side). */
export async function deletePaymentMethod(id: string): Promise<void> {
  await api(`/account/payment-methods/${id}`, { method: "DELETE" });
}

/* ── Listing boost (продвижение) — one-time purchase, Stage 5 ──
 * Reuses the same checkout shape as subscription, but a different (backend
 * to-build) endpoint: CreatePaymentController today only accepts plan_slug.
 * See docs/backend-endpoints-needed.md. */

/** Start a checkout to promote (boost) a single listing. Returns the same
 *  PaymentCheckout shape — redirect to checkout_url (vtb/yookassa) or
 *  confirm-stub in the test contour. */
export async function createListingBoostPayment(
  listingUuid: string,
  packageId: string,
): Promise<PaymentCheckout> {
  const res = await api<{ data: PaymentCheckout }>(`/listings/${listingUuid}/promote`, {
    method: "POST",
    json: { package: packageId, idempotency_key: newIdempotencyKey() },
  });
  return res.data;
}
