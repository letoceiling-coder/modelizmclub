import { invalidateReferral } from "@/lib/api/referral";
import { invalidateMySubscription } from "@/lib/subscription";

/** Refresh subscription, listing credits and wallet-bound UI after a payment. */
export function notifyBillingChanged(): void {
  invalidateMySubscription();
  invalidateReferral();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("modelizm:billing-changed"));
}
