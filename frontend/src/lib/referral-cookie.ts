import { trackReferralClick } from "@/lib/api/referral";

const COOKIE = "mdlzm_ref";
const STORAGE = "mdlzm_ref";
const TRACKED = "mdlzm_ref_tracked";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function rememberReferralCode(raw: string | undefined | null): void {
  const code = String(raw ?? "").trim();
  if (!isBrowser() || code.length < 4 || code.length > 40) return;

  try {
    window.localStorage.setItem(STORAGE, code);
  } catch {
    /* ignore */
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${encodeURIComponent(code)}; Max-Age=${MAX_AGE_SEC}; Path=/; SameSite=Lax${secure}`;
}

export function peekStoredReferralCode(): string | undefined {
  if (!isBrowser()) return undefined;
  try {
    const fromStorage = window.localStorage.getItem(STORAGE)?.trim();
    if (fromStorage) return fromStorage;
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  const fromCookie = match ? decodeURIComponent(match[1]).trim() : "";
  return fromCookie || undefined;
}

export function consumeStoredReferralCode(): string | undefined {
  const code = peekStoredReferralCode();
  if (!isBrowser() || !code) return code;
  try {
    window.localStorage.removeItem(STORAGE);
  } catch {
    /* ignore */
  }
  document.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  return code;
}

/** Persist `?ref=` from the current URL (any page) and count the click once per tab. */
export function captureReferralFromLocation(href?: string): void {
  if (!isBrowser()) return;
  try {
    const url = new URL(href ?? window.location.href);
    const ref = url.searchParams.get("ref");
    if (ref) void rememberReferralCodeAndTrack(ref);
  } catch {
    /* ignore */
  }
}

export async function rememberReferralCodeAndTrack(raw: string | undefined | null): Promise<void> {
  const code = String(raw ?? "").trim();
  rememberReferralCode(code);
  if (!isBrowser() || code.length < 4) return;
  try {
    if (window.sessionStorage.getItem(TRACKED) === code) return;
    window.sessionStorage.setItem(TRACKED, code);
  } catch {
    /* still try to track */
  }
  await trackReferralClick(code);
}
