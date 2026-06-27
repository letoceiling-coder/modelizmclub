import type { User } from "@/lib/mock";
import { formatRelativeTime } from "@/lib/mock";
import { api, ApiError } from "./client";

interface ApiUser {
  uuid: string;
  email: string;
  name: string | null;
  role?: string;
  status?: string;
  profile?: {
    display_name?: string | null;
    slug?: string | null;
    bio?: string | null;
  } | null;
  created_at?: string;
}

interface AuthResponse {
  data: ApiUser;
  meta?: { token?: string; token_type?: string };
}

const avatarFallback = (name: string): string =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

export function mapApiUser(u: ApiUser): User {
  const name = u.profile?.display_name || u.name || u.email.split("@")[0] || "Пользователь";
  return {
    id: u.uuid,
    name,
    city: "",
    interests: "",
    avatar: avatarFallback(name),
    bio: u.profile?.bio ?? undefined,
    joinedDate: u.created_at,
    online: true,
    friendIds: [],
  };
}

export function authErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Не удалось выполнить запрос";
  const body = err.body as { errors?: Record<string, string[]>; message?: string } | undefined;
  if (body?.errors) {
    const first = Object.values(body.errors).flat()[0];
    if (first) return first;
  }
  return err.message;
}

export async function login(email: string, password: string): Promise<{ user: User; token: string }> {
  const res = await api<AuthResponse>("/auth/login", {
    method: "POST",
    json: { email, password },
    auth: false,
  });
  const token = res.meta?.token;
  if (!token) throw new Error("Токен не получен");
  return { user: mapApiUser(res.data), token };
}

export async function register(input: {
  email: string;
  password: string;
  displayName?: string;
  track?: "community" | "listing";
}): Promise<void> {
  await api("/auth/register", {
    method: "POST",
    json: {
      email: input.email,
      password: input.password,
      password_confirmation: input.password,
      display_name: input.displayName,
      registration_track: input.track ?? "community",
    },
    auth: false,
  });
}

export async function verifyEmail(email: string, code: string): Promise<{ user: User; token: string }> {
  const res = await api<AuthResponse>("/auth/verify-email", {
    method: "POST",
    json: { email, code },
    auth: false,
  });
  const token = res.meta?.token;
  if (!token) throw new Error("Токен не получен");
  return { user: mapApiUser(res.data), token };
}

export async function fetchMe(): Promise<User | null> {
  try {
    const res = await api<{ data: ApiUser }>("/auth/me");
    return mapApiUser(res.data);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export async function forgotPassword(email: string): Promise<void> {
  await api("/auth/forgot-password", {
    method: "POST",
    json: { email },
    auth: false,
  });
}

export async function logout(): Promise<void> {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // ignore — token cleared locally anyway
  }
}

export { formatRelativeTime };
