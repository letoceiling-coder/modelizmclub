import type { User } from "@/lib/mock";
import { GUEST_USER } from "./guest";
import { getSessionQueryClient } from "./queryClient";
import { SESSION_KEY, type Session } from "./types";

// Synchronous readers/writers over the ['session'] cache for code that runs
// outside React (route guards, the store reducer, event handlers). Components
// use the hooks in ./useSession instead. This module must never import the
// store — the store imports it.

export function getSession(): Session | null {
  return getSessionQueryClient()?.getQueryData<Session | null>(SESSION_KEY) ?? null;
}

export function getSessionUser(): User {
  return getSession()?.user ?? GUEST_USER;
}

export function getSessionUserId(): string {
  return getSessionUser().id;
}

export function setSession(data: Session | null): void {
  getSessionQueryClient()?.setQueryData<Session | null>(SESSION_KEY, data);
}

/**
 * Replace the user inside the cached session, keeping the subscription.
 * Before the first fetch there is nothing to patch into, so a bare user
 * becomes a session with an empty subscription — the next fetch fills it.
 */
export function setSessionUser(user: User): void {
  const qc = getSessionQueryClient();
  if (!qc) return;
  qc.setQueryData<Session | null>(SESSION_KEY, (prev) => ({
    user,
    phoneVerified: user.phone_verified === true,
    subscription: prev?.subscription ?? { active: false, plan: null, endsAt: null },
  }));
}
