import { api } from "./client";

export interface City {
  id: number;
  name: string;
  region?: string | null;
  slug?: string;
}

export async function searchCities(query?: string): Promise<City[]> {
  const res = await api<{ data: City[] }>("/cities", {
    query: { q: query || undefined },
    auth: false,
  });
  return res.data ?? [];
}
