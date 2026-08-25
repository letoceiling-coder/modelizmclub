import { api } from "./client";

/**
 * Wallet-based safe deal (escrow) client. Mirrors the backend Billing module
 * (spec v4.0 §T5). Money never leaves the internal wallet ledger: the buyer's
 * balance is held on creation, released to the seller on confirmation, or
 * refunded on cancel/dispute. All amounts are in kopecks.
 */

export type SafeDealStatus =
  | "created"
  | "paid"
  | "shipped"
  | "delivered"
  | "completed"
  | "disputed"
  | "refunded"
  | "cancelled";

export type SafeDealDeliveryStatus =
  | "pending"
  | "handed_to_cdek"
  | "in_transit"
  | "at_pickup"
  | "received";

export interface SafeDealDestination {
  city_code?: number;
  external_point_id?: string;
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface SafeDeal {
  uuid: string;
  listing_uuid: string | null;
  listing_title?: string | null;
  status: SafeDealStatus;
  status_label: string;
  money_status?: SafeDealStatus;
  money_status_label?: string;
  item_kopecks?: number;
  amount_kopecks: number;
  platform_fee_percent?: number;
  platform_fee_kopecks: number;
  seller_payout_kopecks: number;
  delivery_cost_kopecks?: number;
  currency: string;
  tracking_number: string | null;
  delivery_method: string | null;
  delivery_status?: SafeDealDeliveryStatus | null;
  delivery_status_label?: string | null;
  destination_point?: SafeDealDestination | null;
  shipment?: {
    uuid: string;
    status: string;
    tracking_number: string | null;
    external_status: string | null;
  } | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  auto_release_at: string | null;
  dispute?: { uuid: string; status: string; reason: string } | null;
  can_review?: boolean;
  my_review?: { rating: number; text: string | null } | null;
}

export interface SafeDealQuote {
  item_kopecks: number;
  platform_fee_percent: number;
  platform_fee_kopecks: number;
  delivery_cost_kopecks: number;
  total_kopecks: number;
  hold_kopecks: number;
  seller_payout_kopecks: number;
  currency: string;
  offers_cdek: boolean;
  parcel: {
    dimensions_cm: { length: number; width: number; height: number };
    weight_kg: number;
    package_size: string | null;
  };
  destination_point?: SafeDealDestination | null;
}

export type SafeDealRole = "buyer" | "seller";

export function kopecksToRub(kopecks: number): string {
  return (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export async function quoteSafeDeal(listingUuid: string, destination?: SafeDealDestination): Promise<SafeDealQuote> {
  const res = await api<{ data: SafeDealQuote }>(`/listings/${listingUuid}/safe-deal/quote`, {
    method: "POST",
    json: destination ? { destination_point: destination } : {},
  });
  return res.data;
}

export async function createSafeDeal(
  listingUuid: string,
  input?: { acceptTerms?: boolean; destination?: SafeDealDestination },
): Promise<SafeDeal> {
  const res = await api<{ data: SafeDeal }>(`/listings/${listingUuid}/safe-deal`, {
    method: "POST",
    json: {
      accept_terms: input?.acceptTerms ?? false,
      destination_point: input?.destination,
    },
  });
  return res.data;
}

export async function fetchSafeDeals(role?: SafeDealRole): Promise<SafeDeal[]> {
  const res = await api<{ data: SafeDeal[] }>("/safe-deals", {
    query: role ? { role, per_page: 50 } : { per_page: 50 },
  });
  return res.data ?? [];
}

export async function fetchSafeDeal(uuid: string): Promise<SafeDeal> {
  const res = await api<{ data: SafeDeal }>(`/safe-deals/${uuid}`);
  return res.data;
}

/** Resolve whether the current user is buyer or seller on a deal (used when a
 *  detail page is opened directly, without a role hint from the list). */
export async function resolveSafeDealRole(uuid: string): Promise<SafeDealRole | null> {
  const [asBuyer, asSeller] = await Promise.all([
    fetchSafeDeals("buyer").catch(() => [] as SafeDeal[]),
    fetchSafeDeals("seller").catch(() => [] as SafeDeal[]),
  ]);
  if (asBuyer.some((d) => d.uuid === uuid)) return "buyer";
  if (asSeller.some((d) => d.uuid === uuid)) return "seller";
  return null;
}

export async function shipSafeDeal(uuid: string, input?: { trackingNumber?: string; deliveryMethod?: string }): Promise<SafeDeal> {
  const res = await api<{ data: SafeDeal }>(`/safe-deals/${uuid}/ship`, {
    method: "POST",
    json: { tracking_number: input?.trackingNumber || undefined, delivery_method: input?.deliveryMethod || undefined },
  });
  return res.data;
}

export async function markSafeDealDelivered(uuid: string): Promise<SafeDeal> {
  const res = await api<{ data: SafeDeal }>(`/safe-deals/${uuid}/delivered`, { method: "POST" });
  return res.data;
}

export async function confirmSafeDeal(uuid: string): Promise<SafeDeal> {
  const res = await api<{ data: SafeDeal }>(`/safe-deals/${uuid}/confirm`, { method: "POST" });
  return res.data;
}

export async function cancelSafeDeal(uuid: string): Promise<SafeDeal> {
  const res = await api<{ data: SafeDeal }>(`/safe-deals/${uuid}/cancel`, { method: "POST" });
  return res.data;
}

export async function disputeSafeDeal(uuid: string, reason: string, description?: string): Promise<void> {
  await api(`/safe-deals/${uuid}/dispute`, {
    method: "POST",
    json: { reason, description: description || undefined },
  });
}

export async function reviewSafeDeal(uuid: string, rating: number, text?: string): Promise<SafeDeal> {
  const res = await api<{ data: { deal: SafeDeal } }>(`/safe-deals/${uuid}/review`, {
    method: "POST",
    json: { rating, text: text || undefined },
  });
  return res.data.deal;
}
