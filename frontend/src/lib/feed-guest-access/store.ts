import { fetchFeedGuestAccess, type AccessTier, type FeedGuestAccessConfig, type GuestAccessActionConfig } from "@/lib/api/feed-guest-access";
import {
  buildDefaultFeedGuestAccessConfig,
  GUEST_ACCESS_DEFAULT_TIERS,
  isTierAtLeast,
  normalizeActionConfig,
} from "@/lib/feed-guest-access/registry";

let cached: FeedGuestAccessConfig | null = null;
let loadPromise: Promise<FeedGuestAccessConfig> | null = null;

const EVENT = "modelizm:feed-guest-access-changed";

export function invalidateFeedGuestAccessCache(): void {
  cached = null;
  loadPromise = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

export async function loadFeedGuestAccess(force = false): Promise<FeedGuestAccessConfig> {
  if (force) invalidateFeedGuestAccessCache();
  if (cached) return cached;
  if (!loadPromise) {
    loadPromise = fetchFeedGuestAccess()
      .then((config) => {
        cached = hydrateConfig(config);
        return cached;
      })
      .catch(() => {
        loadPromise = null;
        const fallback = buildDefaultFeedGuestAccessConfig();
        cached = fallback;
        return fallback;
      });
  }
  return loadPromise;
}

export function getFeedGuestAccessSync(): FeedGuestAccessConfig | null {
  return cached;
}

function hydrateConfig(config: FeedGuestAccessConfig): FeedGuestAccessConfig {
  const actions: FeedGuestAccessConfig["actions"] = {};
  for (const [key, fallback] of Object.entries(GUEST_ACCESS_DEFAULT_TIERS)) {
    actions[key] = normalizeActionConfig(config.actions?.[key], fallback);
  }
  for (const [key, patch] of Object.entries(config.actions ?? {})) {
    if (!actions[key]) actions[key] = normalizeActionConfig(patch, "auth");
  }
  return { ...config, version: 2, actions };
}

function resolveAction(config: FeedGuestAccessConfig, actionKey: string): GuestAccessActionConfig {
  const fromConfig = config.actions[actionKey];
  if (fromConfig) return normalizeActionConfig(fromConfig, GUEST_ACCESS_DEFAULT_TIERS[actionKey] ?? "auth");
  const fallback = GUEST_ACCESS_DEFAULT_TIERS[actionKey] ?? "auth";
  return normalizeActionConfig(undefined, fallback);
}

function effectiveConfig(config?: FeedGuestAccessConfig | null): FeedGuestAccessConfig {
  return config ?? cached ?? buildDefaultFeedGuestAccessConfig();
}

export function resolveMinTier(actionKey: string, config?: FeedGuestAccessConfig | null): AccessTier {
  return resolveAction(effectiveConfig(config), actionKey).min_tier;
}

export function isGuestActionAllowed(actionKey: string, config?: FeedGuestAccessConfig | null): boolean {
  return resolveMinTier(actionKey, config) === "guest";
}

export function isActionAllowedForTier(
  actionKey: string,
  userTier: AccessTier,
  config?: FeedGuestAccessConfig | null,
): boolean {
  return isTierAtLeast(userTier, resolveMinTier(actionKey, config));
}

export function resolveDenyMode(actionKey: string, config?: FeedGuestAccessConfig | null): "popup" | "redirect" {
  const cfg = effectiveConfig(config);
  const action = resolveAction(cfg, actionKey);
  if (action.deny_mode === "popup" || action.deny_mode === "redirect") return action.deny_mode;
  return cfg.default_deny_mode;
}

export function subscribeFeedGuestAccess(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
