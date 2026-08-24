import type { AccessTier, FeedGuestAccessConfig, GuestAccessActionConfig } from "@/lib/api/feed-guest-access";

export type { AccessTier };

export const ACCESS_TIERS: AccessTier[] = ["guest", "auth", "subscription"];

export const TIER_RANK: Record<AccessTier, number> = {
  guest: 0,
  auth: 1,
  subscription: 2,
};

export function isValidAccessTier(value: unknown): value is AccessTier {
  return value === "guest" || value === "auth" || value === "subscription";
}

export function isTierAtLeast(userTier: AccessTier, required: AccessTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}

/** Mirrors backend FeedGuestAccessRegistry default_min_tier values. */
export const GUEST_ACCESS_DEFAULT_TIERS: Record<string, AccessTier> = {
  "feed.filter.all": "guest",
  "feed.filter.following": "auth",
  "feed.filter.categories": "auth",
  "feed.filter.saved": "auth",
  "feed.filter.scheduled": "auth",
  "feed.category.select": "auth",
  "feed.compose.open": "subscription",
  "feed.banner.navigate": "guest",
  "feed.post.open": "guest",
  "feed.post.like": "subscription",
  "feed.post.comment": "subscription",
  "feed.post.save": "auth",
  "feed.post.repost": "subscription",
  "feed.post.author": "guest",
  "feed.sponsored.click": "guest",
  "feed.empty.action": "guest",
  "feed.rail.all_categories": "auth",
  "feed.rail.category": "auth",
  "feed.rail.subcategory": "auth",
  "feed.find_people.open": "auth",
  "feed.find_people.category": "auth",
  "layout.nav.feed": "guest",
  "layout.nav.ads": "guest",
  "layout.nav.ad_create": "auth",
  "layout.nav.my_ads": "auth",
  "layout.nav.deals": "auth",
  "layout.nav.favorites": "auth",
  "layout.nav.communities": "auth",
  "layout.nav.reviews": "auth",
  "layout.nav.channels": "auth",
  "layout.nav.messenger": "auth",
  "layout.nav.friends": "auth",
  "layout.nav.settings": "auth",
  "layout.header.notifications": "auth",
  "layout.header.search": "guest",
  "route.feed": "guest",
  "route.ads": "guest",
  "route.ads_new": "auth",
  "route.my_ads": "auth",
  "route.deals": "auth",
  "route.favorites": "auth",
  "route.reviews": "auth",
  "route.channels": "auth",
  "route.messenger": "auth",
  "route.friends": "auth",
  "route.communities": "auth",
  "route.categories": "auth",
  "route.notifications": "auth",
  "route.settings": "auth",
  "route.profile": "auth",
  "route.user": "guest",
};

export const GUEST_ACCESS_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  Object.entries(GUEST_ACCESS_DEFAULT_TIERS).map(([key, tier]) => [key, tier === "guest"]),
);

export function normalizeActionConfig(
  patch: Partial<GuestAccessActionConfig> | undefined,
  fallbackTier: AccessTier = "auth",
): GuestAccessActionConfig {
  let minTier: AccessTier = fallbackTier;
  if (patch && isValidAccessTier(patch.min_tier)) {
    minTier = patch.min_tier;
  } else if (patch && typeof patch.allowed === "boolean") {
    minTier = patch.allowed ? "guest" : fallbackTier === "guest" ? "auth" : fallbackTier;
  }
  const denyMode = patch?.deny_mode === "popup" || patch?.deny_mode === "redirect" || patch?.deny_mode === "inherit"
    ? patch.deny_mode
    : "inherit";
  return { min_tier: minTier, allowed: minTier === "guest", deny_mode: denyMode };
}

export const FEED_FILTER_ACTIONS = {
  all: "feed.filter.all",
  following: "feed.filter.following",
  categories: "feed.filter.categories",
  saved: "feed.filter.saved",
  scheduled: "feed.filter.scheduled",
} as const;

export type FeedFilterKey = keyof typeof FEED_FILTER_ACTIONS;

const POPUP_DEFAULTS = {
  title: "Войдите в аккаунт",
  description: "Чтобы пользоваться этой функцией, войдите или зарегистрируйтесь.",
  primary_cta: "Войти",
  secondary_cta: "Позже",
};

export function buildDefaultFeedGuestAccessConfig(): FeedGuestAccessConfig {
  const actions: FeedGuestAccessConfig["actions"] = {};
  for (const [key, minTier] of Object.entries(GUEST_ACCESS_DEFAULT_TIERS)) {
    actions[key] = { min_tier: minTier, allowed: minTier === "guest", deny_mode: "inherit" };
  }
  return {
    version: 2,
    default_deny_mode: "popup",
    popup: POPUP_DEFAULTS,
    actions,
  };
}

export function firstAllowedFeedFilter(isAllowed: (key: string) => boolean): FeedFilterKey {
  for (const id of ["all", "following", "categories", "saved", "scheduled"] as const) {
    if (isAllowed(FEED_FILTER_ACTIONS[id])) return id;
  }
  return "all";
}
