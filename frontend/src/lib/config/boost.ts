/**
 * Boost (продвижение) packages for a single listing — one-time purchase,
 * separate from the subscription.
 *
 * ⚠️ PLACEHOLDER PRICING/DURATIONS. These are NOT product-signed-off and are
 * NOT the source of truth: the backend has `listing_pricing_rules` /
 * `listing_promotions` tables but no pricing API yet. When the backend
 * exposes GET /listings/boost-packages, this hardcoded list must be replaced
 * by that response. Kept here only so the frontend boost flow is buildable
 * before the backend/product decision lands. See
 * docs/backend-endpoints-needed.md (Stage 5).
 */
export interface BoostPackage {
  id: string;
  label: string;
  days: number;
  price: number; // ₽
}

export const BOOST_PACKAGES: BoostPackage[] = [
  { id: "boost-7", label: "7 дней", days: 7, price: 149 },
  { id: "boost-14", label: "14 дней", days: 14, price: 249 },
  { id: "boost-30", label: "30 дней", days: 30, price: 399 },
];
