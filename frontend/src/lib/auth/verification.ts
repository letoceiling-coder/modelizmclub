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

export function isMaxOAuthUser(user: User | null | undefined): boolean {
  return user?.oauth_providers?.includes("max") ?? false;
}

/** MAX can be unlinked only if another login method exists. */
export function canUnlinkMax(user: User | null | undefined): boolean {
  if (!isMaxOAuthUser(user)) return false;
  if (isVkOAuthUser(user) || isYandexOAuthUser(user)) return true;
  return Boolean(displayEmail(user));
}

/** Hide synthetic OAuth placeholder emails from UI. */
export function displayEmail(user: User | null | undefined): string | undefined {
  const email = user?.email?.trim();
  if (!email || email.endsWith("@oauth.modelizmclub.local")) return undefined;
  return email;
}

export function isEmailVerified(user: User | null | undefined): boolean {
  if (isDemoMode()) return true;
  if (isVkOAuthUser(user) || isMaxOAuthUser(user)) return true;
  return user?.email_verified === true;
}

export function isPhoneVerified(user: User | null | undefined): boolean {
  return user?.phone_verified === true;
}

/** Placeholder store user before login — not an account, so no SMS/email gates. */
export function isAnonymousUser(user: User | null | undefined): boolean {
  return !user || user.id === "guest";
}

export function isAdminUser(user: User | null | undefined): boolean {
  return user?.role === "admin" || user?.isAdmin === true;
}

/** Admin panel staff — skip email/SMS verification gates on site and in admin UI. */
export function isStaffUser(user: User | null | undefined): boolean {
  return isAdminUser(user) || user?.role === "moderator";
}

/** Admins and moderators skip SMS. Guests are not accounts — login comes first. */
export function isPhoneVerificationRequired(user: User | null | undefined): boolean {
  if (isAnonymousUser(user)) return false;
  return !isStaffUser(user);
}

export function isFullyVerified(user: User | null | undefined): boolean {
  if (isDemoMode()) return true;
  if (isStaffUser(user)) return true;
  const phoneOk = isPhoneVerified(user) || !isPhoneVerificationRequired(user);
  return isEmailVerified(user) && phoneOk;
}

export function verificationMessage(user: User | null | undefined): string {
  if (isAnonymousUser(user)) return "";
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
export async function requireVerifiedForAction(
  navigate: (opts: { to: string; search?: Record<string, string> }) => void,
): Promise<boolean> {
  if (isDemoMode()) return true;
  const from =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/feed";
  if (!isAuthenticated()) {
    navigate({ to: "/login", search: { redirect: from } });
    return false;
  }

  const user = await fetchMe();
  if (user) setCurrentUser(user);

  if (isAnonymousUser(user) || !isAuthenticated()) {
    navigate({ to: "/login", search: { redirect: from } });
    return false;
  }

  if (isPhoneVerificationRequired(user) && !isPhoneVerified(user)) {
    requestPhoneVerificationModal();
    return false;
  }

  if (!isFullyVerified(user)) {
    navigate({ to: "/settings/account", search: { redirect: from } });
    return false;
  }
  return true;
}

/** Ask the root access provider to show the standard SMS modal. */
export function requestPhoneVerificationModal(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("modelizm:access-gate", { detail: { code: "phone_not_verified" } }),
  );
}

/**
 * Route guard: login + SMS. Missing phone shows the standard modal and
 * returns to the feed — never a silent jump to settings.
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

  if (isAnonymousUser(user)) {
    throw redirect({
      to: "/login",
      search: { redirect: location?.pathname ?? "/feed" },
    });
  }

  if (isPhoneVerificationRequired(user) && !isPhoneVerified(user)) {
    requestPhoneVerificationModal();
    throw redirect({ to: "/feed", replace: true });
  }

  if (!isFullyVerified(user)) {
    const pathname =
      location?.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "/feed");
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
