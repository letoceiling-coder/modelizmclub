import { api, ApiError } from "./client";
import { isDemoMode } from "@/lib/demo-mode";

export interface WalletBalance {
  balance: number; // rubles (rounded down, legacy)
  balance_kopecks: number;
  held_kopecks: number;
  currency: string;
}

export interface WalletTransaction {
  id: string;
  type: "in" | "out";
  amount: number; // rubles (for display)
  title: string;
  date: string;
  kind: string;
  service: string;
  status: "completed" | "pending" | "failed";
}

/** Raw ledger row as returned by GET /wallet/transactions. */
interface WalletTransactionApi {
  id: string;
  type: "in" | "out";
  amount: number; // kopecks
  amount_rub: number;
  balance_after: number;
  kind: string;
  service?: string;
  status?: string;
  title: string;
  date: string;
}

export type WithdrawMethod = "card" | "sbp" | "account";

/** Result of starting a top-up — VTB form in battle mode, stub page in test mode. */
export interface WalletTopupResult {
  payment_uuid: string;
  checkout_url: string;
  status: string; // "pending"
  provider: "vtb" | "stub";
}

export interface WithdrawalResult {
  uuid: string;
  amount_kopecks: number;
  status: string; // "pending"
}

function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `wal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function fetchWalletBalance(): Promise<WalletBalance> {
  if (isDemoMode()) {
    const { mockWalletBalance } = await import("@/lib/mock");
    return { balance: mockWalletBalance, balance_kopecks: mockWalletBalance * 100, held_kopecks: 0, currency: "RUB" };
  }
  return api<WalletBalance>("/wallet");
}

export async function fetchWalletTransactions(perPage = 50): Promise<WalletTransaction[]> {
  if (isDemoMode()) {
    const { mockWalletOperations } = await import("@/lib/mock");
    return mockWalletOperations.map((op) => ({
      id: op.id,
      type: op.type,
      amount: op.amount,
      title: op.title,
      date: op.date,
      kind: op.type === "in" ? "topup" : "listing_placement",
      service: op.title,
      status: "completed" as const,
    }));
  }
  const res = await api<{ data: WalletTransactionApi[] }>("/wallet/transactions", {
    query: { per_page: perPage },
  });
  return (res.data ?? []).map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount_rub,
    title: tx.title,
    date: tx.date,
    kind: tx.kind,
    service: tx.service ?? tx.title,
    status: tx.status === "pending" || tx.status === "failed" ? tx.status : "completed",
  }));
}

/**
 * Start a wallet top-up. Redirect the browser to `checkout_url`
 * (VTB hosted form, or `/pay/stub/{uuid}` in test mode).
 */
export async function topupWallet(amountRub: number): Promise<WalletTopupResult> {
  const res = await api<{ data: WalletTopupResult }>("/wallet/topup", {
    method: "POST",
    json: { amount: amountRub, idempotency_key: newIdempotencyKey() },
  });
  return res.data;
}

/**
 * Request a withdrawal from the wallet balance. Debits immediately and creates
 * a pending withdrawal request for an admin to process. Amount is in rubles.
 * Throws ApiError; on insufficient funds `payload.code === "insufficient_funds"`.
 */
export async function withdrawFromWallet(input: {
  amount: number;
  method: WithdrawMethod;
  destination: string;
}): Promise<WithdrawalResult> {
  const res = await api<{ data: WithdrawalResult }>("/wallet/withdraw", {
    method: "POST",
    json: input,
  });
  return res.data;
}

/** True when the failure is a "not enough balance" business error. */
export function isInsufficientFunds(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 422) return false;
  if ((error.payload as { code?: string } | undefined)?.code === "insufficient_funds") return true;
  const payWith = error.errors?.pay_with?.[0] ?? "";
  return /недостаточно средств|insufficient/i.test(payWith);
}
