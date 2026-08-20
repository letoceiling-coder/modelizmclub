import { redirect } from "@tanstack/react-router";
import type { User } from "@/lib/mock";
import { requireAuth } from "@/lib/auth/requireAuth";
import { fetchMe } from "@/lib/api/auth";
import { setCurrentUser } from "@/lib/store";
import { isDemoMode } from "@/lib/demo-mode";
import { isAuthenticated } from "@/lib/auth/session";

export function isVkOAuthUser(user: User | null | undefined): boolean {
  return user?.oauth_providers?.includes("vk") ?? false;
}

export function isYandexOAuthUser(user: User | null | undefined): boolean {
  return user?.oauth_providers?.includes("yandex") ?? false;
}

/** Hide synthetic OAuth placeholder emails from UI. */
export function displayEmail(user: User | null | undefined): string | undefined {
  const email = user?.email?.trim();
  if (!email || email.endsWith("@oauth.modelizmclub.local")) return undefined;
  return email;
}

export function isEmailVerified(user: User | null | undefined): boolean {
  if (isDemoMode()) return true;
  if (isVkOAuthUser(user)) return true;
  return user?.email_verified === true;
}

export function isPhoneVerified(user: User | null | undefined): boolean {
  return user?.phone_verified === true;
}

export function isAdminUser(user: User | null | undefined): boolean {
  return user?.role === "admin" || user?.isAdmin === true;
}

/** Admin panel staff — skip email/SMS verification gates on site and in admin UI. */
export function isStaffUser(user: User | null | undefined): boolean {
  return isAdminUser(user) || user?.role === "moderator";
}

/** Admins and moderators skip SMS phone verification for site actions (publish, chat, etc.). */
export function isPhoneVerificationRequired(user: User | null | undefined): boolean {
  return !isStaffUser(user);
}

export function isFullyVerified(user: User | null | undefined): boolean {
  if (isDemoMode()) return true;
  if (isStaffUser(user)) return true;
  const phoneOk = isPhoneVerified(user) || !isPhoneVerificationRequired(user);
  return isEmailVerified(user) && phoneOk;
}

export function verificationMessage(user: User | null | undefined): string {
  const missingEmail = !isEmailVerified(user);
  const missingPhone = isPhoneVerificationRequired(user) && !isPhoneVerified(user);
  if (missingEmail && missingPhone) {
    return "Подтвердите email и номер телефона в настройках аккаунта, чтобы выполнять действия на сайте.";
  }
  if (missingEmail) {
    return "Подтвердите email в настройках аккаунта, чтобы выполнять действия на сайте.";
  }
  if (missingPhone) {
    return "Подтвердите номер телефона, чтобы получить доступ к этой функции";
  }
  return "";
}

/** Block an action unless email and phone are verified on the server. */
export async function requireVerifiedForAction(navigate: (opts: { to: string; search?: Record<string, string> }) => void): Promise<boolean> {
  if (isDemoMode()) return true;
  if (!isAuthenticated()) return false;

  const user = await fetchMe();
  if (user) setCurrentUser(user);

  if (!isFullyVerified(user)) {
    const from = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/feed";
    navigate({ to: "/settings/account", search: { redirect: from } });
    return false;
  }
  return true;
}

/**
 * Route guard: requires login + verified email and phone.
 * Unverified users are redirected to account settings.
 */
export async function requireVerified(location?: {
  pathname: string;
  search?: string | Record<string, unknown>;
}): Promise<void> {
  if (typeof window === "undefined") return;
  if (isDemoMode()) return;
  if (!isAuthenticated()) return;

  await requireAuth(location);

  let user = await fetchMe();
  if (user) setCurrentUser(user);

  if (!isFullyVerified(user)) {
    const pathname = location?.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "/feed");
    const extra =
      typeof location?.search === "string"
        ? location.search
        : typeof window !== "undefined"
          ? window.location.search
          : "";
    throw redirect({
      to: "/settings/account",
      search: { redirect: pathname + extra },
    });
  }
}
