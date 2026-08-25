import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import type { SiteBranding } from "@/lib/api/site";
import type { FooterContacts } from "@/lib/footer-contacts";
import type { FooterLinksGrouped } from "@/lib/api/legal";
import type { LandingBlocksPublic } from "@/lib/api/landing-blocks";
import type { LandingStats } from "@/lib/api/landing";
import type { FaqCategory } from "@/lib/api/content";
import type { FeedGuestAccessConfig } from "@/lib/api/feed-guest-access";
import type { IconOverrideMap } from "@/lib/api/icons";

export interface BootstrapFeatureFlags {
  communities_enabled?: boolean;
  reviews_enabled?: boolean;
  market_enabled?: boolean;
  escrow_enabled?: boolean;
  listing_payment_enabled?: boolean;
}

export interface BootstrapStats {
  first_hundred?: { taken?: number; total?: number; enabled?: boolean };
  referral?: { enabled?: boolean; per_invite?: number; max_bonus?: number };
}

export interface PublicBootstrapPayload {
  feature_flags: BootstrapFeatureFlags;
  branding: SiteBranding;
  footer_contacts: FooterContacts;
  footer_links: FooterLinksGrouped;
  landing_blocks: LandingBlocksPublic;
  landing_stats: LandingStats;
  stats: BootstrapStats;
  feed_guest_access: FeedGuestAccessConfig;
  icon_overrides: IconOverrideMap;
  landing_faq: FaqCategory[];
}

let payload: PublicBootstrapPayload | null = null;
let inflight: Promise<PublicBootstrapPayload | null> | null = null;

export function getPublicBootstrapSync(): PublicBootstrapPayload | null {
  return payload;
}

export async function fetchPublicBootstrap(): Promise<PublicBootstrapPayload> {
  const res = await api<{ data: PublicBootstrapPayload }>("/public/bootstrap", { auth: false });
  return res.data;
}

/** Single in-flight GET /public/bootstrap. Demo mode skips the network. */
export function startPublicBootstrap(): Promise<PublicBootstrapPayload | null> {
  if (isDemoMode()) return Promise.resolve(null);
  if (inflight) return inflight;
  inflight = fetchPublicBootstrap()
    .then((data) => {
      payload = data;
      return data;
    })
    .catch(() => {
      inflight = null;
      return null;
    });
  return inflight;
}

export function mapBootstrapFeatureFlags(data: BootstrapFeatureFlags): {
  communitiesEnabled: boolean;
  reviewsEnabled: boolean;
  marketEnabled: boolean;
  escrowEnabled: boolean;
  listingPaymentEnabled: boolean;
} {
  return {
    communitiesEnabled: Boolean(data.communities_enabled),
    reviewsEnabled: data.reviews_enabled !== false,
    marketEnabled: Boolean(data.market_enabled),
    escrowEnabled: Boolean(data.escrow_enabled),
    listingPaymentEnabled: Boolean(data.listing_payment_enabled),
  };
}
