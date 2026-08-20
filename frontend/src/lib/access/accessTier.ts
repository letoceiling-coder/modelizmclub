import type { User } from "@/lib/mock";
import {
  isEmailVerified,
  isFullyVerified,
  isPhoneVerified,
  isPhoneVerificationRequired,
  isStaffUser,
} from "@/lib/auth/verification";

/** Unified access ladder: Guest → Registered → Verified → Subscriber. */
export type AccessTier = "guest" | "registered" | "verified" | "subscriber";

export type AccessCapability =
  | "browseListings"
  | "browseFeed"
  | "viewReviews"
  | "createContent"
  | "paidListing";

const CAPABILITIES: Record<AccessCapability, AccessTier[]> = {
  browseListings: ["guest", "registered", "verified", "subscriber"],
  browseFeed: ["guest", "registered", "verified", "subscriber"],
  viewReviews: ["registered", "verified", "subscriber"],
  createContent: ["verified", "subscriber"],
  paidListing: ["verified", "subscriber"],
};

export function resolveAccessTier(input: {
  hasToken: boolean;
  user: User | null | undefined;
  subscriptionActive?: boolean;
}): AccessTier {
  if (!input.hasToken || !input.user || input.user.id === "guest") {
    return "guest";
  }
  if (input.subscriptionActive || isStaffUser(input.user)) {
    return "subscriber";
  }
  if (isFullyVerified(input.user)) {
    return "verified";
  }
  return "registered";
}

export function tierMeetsCapability(tier: AccessTier, capability: AccessCapability): boolean {
  return CAPABILITIES[capability].includes(tier);
}

export function canViewReviews(tier: AccessTier): boolean {
  return tierMeetsCapability(tier, "viewReviews");
}

export function canCreateContent(tier: AccessTier): boolean {
  return tierMeetsCapability(tier, "createContent");
}

export function accessTierLabel(tier: AccessTier): string {
  switch (tier) {
    case "guest":
      return "Гость";
    case "registered":
      return "Зарегистрирован";
    case "verified":
      return "Подтверждён";
    case "subscriber":
      return "Подписчик";
  }
}

export function verificationSummary(user: User | null | undefined): {
  emailOk: boolean;
  phoneOk: boolean;
  phoneRequired: boolean;
} {
  const phoneRequired = isPhoneVerificationRequired(user);
  return {
    emailOk: isEmailVerified(user),
    phoneOk: isPhoneVerified(user) || !phoneRequired,
    phoneRequired,
  };
}
