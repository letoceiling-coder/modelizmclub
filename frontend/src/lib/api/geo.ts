import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";

export type AddressSuggestion = {
  label: string;
};

const DEMO_ADDRESSES = [
  "Краснодар, улица Карла Маркса",
  "Краснодар, улица Карла Маркса, 12",
  "Краснодар, улица Красная",
  "Краснодар, улица Красная, 5",
  "Краснодар, улица Ставропольская",
  "Москва, улица Тверская",
  "Санкт-Петербург, Невский проспект",
];

export async function suggestAddresses(query: string, city?: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  if (isDemoMode()) {
    const parts = `${city ?? ""} ${q}`
      .toLowerCase()
      .split(/[,\s]+/)
      .filter((p) => p.length >= 2);
    return DEMO_ADDRESSES.filter((label) => {
      const low = label.toLowerCase();
      return parts.every((part) => low.includes(part));
    })
      .slice(0, 8)
      .map((label) => ({ label }));
  }
  const res = await api<{ data: AddressSuggestion[] }>("/geo/address-suggest", {
    query: { q, city: city?.trim() || undefined },
    auth: false,
  });
  return res.data ?? [];
}

export async function fetchRecentPickupAddresses(): Promise<string[]> {
  if (isDemoMode()) return [];
  try {
    const res = await api<{ data: string[] }>("/users/me/pickup-addresses");
    return (res.data ?? []).filter((x) => typeof x === "string" && x.trim().length >= 3);
  } catch {
    return [];
  }
}
