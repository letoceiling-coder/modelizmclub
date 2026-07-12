import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";

export interface WalletBalance {
  balance: number;
  currency: string;
}

export interface WalletTransaction {
  id: string;
  type: "in" | "out";
  amount: number;
  title: string;
  date: string;
}

export async function fetchWalletBalance(): Promise<WalletBalance> {
  if (isDemoMode()) {
    const { mockWalletBalance } = await import("@/lib/mock");
    return { balance: mockWalletBalance, currency: "RUB" };
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
    }));
  }
  const res = await api<{ data: WalletTransaction[] }>("/wallet/transactions", {
    query: { per_page: perPage },
  });
  return res.data ?? [];
}
