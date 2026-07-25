import { useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";

/**
 * Site-wide feature flags. Production reads GET /public/feature-flags;
 * demo/admin override still uses localStorage via setFeatureFlag.
 */

export interface FeatureFlags {
  communitiesEnabled: boolean;
  reviewsEnabled: boolean;
  /** Off by default — traffic should go to listings, not an external
   *  marketplace link. Server-controlled via /admin, see FeatureFlagsController. */
  marketEnabled: boolean;
  /** Off by default — the «Безопасная сделка» (escrow) badge must only claim
   *  what actually works. Turn on from /admin once ЮKassa Безопасная сделка is
   *  wired on the backend. Server-controlled, see FeatureFlagsController. */
  escrowEnabled: boolean;
  /** On by default once billing is wired in the create-ad wizard. Server-controlled via /admin. */
  listingPaymentEnabled: boolean;
}

const DEFAULTS: FeatureFlags = {
  communitiesEnabled: false,
  reviewsEnabled: true,
  marketEnabled: false,
  escrowEnabled: false,
  listingPaymentEnabled: true,
};

const LS_KEY = "modelizm_feature_flags";
const EVENT = "modelizm:feature-flags-changed";

/** Flags controlled only via /admin/settings + GET /public/feature-flags. */
const SERVER_CONTROLLED: (keyof FeatureFlags)[] = [
  "communitiesEnabled",
  "marketEnabled",
  "escrowEnabled",
  "listingPaymentEnabled",
];

let serverFlags: Partial<FeatureFlags> | null = null;
let serverFetchStarted = false;

function readFromStorage(): FeatureFlags {
  if (typeof window === "undefined") return { ...DEFAULTS, ...serverFlags };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    const local = raw ? JSON.parse(raw) : {};
    // Drop stale local overrides for server-controlled flags.
    for (const key of SERVER_CONTROLLED) {
      delete local[key];
    }
    return { ...DEFAULTS, ...local, ...serverFlags };
  } catch {
    return { ...DEFAULTS, ...serverFlags };
  }
}

let cache: FeatureFlags = readFromStorage();

function notify() {
  cache = readFromStorage();
  window.dispatchEvent(new Event(EVENT));
}

export async function loadFeatureFlagsFromServer(): Promise<void> {
  if (isDemoMode() || typeof window === "undefined") return;
  try {
    const res = await api<{ data: { communities_enabled?: boolean; market_enabled?: boolean; escrow_enabled?: boolean; listing_payment_enabled?: boolean } }>("/public/feature-flags", {
      auth: false,
    });
    serverFlags = {
      communitiesEnabled: Boolean(res.data?.communities_enabled),
      marketEnabled: Boolean(res.data?.market_enabled),
      escrowEnabled: Boolean(res.data?.escrow_enabled),
      listingPaymentEnabled: Boolean(res.data?.listing_payment_enabled),
    };
    notify();
  } catch {
    // Keep defaults/localStorage on error.
  }
}

if (typeof window !== "undefined" && !serverFetchStarted) {
  serverFetchStarted = true;
  void loadFeatureFlagsFromServer();
}

/** Read a flag outside React (e.g. plain non-component modules). */
export function getFeatureFlags(): FeatureFlags {
  return typeof window === "undefined" ? { ...DEFAULTS, ...serverFlags } : cache;
}

/** Write a client-only flag (e.g. reviews preview in /admin). */
export function setFeatureFlag<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]): void {
  if (typeof window === "undefined") return;
  if (SERVER_CONTROLLED.includes(key)) return;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    const local: Partial<FeatureFlags> = raw ? JSON.parse(raw) : {};
    for (const k of SERVER_CONTROLLED) {
      delete local[k];
    }
    local[key] = value;
    window.localStorage.setItem(LS_KEY, JSON.stringify(local));
  } catch {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ [key]: value }));
  }
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
    () => (DEFAULTS[key]),
  );
}
