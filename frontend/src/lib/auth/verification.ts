import { redirect } from "@tanstack/react-router";
import type { User } from "@/lib/mock";
import { ensureSession } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/requireAuth";
import { fetchMe } from "@/lib/api/auth";
import { setCurrentUser } from "@/lib/store";
import { isDemoMode } from "@/lib/demo-mode";
import { toast } from "@/lib/toast";
import { isAuthenticated } from "@/lib/auth/session";

export function isEmailVerified(user: User | null | undefined): boolean {
  return user?.email_verified === true;
}

export function isPhoneVerified(user: User | null | undefined): boolean {
  return user?.phone_verified === true;
}

export function isFullyVerified(user: User | null | undefined): boolean {
  if (isDemoMode()) return true;
  return isEmailVerified(user) && isPhoneVerified(user);
}

export function verificationMessage(user: User | null | undefined): string {
  const missingEmail = !isEmailVerified(user);
  const missingPhone = !isPhoneVerified(user);
  if (missingEmail && missingPhone) {
    return "Подтвердите email и номер телефона в настройках аккаунта, чтобы выполнять действия на сайте.";
  }
  if (missingEmail) {
    return "Подтвердите email в настройках аккаунта, чтобы выполнять действия на сайте.";
  }
  if (missingPhone) {
    return "Подтвердите номер телефона по SMS в настройках аккаунта, чтобы выполнять действия на сайте.";
  }
  return "";
}

/** Block an action (toast + redirect) unless email and phone are verified on the server. */
export async function requireVerifiedForAction(navigate: (opts: { to: string }) => void): Promise<boolean> {
  if (isDemoMode()) return true;
  if (!isAuthenticated()) return false;

  const user = await fetchMe();
  if (user) setCurrentUser(user);

  if (!isFullyVerified(user)) {
    toast.error(verificationMessage(user));
    navigate({ to: "/settings/account" });
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
    throw redirect({ to: "/settings/account" });
  }
}
