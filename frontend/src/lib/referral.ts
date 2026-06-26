export const REFERRAL_MAX_BONUS = 10;
export const REFERRAL_BONUS_PER_INVITE = 1;

export interface InvitedFriend {
  userId: string;
  joinedAt: string;
}

export function getInvitedFriends(): InvitedFriend[] {
  return [];
}

export function getReferralCode(userId = "user"): string {
  return `MDLZM-${userId.toUpperCase().slice(0, 6)}`;
}

export const PUBLIC_ORIGIN = "https://modelizm.club";

export function getReferralLink(userId = "user"): string {
  return `${PUBLIC_ORIGIN}/register?ref=${getReferralCode(userId)}`;
}

export function getReferralBonus(): number {
  return 0;
}

export interface InviterPreview {
  name: string;
  avatar?: string | null;
}

export function getInviterByCode(_code?: string): InviterPreview | null {
  return null;
}
