import type { Session } from "@/lib/session";
import { isPhoneVerificationRequired, isPhoneVerified, isStaffUser } from "@/lib/auth/verification";

/** The access ladder. Every gate asks for exactly one rung. */
export type Level = "guest" | "registered" | "verified" | "subscriber";

export const LEVEL_ORDER: readonly Level[] = ["guest", "registered", "verified", "subscriber"];

/** The one window that gets a user from `have` to the next rung. */
export type GateWindow = "auth" | "verify" | "paywall";

export function levelRank(level: Level): number {
  return LEVEL_ORDER.indexOf(level);
}

export function meets(have: Level, need: Level): boolean {
  return levelRank(have) >= levelRank(need);
}

/** Derive the viewer's rung from the ['session'] query — the only input. */
export function levelOf(session: Session | null | undefined): Level {
  if (!session || session.user.id === "guest") return "guest";
  const user = session.user;
  if (isStaffUser(user) || session.subscription.active) return "subscriber";
  if (session.phoneVerified || isPhoneVerified(user) || !isPhoneVerificationRequired(user)) return "verified";
  return "registered";
}

/**
 * Exactly one reason for refusal: the first rung the viewer is missing.
 * guest → auth, registered → verify, verified → paywall. Never two windows.
 */
export function firstFailingStep(have: Level, need: Level): GateWindow | null {
  if (meets(have, need)) return null;
  if (have === "guest") return "auth";
  if (have === "registered") return "verify";
  return "paywall";
}

/**
 * Bridge from the feed guest-access tiers (`guest | auth | subscription`,
 * configured at runtime in the admin) to a Level. `auth` maps to `verified`
 * because the old guard always demanded the SMS step right after login.
 */
export function levelFromAccessTier(tier: string | null | undefined): Level {
  switch (tier) {
    case "guest":
      return "guest";
    case "subscription":
      return "subscriber";
    default:
      return "verified";
  }
}
