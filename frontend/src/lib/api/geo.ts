import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";

export type AddressSuggestion = {
  label: string;
};

export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  if (isDemoMode()) {
    return [{ label: q }];
  }
  const res = await api<{ data: AddressSuggestion[] }>("/geo/address-suggest", {
    query: { q },
    auth: false,
  });
  return res.data ?? [];
}
