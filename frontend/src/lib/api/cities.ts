import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { demoCities } from "@/lib/demo-data";

export interface City {
  id: number;
  name: string;
  region?: string | null;
  slug?: string;
}

export async function searchCities(query?: string): Promise<City[]> {
  if (isDemoMode()) return demoCities(query);
  const res = await api<{ data: City[] }>("/cities", {
    query: { q: query || undefined },
    auth: false,
  });
  return res.data ?? [];
}
