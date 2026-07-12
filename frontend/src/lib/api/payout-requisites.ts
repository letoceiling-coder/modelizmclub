import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import {
  getPayoutRequisites as getLocalPayoutRequisites,
  setPayoutRequisites as setLocalPayoutRequisites,
  type PayoutRequisites,
} from "@/lib/settings-prefs";

/**
 * Payout requisites — where an admin sends a seller's money by hand.
 * Decision (2026-07-12): no ЮKassa Marketplace API / escrow integration for
 * launch. The backend stores the card number in one encrypted column and an
 * admin reads it to make a manual transfer. See backend-endpoints-needed.md
 * §"Реквизиты выплат" for the exact contract.
 *
 * GET only ever returns a masked value (never the full number back to the
 * client) — the raw number is write-only from the frontend's perspective.
 */
interface PayoutRequisitesApi {
  card_last4: string | null;
}

export async function fetchPayoutRequisites(): Promise<{ last4: string | null }> {
  if (isDemoMode()) {
    const local = getLocalPayoutRequisites();
    return { last4: local.cardNumber ? local.cardNumber.slice(-4) : null };
  }
  const res = await api<{ data: PayoutRequisitesApi }>("/account/payout-requisites");
  return { last4: res.data.card_last4 };
}

export async function savePayoutRequisites(cardNumber: string): Promise<void> {
  if (isDemoMode()) {
    setLocalPayoutRequisites({ cardNumber });
    return;
  }
  await api("/account/payout-requisites", {
    method: "PUT",
    json: { card_number: cardNumber },
  });
}
