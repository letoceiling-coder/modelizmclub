import { useCallback } from "react";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { resolveMinTier } from "@/lib/feed-guest-access/store";
import { levelFromAccessTier, type Level } from "./levels";
import { useGate, type GateAction, type RequireOptions } from "./useGate";

/**
 * `require` keyed by an admin-configured action ("messenger.send",
 * "feed.post.like", …). The required rung comes from the guest-access
 * config the admin edits; the gate turns it into exactly one window. Use
 * this instead of hard-coding a Level wherever an action key exists.
 */
export function useActionGate() {
  const { config } = useGuestAccess();
  const gate = useGate();

  const levelFor = useCallback(
    (actionKey: string): Level => levelFromAccessTier(resolveMinTier(actionKey, config)),
    [config],
  );

  const requireAction = useCallback(
    (actionKey: string, action: GateAction, options?: RequireOptions) =>
      gate.require(levelFor(actionKey), action, options),
    [gate, levelFor],
  );

  return { requireAction, levelFor, level: gate.level, can: gate.can };
}
