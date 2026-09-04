const KEY = "modelizm-cookie-key";

export function getAnonymousCookieKey(): string {
  if (typeof window === "undefined") return "";
  let key = localStorage.getItem(KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(KEY, key);
  }
  return key;
}

export interface StoredCookiePrefs {
  necessary: true;
  analytics: boolean;
  ads: boolean;
  savedAt: string;
}

const PREFS_KEY = "modelizm-cookie-prefs";

export function readCookiePrefs(): StoredCookiePrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCookiePrefs;
  } catch {
    return null;
  }
}

export function writeCookiePrefs(
  prefs: Omit<StoredCookiePrefs, "necessary"> & { necessary?: true },
): void {
  const payload: StoredCookiePrefs = {
    necessary: true,
    analytics: prefs.analytics,
    ads: prefs.ads,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(PREFS_KEY, JSON.stringify(payload));
}

export function hasCookieChoice(): boolean {
  return readCookiePrefs() !== null;
}

/** Placeholder hooks for future analytics/ad scripts — gated by consent. */
export function loadAnalyticsIfConsented(): void {
  const prefs = readCookiePrefs();
  if (!prefs?.analytics) return;
  // Yandex Metrika / GA would be injected here when configured.
}

export function loadAdsIfConsented(): void {
  const prefs = readCookiePrefs();
  if (!prefs?.ads) return;
}
