import { useQuery } from "@tanstack/react-query";
import type { User } from "@/lib/mock";
import { sessionQueryOptions } from "./options";
import { GUEST_USER } from "./guest";

/** The signed-in session, or `data: null` for a guest. One key, one fetch. */
export function useSession() {
  return useQuery(sessionQueryOptions);
}

/** The signed-in user, or GUEST_USER while unknown / signed out. */
export function useCurrentUser(): User {
  return useSession().data?.user ?? GUEST_USER;
}

/**
 * True once the boot-time probe has settled (success *or* error). UI that
 * depends on real account flags (verification banner, route guards) waits
 * for this so a guest placeholder is never mistaken for an unverified account.
 */
export function useSessionResolved(): boolean {
  return !useSession().isPending;
}
