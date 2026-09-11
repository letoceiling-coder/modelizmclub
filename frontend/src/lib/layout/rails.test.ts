import { describe, expect, it } from "vitest";

import { hasDirectionsRail } from "./rails";

describe("hasDirectionsRail", () => {
  it("keeps the rail on feed, communities, channels and friends", () => {
    for (const path of [
      "/feed",
      "/communities",
      "/communities/modelizmclub",
      "/channels",
      "/channel/modelizm",
      "/friends",
    ]) {
      expect(hasDirectionsRail(path), path).toBe(true);
    }
  });

  it("drops the rail on messenger, reviews, catalog, my ads, favorites, settings and balance", () => {
    for (const path of [
      "/messenger",
      "/reviews",
      "/reviews/7c54d6c7-2d53-490d-ac42-36e197f34d13",
      "/ads",
      "/ads/3ed80234-a3fa-4ecd-9592-417d3956e042",
      "/my-ads",
      "/favorites",
      "/settings",
      "/settings/account",
      "/settings/wallet",
    ]) {
      expect(hasDirectionsRail(path), path).toBe(false);
    }
  });

  it("keeps the previous choice for pages outside the rule", () => {
    for (const path of [
      "/profile",
      "/user/test-sms-podpiska",
      "/notifications",
      "/referral",
      "/post/6691da27",
    ]) {
      expect(hasDirectionsRail(path), path).toBe(true);
    }
    for (const path of [
      "/ads/new",
      "/categories",
      "/categories/aviation",
      "/deals",
      "/help",
      "/subscription",
      "/communities/new",
      "/channels/new",
    ]) {
      expect(hasDirectionsRail(path), path).toBe(false);
    }
  });
});
