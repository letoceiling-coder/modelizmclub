import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Heart,
  Clapperboard,
  Radio,
  Plus,
  Settings,
  Crown,
  ShoppingBag,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";

export type FeatureFlagKey = "communitiesEnabled" | "reviewsEnabled" | "marketEnabled";
export type NavGroup = "content" | "account";

export interface MobileMenuSection {
  key: string;
  /** Internal route (mutually exclusive with `href`). */
  to?: string;
  /** External link (mutually exclusive with `to`). */
  href?: string;
  labelKey: string;
  icon: LucideIcon;
  group: NavGroup;
  authOnly?: boolean;
  flag?: FeatureFlagKey;
}

/**
 * SINGLE SOURCE OF TRUTH for the mobile "…" (burger) menu.
 *
 * The 5 primary destinations live in the bottom tab bar (`PRIMARY_TAB_ROUTES`);
 * a few are one-tap header icons (`HEADER_ACTION_ROUTES`). EVERYTHING ELSE a user
 * can reach must appear here, grouped, so no section is stranded on mobile.
 *
 * Why a registry (not hardcoded JSX): the old MoreMenu was inline JSX that did
 * not derive from any list, so new routes (my-ads, subscription) were forgotten
 * twice. Now a new route is one line here and it shows up automatically; the
 * dev-time `assertMobileNavCoverage()` check fails loudly if anything is missed.
 */
export const MOBILE_MENU_SECTIONS: MobileMenuSection[] = [
  // — Контент —
  { key: "channels", to: ROUTES.channels, labelKey: "nav.channels", icon: Radio, group: "content" },
  {
    key: "reviews",
    to: ROUTES.reviews,
    labelKey: "nav.reviews",
    icon: Clapperboard,
    group: "content",
    flag: "reviewsEnabled",
  },
  {
    key: "my-ads",
    to: ROUTES.myAds,
    labelKey: "nav.myAds",
    icon: ClipboardList,
    group: "content",
    authOnly: true,
  },
  {
    key: "deals",
    to: ROUTES.deals,
    labelKey: "nav.deals",
    icon: ShieldCheck,
    group: "content",
    authOnly: true,
  },
  {
    key: "favorites",
    to: ROUTES.favorites,
    labelKey: "nav.favorites",
    icon: Heart,
    group: "content",
    authOnly: true,
  },
  { key: "ad-create", to: ROUTES.adCreate, labelKey: "nav.adCreate", icon: Plus, group: "content" },
  // — Аккаунт —
  {
    key: "settings",
    to: ROUTES.settings,
    labelKey: "nav.settings",
    icon: Settings,
    group: "account",
    authOnly: true,
  },
  {
    key: "wallet",
    to: ROUTES.wallet,
    labelKey: "nav.wallet",
    icon: Wallet,
    group: "account",
    authOnly: true,
  },
  {
    key: "subscription",
    to: ROUTES.subscription,
    labelKey: "nav.subscription",
    icon: Crown,
    group: "account",
  },
  {
    key: "market",
    href: "https://modelizm23.ru",
    labelKey: "nav.market",
    icon: ShoppingBag,
    group: "account",
    flag: "marketEnabled",
  },
];

/** Routes surfaced as bottom tabs (communities only when feature.communities_enabled is on). */
export const PRIMARY_TAB_ROUTES: string[] = [
  ROUTES.feed,
  ROUTES.messenger,
  ROUTES.ads,
  ROUTES.profile,
  ROUTES.friends,
  ROUTES.communities,
];

/** Routes surfaced as one-tap icons in the mobile header. */
export const HEADER_ACTION_ROUTES: string[] = [
  ROUTES.ads, // search icon
  ROUTES.favorites,
  ROUTES.notifications,
];

/**
 * Dev-time guard: every canonical user-facing section must be reachable on
 * mobile via a tab, a header icon, or the burger menu. Warns (does not throw)
 * so a forgotten route is caught in development without breaking the app.
 */
export function assertMobileNavCoverage(): void {
  if (typeof import.meta !== "undefined" && import.meta.env?.PROD) return;
  const covered = new Set<string>([
    ...PRIMARY_TAB_ROUTES,
    ...HEADER_ACTION_ROUTES,
    ...(MOBILE_MENU_SECTIONS.map((s) => s.to).filter(Boolean) as string[]),
  ]);
  const required: string[] = [
    ROUTES.feed,
    ROUTES.ads,
    ROUTES.adCreate,
    ROUTES.myAds,
    ROUTES.deals,
    ROUTES.favorites,
    ROUTES.reviews,
    ROUTES.channels,
    ROUTES.messenger,
    ROUTES.friends,
    ROUTES.profile,
    ROUTES.settings,
    ROUTES.wallet,
    ROUTES.subscription,
    ROUTES.notifications,
  ];
  const missing = required.filter((r) => !covered.has(r));
  if (missing.length) {
    console.warn("[nav] sections unreachable on mobile — add to MOBILE_MENU_SECTIONS:", missing);
  }
}
