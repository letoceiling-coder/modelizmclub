import { API_BASE_URL } from "./client";

export type OAuthProvider = "vk" | "yandex" | "max";

const LABELS: Record<OAuthProvider, string> = {
  vk: "VK",
  yandex: "Яндекс",
  max: "MAX",
};

export function oauthProviderLabel(provider: OAuthProvider): string {
  return LABELS[provider];
}

/** Backend OAuth redirect URL (use on `<a href>` so login works before React hydrates). */
export function oauthRedirectUrl(provider: OAuthProvider): string {
  return `${API_BASE_URL}/auth/oauth/${provider}/redirect`;
}

/** Full-page redirect to backend OAuth (Socialite stateless). */
export function startOAuthLogin(provider: OAuthProvider): void {
  window.location.assign(oauthRedirectUrl(provider));
}
