import type { FeedGuestAccessConfig } from "@/lib/api/feed-guest-access";

/** Mirrors backend FeedGuestAccessRegistry default_allowed values. */
export const GUEST_ACCESS_DEFAULTS: Record<string, boolean> = {
  "feed.filter.all": true,
  "feed.filter.following": false,
  "feed.filter.categories": false,
  "feed.filter.saved": false,
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
  "layout.nav.favorites": false,
  "layout.nav.communities": false,
  "layout.nav.reviews": true,
  "layout.nav.channels": true,
  "layout.nav.messenger": false,
  "layout.nav.friends": false,
  "layout.nav.settings": false,
  "layout.header.notifications": false,
  "layout.header.search": true,
  "route.ads": true,
  "route.ads_new": false,
  "route.my_ads": false,
  "route.favorites": false,
  "route.reviews": true,
  "route.channels": true,
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
} as const;

export type FeedFilterKey = keyof typeof FEED_FILTER_ACTIONS;

const POPUP_DEFAULTS = {
  title: "Нужна подписка",
  description: "Войдите и оформите подписку, чтобы пользоваться этой функцией.",
  primary_cta: "Оформить подписку",
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
  for (const id of ["all", "following", "categories", "saved"] as const) {
    if (isAllowed(FEED_FILTER_ACTIONS[id])) return id;
  }
  return "all";
}
