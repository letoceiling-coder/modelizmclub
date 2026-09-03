import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { AuthDialog } from "./AuthDialog";
import { PaywallDialog } from "./PaywallDialog";
import { VerifyPhoneDialog } from "./VerifyPhoneDialog";
import { closeGate, setPendingAction, useGateState } from "./gateStore";
import { clearIntent, readIntent } from "./intent";
import { levelOf, meets } from "./levels";
import { resumeIntent } from "./resume";

/**
 * Mounted once in the root. Renders whichever single window the gate store
 * asks for, and resumes the stored intent after a success — or on mount,
 * when the user comes back from /register or an OAuth round-trip already
 * meeting the level they were missing.
 */
export function GateHost() {
  const { open, returnTo } = useGateState();
  const navigate = useNavigate();
  const session = useSession();
  const bootChecked = useRef(false);

  const go = (to: string) => void navigate({ to: to as "/feed" });

  useEffect(() => {
    if (bootChecked.current || session.isPending) return;
    bootChecked.current = true;
    const stored = readIntent();
    if (!stored) return;
    if (stored.level && meets(levelOf(session.data), stored.level)) {
      void resumeIntent(go);
    } else if (!stored.level) {
      clearIntent();
    }
    // A stored intent whose level is still unmet stays put: the user opens
    // the gate again by retrying the action; nothing pops up unasked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isPending]);

  const dismiss = (next: boolean) => {
    if (next) return;
    closeGate();
    setPendingAction(null);
  };

  return (
    <>
      <AuthDialog open={open === "auth"} returnTo={returnTo} onOpenChange={dismiss} onSuccess={() => void resumeIntent(go)} />
      <VerifyPhoneDialog open={open === "verify"} onOpenChange={dismiss} onSuccess={() => void resumeIntent(go)} />
      <PaywallDialog open={open === "paywall"} returnTo={returnTo} onOpenChange={dismiss} />
    </>
  );
}
