import { apiRequest, ApiError } from "./client";
import { getAuthToken, setAuthToken } from "./auth";

export type AuthUser = {
  uuid: string;
  email: string;
  name: string;
  role: string;
  status: string;
  locale?: string;
  email_verified_at?: string | null;
  profile?: {
    display_name: string | null;
    slug: string | null;
    bio?: string | null;
  };
};

type AuthEnvelope = {
  data: AuthUser;
  meta?: { token: string; token_type: string };
};

type MeEnvelope = {
  data: AuthUser;
};

export function hasAuthForApi(): boolean {
  return Boolean(getAuthToken());
}

export async function loginWithApi(email: string, password: string): Promise<AuthUser> {
  const res = await apiRequest<AuthEnvelope>("/auth/login", {
    method: "POST",
    json: { email, password },
  });
  if (res.meta?.token) setAuthToken(res.meta.token);
  return res.data;
}

export async function registerWithApi(input: {
  email: string;
  password: string;
  password_confirmation: string;
  display_name?: string;
  registration_track?: "community" | "listing";
}): Promise<void> {
  await apiRequest<{ data: { message: string } }>("/auth/register", {
    method: "POST",
    json: {
      registration_track: "community",
      ...input,
    },
  });
}

export async function verifyEmailWithApi(email: string, code: string): Promise<AuthUser> {
  const res = await apiRequest<AuthEnvelope>("/auth/verify-email", {
    method: "POST",
    json: { email, code },
  });
  if (res.meta?.token) setAuthToken(res.meta.token);
  return res.data;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await apiRequest<MeEnvelope>("/auth/me", { token });
    return res.data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      setAuthToken(null);
      return null;
    }
    throw e;
  }
}

export async function forgotPasswordWithApi(email: string): Promise<void> {
  await apiRequest("/auth/forgot-password", { method: "POST", json: { email } });
}

export async function logoutFromApi(): Promise<void> {
  const token = getAuthToken();
  if (token) {
    try {
      await apiRequest("/auth/logout", { method: "POST", token });
    } catch {
      /* ignore */
    }
  }
  setAuthToken(null);
}

export function authUserDisplayName(user: AuthUser): string {
  return user.profile?.display_name || user.name || user.email;
}

export function authUserSlug(user: AuthUser): string {
  return user.profile?.slug || user.uuid;
}
