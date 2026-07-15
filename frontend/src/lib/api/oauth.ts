import { API_BASE_URL } from "./client";

export type OAuthProvider = "vk" | "yandex";

const LABELS: Record<OAuthProvider, string> = {
  vk: "VK",
  yandex: "Яндекс",
};

export function oauthProviderLabel(provider: OAuthProvider): string {
  return LABELS[provider];
}

/** Full-page redirect to backend OAuth (Socialite stateless). */
export function startOAuthLogin(provider: OAuthProvider): void {
  window.location.href = `${API_BASE_URL}/auth/oauth/${provider}/redirect`;
}
