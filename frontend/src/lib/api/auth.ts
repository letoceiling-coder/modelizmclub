import type { User } from "@/lib/mock";
import { api, setToken, getToken } from "./client";

export interface ApiProfile {
  display_name?: string | null;
  slug?: string | null;
  bio?: string | null;
  city?: { name?: string | null } | null;
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
    bio: u.profile?.bio ?? undefined,
    isAdmin: u.role === "admin",
  };
}

interface AuthResponse {
  data: ApiUser;
  meta?: { token?: string; token_type?: string };
}

export async function login(email: string, password: string): Promise<User> {
  const res = await api<AuthResponse>("/auth/login", {
    method: "POST",
    auth: false,
    json: { email, password },
  });
  if (res.meta?.token) setToken(res.meta.token);
  return mapApiUser(res.data);
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: User; token?: string; needsVerification: boolean }> {
  const res = await api<AuthResponse>("/auth/register", {
    method: "POST",
    auth: false,
    json: input,
  });
  if (res.meta?.token) setToken(res.meta.token);
  return {
    user: mapApiUser(res.data),
    token: res.meta?.token,
    needsVerification: !res.meta?.token,
  };
}

export async function verifyEmail(email: string, code: string): Promise<User> {
  const res = await api<AuthResponse>("/auth/verify-email", {
    method: "POST",
    auth: false,
    json: { email, code },
  });
  if (res.meta?.token) setToken(res.meta.token);
  return mapApiUser(res.data);
}

export async function forgotPassword(email: string): Promise<void> {
  await api("/auth/forgot-password", { method: "POST", auth: false, json: { email } });
}

export async function resetPassword(input: {
  email: string;
  token: string;
  password: string;
}): Promise<void> {
  await api("/auth/reset-password", { method: "POST", auth: false, json: input });
}

export async function fetchMe(): Promise<User | null> {
  if (!getToken()) return null;
  try {
    const res = await api<{ data: ApiUser }>("/auth/me");
    return mapApiUser(res.data);
  } catch {
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
