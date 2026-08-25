import { api, API_BASE_URL } from "./client";

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

export type MaxAuthStart = {
  session: string;
  bot_url: string;
  expires_in: number;
};

export type MaxAuthStatus = {
  status: "pending" | "awaiting_confirm" | "ready" | "consumed" | "denied" | "expired" | "conflict" | string;
  token?: string;
  message?: string;
};

export async function startMaxAuth(): Promise<MaxAuthStart> {
  const res = await api<{ data: MaxAuthStart }>("/auth/oauth/max/start", {
    method: "POST",
    auth: false,
  });
  return res.data;
}

export async function pollMaxAuth(session: string): Promise<MaxAuthStatus> {
  const res = await api<{ data: MaxAuthStatus }>("/auth/oauth/max/status", {
    method: "GET",
    auth: false,
    query: { session },
  });
  return res.data;
}

export async function startMaxLink(): Promise<MaxAuthStart> {
  const res = await api<{ data: MaxAuthStart }>("/auth/oauth/max/link", {
    method: "POST",
  });
  return res.data;
}

export async function unlinkMax(): Promise<string[]> {
  const res = await api<{ data: { oauth_providers: string[] } }>("/auth/oauth/max", {
    method: "DELETE",
  });
  return res.data.oauth_providers ?? [];
}
