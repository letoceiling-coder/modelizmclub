import type { User } from "./mock";

export const REFERRAL_MAX_BONUS = 10;
export const REFERRAL_BONUS_PER_INVITE = 1;

export interface InvitedFriend {
  userId: string;
  joinedAt: string;
}

// Реферальная программа ещё не реализована на бэкенде — без моковых данных
// показываем пустое состояние, пока не появится соответствующий API.
export function getInvitedFriends(): InvitedFriend[] {
  return [];
}

export function getReferralCode(userId: string): string {
  if (!userId || userId === "guest") return "";
  return `MDLZM-${userId.toUpperCase().slice(0, 6)}`;
}

// Canonical public origin. Used on the server and during initial client
// render so SSR hydration matches; swap to window.location.origin only after
// mount (see InviteBlock).
export function publicOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://modelizmclub.ru";
}

/** Fallback origin for SSR. Prefer `publicOrigin()` at call time. */
export const PUBLIC_ORIGIN = "https://modelizmclub.ru";

export function getReferralLink(userId: string): string {
  const code = getReferralCode(userId);
  const origin = publicOrigin();
  return code ? `${origin}/register?ref=${code}` : origin;
}

export function getReferralBonus(): number {
  return 0;
}

// Резолв пригласившего по коду требует API — пока возвращаем null.
export function getInviterByCode(_code?: string): User | null {
  return null;
}
