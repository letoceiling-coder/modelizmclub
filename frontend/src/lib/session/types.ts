import type { User } from "@/lib/mock";

/** The one Query key that answers "who is signed in". */
export const SESSION_KEY = ["session"] as const;

export interface SessionSubscription {
  active: boolean;
  /** Plan slug ("year", …) or null on the free tier. */
  plan: string | null;
  endsAt: string | null;
}

export interface Session {
  user: User;
  phoneVerified: boolean;
  subscription: SessionSubscription;
}
