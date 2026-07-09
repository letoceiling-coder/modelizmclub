import { useSyncExternalStore } from "react";

/**
 * Client-side feature flags, editable from /admin (SettingsSection).
 *
 * These are meant to eventually read the generic AdminSetting key
 * `feature.communities_enabled` (GET /admin/settings — the mechanism already
 * exists and is generic). They live in localStorage instead because that
 * endpoint requires admin auth (no `security: []` override in the OpenAPI
 * spec, tag "Admin — System") — anonymous/regular site visitors, who are the
 * audience this flag actually needs to affect, can't read it. There is no
 * public-readable settings/flags endpoint yet. See
 * backend-endpoints-needed.md #17 for the requested backend addition
 * (persistent, server-side storage + a public read endpoint).
 */

export interface FeatureFlags {
  communitiesEnabled: boolean;
  reviewsEnabled: boolean;
}

const DEFAULTS: FeatureFlags = {
  communitiesEnabled: false,
  reviewsEnabled: false,
};

const LS_KEY = "modelizm_feature_flags";
const EVENT = "modelizm:feature-flags-changed";

function readFromStorage(): FeatureFlags {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

let cache: FeatureFlags = readFromStorage();

function notify() {
  cache = readFromStorage();
  window.dispatchEvent(new Event(EVENT));
}

/** Read a flag outside React (e.g. plain non-component modules). */
export function getFeatureFlags(): FeatureFlags {
  return typeof window === "undefined" ? DEFAULTS : cache;
}

/** Write a flag (used by the /admin toggle). Persists to localStorage. */
export function setFeatureFlag<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]): void {
  if (typeof window === "undefined") return;
  const next = { ...readFromStorage(), [key]: value };
  window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  notify();
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** React hook — re-renders when the flag changes (same tab or another tab/admin). */
export function useFeatureFlag<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
  return useSyncExternalStore(
    subscribe,
    () => readFromStorage()[key],
    () => DEFAULTS[key],
  );
}
