import { fetchFeedGuestAccess, type FeedGuestAccessConfig, type GuestAccessActionConfig } from "@/lib/api/feed-guest-access";
import { buildDefaultFeedGuestAccessConfig, GUEST_ACCESS_DEFAULTS, GUEST_PUBLIC_ACTIONS } from "@/lib/feed-guest-access/registry";

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
        cached = config;
        return config;
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

function resolveAction(config: FeedGuestAccessConfig, actionKey: string): GuestAccessActionConfig {
  const fromConfig = config.actions[actionKey];
  if (fromConfig) return fromConfig;
  const defaultAllowed = GUEST_ACCESS_DEFAULTS[actionKey];
  if (defaultAllowed !== undefined) return { allowed: defaultAllowed, deny_mode: "inherit" };
  return { allowed: false, deny_mode: "inherit" };
}

function effectiveConfig(config?: FeedGuestAccessConfig | null): FeedGuestAccessConfig {
  return config ?? cached ?? buildDefaultFeedGuestAccessConfig();
}

export function isGuestActionAllowed(actionKey: string, _config?: FeedGuestAccessConfig | null): boolean {
  return GUEST_PUBLIC_ACTIONS.has(actionKey);
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
