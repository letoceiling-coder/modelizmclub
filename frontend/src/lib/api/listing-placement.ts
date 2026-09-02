import { api } from "./client";

export interface PlacementQuote {
  base_cents: number;
  subscriber_adjustment_cents: number;
  price_after_subscription_cents: number;
  promo_discount_cents: number;
  final_cents: number;
  currency: string;
  is_free: boolean;
  free_reason: string | null;
  free_listings_remaining: number | null;
  listing_placement_credits?: number;
  has_active_subscription: boolean;
  category_id: number | null;
  category_name: string | null;
  promocode: {
    id?: number;
    code?: string;
    type?: string;
    value?: number;
    error?: string;
  } | null;
}

export async function fetchPlacementQuote(params: {
  taxonomyId?: number;
  categoryId?: number;
  subcategoryId?: number;
  promocode?: string;
}): Promise<PlacementQuote> {
  const res = await api<{ data: PlacementQuote }>("/listings/placement-quote", {
    query: {
      taxonomy_id: params.taxonomyId,
      category_id: params.categoryId,
      subcategory_id: params.subcategoryId,
      promocode: params.promocode?.trim() || undefined,
    },
  });
  return res.data;
}

export function formatQuoteRub(cents: number): string {
  return (cents / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}
