import { me, users, userById, type User } from "./mock";

export const REFERRAL_MAX_BONUS = 10;
export const REFERRAL_BONUS_PER_INVITE = 1;

export interface InvitedFriend {
  userId: string;
  joinedAt: string;
}

// Mock: текущий пользователь уже пригласил двух
const initialInvited: InvitedFriend[] = [
  { userId: users[1]?.id ?? "u2", joinedAt: "12 июня 2026" },
  { userId: users[2]?.id ?? "u3", joinedAt: "3 июля 2026" },
];

let invitedStore: InvitedFriend[] = [...initialInvited];

export function getInvitedFriends(): InvitedFriend[] {
  return invitedStore;
}

export function getReferralCode(userId: string = me.id): string {
  return `MDLZM-${userId.toUpperCase().slice(0, 6)}`;
}

// Canonical public origin. Used on the server and during initial client
// render so SSR hydration matches; swap to window.location.origin only after
// mount (see InviteBlock).
export const PUBLIC_ORIGIN = "https://modelizm.club";

export function getReferralLink(userId: string = me.id): string {
  return `${PUBLIC_ORIGIN}/register?ref=${getReferralCode(userId)}`;
}

export function getReferralBonus(): number {
  return Math.min(invitedStore.length * REFERRAL_BONUS_PER_INVITE, REFERRAL_MAX_BONUS);
}

export function getInviterByCode(code?: string): User | null {
  if (!code) return null;
  const id = code.replace(/^MDLZM-/i, "").toLowerCase();
  const found = users.find((u) => u.id.toLowerCase().startsWith(id.toLowerCase()));
  return found ?? userById(users[0].id);
}
