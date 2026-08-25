import { api } from "./client";

export interface CdekCity {
  code: number;
  city: string;
  region?: string | null;
}

export interface CdekPickupPoint {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  type?: string;
}

export async function searchCdekCities(city: string): Promise<CdekCity[]> {
  const q = city.trim();
  if (q.length < 2) return [];
  const res = await api<{ data: Array<Record<string, unknown>> }>("/delivery/cdek/cities", {
    query: { city: q, country_codes: "RU" },
  });
  return (res.data ?? [])
    .map((row) => ({
      code: Number(row.code ?? 0),
      city: String(row.city ?? row.city_name ?? ""),
      region: row.region != null ? String(row.region) : null,
    }))
    .filter((row) => row.code > 0 && row.city !== "");
}

export async function fetchCdekPickupPoints(cityCode: number): Promise<CdekPickupPoint[]> {
  const res = await api<{ data: CdekPickupPoint[] }>("/delivery/cdek/pickup-points", {
    query: { city_code: cityCode, type: "PVZ" },
  });
  return res.data ?? [];
}
