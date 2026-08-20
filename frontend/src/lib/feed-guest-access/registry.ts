import type { FeedGuestAccessConfig } from "@/lib/api/feed-guest-access";

/** Mirrors backend FeedGuestAccessRegistry default_allowed values. */
export const GUEST_ACCESS_DEFAULTS: Record<string, boolean> = {
  "feed.filter.all": true,
  "feed.filter.following": false,
  "feed.filter.categories": false,
  "feed.filter.saved": false,
  "feed.filter.scheduled": false,
  "feed.category.select": false,
  "feed.compose.open": false,
  "feed.banner.navigate": true,
  "feed.post.open": true,
  "feed.post.like": false,
  "feed.post.comment": false,
  "feed.post.save": false,
  "feed.post.repost": false,
  "feed.post.author": true,
  "feed.sponsored.click": true,
  "feed.empty.action": true,
  "feed.rail.all_categories": false,
  "feed.rail.category": false,
  "feed.rail.subcategory": false,
  "feed.find_people.open": false,
  "feed.find_people.category": false,
  "layout.nav.feed": true,
  "layout.nav.ads": true,
  "layout.nav.ad_create": false,
  "layout.nav.my_ads": false,
  "layout.nav.deals": false,
  "layout.nav.favorites": false,
  "layout.nav.communities": false,
  "layout.nav.reviews": false,
  "layout.nav.channels": false,
  "layout.nav.messenger": false,
  "layout.nav.friends": false,
  "layout.nav.settings": false,
  "layout.header.notifications": false,
  "layout.header.search": true,
  "route.ads": true,
  "route.ads_new": false,
  "route.my_ads": false,
  "route.deals": false,
  "route.favorites": false,
  "route.reviews": false,
  "route.channels": false,
  "route.messenger": false,
  "route.friends": false,
  "route.communities": false,
  "route.categories": false,
  "route.notifications": false,
  "route.settings": false,
  "route.profile": false,
  "route.user": true,
};

export const FEED_FILTER_ACTIONS = {
  all: "feed.filter.all",
  following: "feed.filter.following",
  categories: "feed.filter.categories",
  saved: "feed.filter.saved",
  scheduled: "feed.filter.scheduled",
} as const;

export type FeedFilterKey = keyof typeof FEED_FILTER_ACTIONS;

/** Read-only browsing guests may do without an account. Everything else requires login. */
export const GUEST_PUBLIC_ACTIONS = new Set<string>([
  "feed.filter.all",
  "feed.banner.navigate",
  "feed.post.open",
  "feed.post.author",
  "feed.sponsored.click",
  "feed.empty.action",
  "layout.nav.feed",
  "layout.nav.ads",
  "layout.header.search",
  "route.ads",
  "route.user",
]);

/** Logged-in users without SMS may browse public content, but not act. */
export const VERIFIED_BROWSE_ACTIONS = new Set<string>([
  ...GUEST_PUBLIC_ACTIONS,
  "feed.filter.categories",
  "feed.category.select",
  "feed.rail.all_categories",
  "feed.rail.category",
  "feed.rail.subcategory",
  "feed.find_people.open",
  "feed.find_people.category",
  "layout.nav.reviews",
  "layout.nav.channels",
  "layout.nav.communities",
  "layout.nav.settings",
  "layout.header.notifications",
  "route.reviews",
  "route.channels",
  "route.communities",
  "route.settings",
  "route.profile",
  "route.notifications",
]);

/**
 * SMS-verified users without a subscription may browse and use listings,
 * but not premium social actions (posts, reactions, DMs, calls, channels, communities).
 */
export const FREE_WITHOUT_SUBSCRIPTION_ACTIONS = new Set<string>([
  ...VERIFIED_BROWSE_ACTIONS,
  "feed.filter.following",
  "feed.filter.saved",
  "feed.filter.scheduled",
  "feed.post.save",
  "layout.nav.ad_create",
  "layout.nav.my_ads",
  "layout.nav.deals",
  "layout.nav.favorites",
  "layout.nav.friends",
  "layout.nav.messenger",
  "route.ads_new",
  "route.my_ads",
  "route.deals",
  "route.favorites",
  "route.friends",
  "route.messenger",
]);

const POPUP_DEFAULTS = {
  title: "Войдите в аккаунт",
  description: "Чтобы пользоваться этой функцией, войдите или зарегистрируйтесь.",
  primary_cta: "Войти",
  secondary_cta: "Позже",
};

export function buildDefaultFeedGuestAccessConfig(): FeedGuestAccessConfig {
  const actions: FeedGuestAccessConfig["actions"] = {};
  for (const [key, allowed] of Object.entries(GUEST_ACCESS_DEFAULTS)) {
    actions[key] = { allowed, deny_mode: "inherit" };
  }
  return {
    version: 1,
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
