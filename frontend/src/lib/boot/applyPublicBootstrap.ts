import { startPublicBootstrap, type PublicBootstrapPayload } from "@/lib/api/bootstrap";
import { seedLandingBlocks } from "@/lib/api/landing-blocks";
import { seedLandingStats } from "@/lib/api/landing";
import { seedLandingFaq, seedStats } from "@/lib/api/content";
import { seedPostCategoryTree, seedListingCategoryTree } from "@/lib/api/categories";
import { seedSiteBranding } from "@/lib/hooks/useSiteBranding";
import { seedFooterContacts } from "@/lib/hooks/useFooterContacts";
import { applyServerFeatureFlags, markFeatureFlagsHydrated } from "@/lib/config/featureFlags";
import { applyPublishedMap } from "@/lib/icon-overrides";
import { seedFeedGuestAccess } from "@/lib/feed-guest-access/store";

export function applyPublicBootstrap(data: PublicBootstrapPayload): void {
  if (data.landing_blocks) seedLandingBlocks(data.landing_blocks);
  if (data.landing_stats) seedLandingStats(data.landing_stats);
  if (data.branding) seedSiteBranding(data.branding);
  if (data.footer_contacts) seedFooterContacts(data.footer_contacts);
  applyServerFeatureFlags(data.feature_flags ?? {});
  applyPublishedMap(data.icon_overrides ?? {}, "bootstrap");
  if (data.feed_guest_access) seedFeedGuestAccess(data.feed_guest_access);
  seedLandingFaq(data.landing_faq ?? []);
  if (data.post_categories) seedPostCategoryTree(data.post_categories);
  if (data.listing_categories) seedListingCategoryTree(data.listing_categories);
  const fh = data.stats?.first_hundred ?? {};
  const ref = data.stats?.referral ?? {};
  seedStats({
    firstHundred: {
      taken: fh.taken ?? 0,
      total: fh.total ?? 0,
      enabled: fh.enabled ?? false,
    },
    referral: {
      enabled: ref.enabled ?? false,
      perInvite: ref.per_invite ?? 0,
      maxBonus: ref.max_bonus ?? 0,
    },
  });
}

/** Fetch /public/bootstrap once, seed every client cache, then resolve. */
export async function ensurePublicBootstrap(): Promise<PublicBootstrapPayload | null> {
  const data = await startPublicBootstrap();
  if (data) {
    applyPublicBootstrap(data);
    return data;
  }
  markFeatureFlagsHydrated();
  return null;
}
