import type { User } from "@/lib/mock";
import { api, setToken, getToken, ApiError } from "./client";
import { isDemoMode } from "@/lib/demo-mode";

export interface ApiProfile {
  display_name?: string | null;
  slug?: string | null;
  bio?: string | null;
  city?: { name?: string | null } | null;
  city_id?: number | null;
  vk_url?: string | null;
  telegram_url?: string | null;
  website_url?: string | null;
  avatar?: { url?: string | null } | null;
  avatar_media_id?: number | null;
}

export interface ApiUser {
  id?: number;
  uuid: string;
  email?: string;
  name?: string | null;
  role?: string;
  status?: string;
  phone?: string | null;
  email_verified?: boolean;
  profile?: ApiProfile | null;
  interests?: Array<{ name?: string }> | null;
}

function avatarFallback(name: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=c8102e,1f2937,374151,6b7280`;
}

export function mapApiUser(u: ApiUser): User {
  const name = u.profile?.display_name || u.name || u.email || "Пользователь";
  const interests = (u.interests ?? [])
    .map((i) => i?.name)
    .filter((n): n is string => Boolean(n))
    .join(", ");
  return {
    id: u.uuid,
    numericId: u.id ?? undefined,
    slug: u.profile?.slug ?? undefined,
    name,
    city: u.profile?.city?.name ?? "",
    interests,
    avatar: u.profile?.avatar?.url ?? avatarFallback(name),
    email: u.email ?? undefined,
    bio: u.profile?.bio ?? undefined,
    isAdmin: u.role === "admin",
    phone: u.phone ?? undefined,
    profile: u.profile
      ? {
          vk_url: u.profile.vk_url ?? undefined,
          telegram_url: u.profile.telegram_url ?? undefined,
          website_url: u.profile.website_url ?? undefined,
        }
      : undefined,
    email_verified: u.email_verified,
  };
}

interface AuthResponse {
  data: ApiUser;
  meta?: { token?: string; token_type?: string };
}

// `remember` is client-only — the backend /auth/login contract has no such
// field (confirmed against docs/openapi/openapi.json LoginRequest). It only
// decides where the token is persisted: localStorage (survives browser
// restarts) vs sessionStorage (cleared when the tab/browser closes).
export async function login(email: string, password: string, remember = true): Promise<User> {
  const res = await api<AuthResponse>("/auth/login", {
    method: "POST",
    auth: false,
    json: { email, password },
  });
  if (res.meta?.token) setToken(res.meta.token, remember);
  return mapApiUser(res.data);
}

export type RegistrationTrack = "community" | "listing";

// Регистрация создаёт аккаунт со статусом «ожидает подтверждения» и отправляет
// 6-значный код на email. Токен выдаётся только после verify-email.
export async function register(input: {
  name?: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  track?: RegistrationTrack;
  referralCode?: string;
  phone?: string;
}): Promise<void> {
  await api("/auth/register", {
    method: "POST",
    auth: false,
    json: {
      display_name: input.name?.trim() || undefined,
      email: input.email,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
      registration_track: input.track ?? "community",
      referral_code: input.referralCode?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
    },
  });
}

export async function verifyEmail(
  email: string,
  code: string,
): Promise<{ user: User; token?: string }> {
  const res = await api<AuthResponse>("/auth/verify-email", {
    method: "POST",
    auth: false,
    json: { email, code },
  });
  if (res.meta?.token) setToken(res.meta.token);
  return { user: mapApiUser(res.data), token: res.meta?.token };
}

export async function forgotPassword(email: string): Promise<void> {
  await api("/auth/forgot-password", { method: "POST", auth: false, json: { email } });
}

export async function resetPassword(input: {
  email: string;
  token: string;
  password: string;
  passwordConfirmation: string;
}): Promise<void> {
  await api("/auth/reset-password", {
    method: "POST",
    auth: false,
    json: {
      email: input.email,
      token: input.token,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
    },
  });
}

export async function fetchMe(): Promise<User | null> {
  if (isDemoMode()) {
    const { DEMO_USER } = await import("@/lib/demo-data");
    return DEMO_USER;
  }
  if (!getToken()) return null;
  try {
    const res = await api<{ data: ApiUser }>("/auth/me");
    return mapApiUser(res.data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      setToken(null);
    }
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // ignore — token cleared locally regardless
  }
  setToken(null);
}

/**
 * Change password while staying logged in (authenticated, in-place — not the
 * email-reset flow). Throws ApiError(422) with `errors` on wrong current
 * password / weak new password. Backend endpoint documented in
 * docs/backend-endpoints-needed.md (POST /account/change-password).
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api("/account/change-password", {
    method: "POST",
    json: { current_password: currentPassword, new_password: newPassword },
  });
}

/**
 * Revoke every OTHER session/token, keeping the current one valid (so the
 * user is NOT logged out here). Backend endpoint documented in
 * docs/backend-endpoints-needed.md (POST /auth/logout-others).
 */
export async function logoutOtherDevices(): Promise<void> {
  await api("/auth/logout-others", { method: "POST" });
}
