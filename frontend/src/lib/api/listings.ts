import { apiRequest } from "./client";
import { getAuthToken } from "./auth";
import type { Listing, PostAuthor } from "@/lib/types";
import { avatarUrl } from "@/lib/utils/time";

type ApiListing = {
  uuid: string;
  title: string;
  slug: string;
  description: string;
  price_cents: number;
  status: string;
  delivery_methods?: string[];
  views_count?: number;
  published_at?: string | null;
  created_at: string;
  author?: { slug?: string | null; display_name?: string | null; avatar?: { url?: string | null } | null };
  category?: { name: string; slug: string } | null;
  subcategory?: { name: string } | null;
  city?: { name: string } | null;
};

function mapAuthor(a?: ApiListing["author"]): PostAuthor {
  const name = a?.display_name ?? "User";
  return {
    slug: a?.slug ?? "user",
    name,
    avatar: a?.avatar?.url ?? avatarUrl(name),
  };
}

export function mapApiListing(item: ApiListing): Listing {
  return {
    id: item.uuid,
    title: item.title,
    price: Math.round(item.price_cents / 100),
    category: item.category?.name ?? "",
    subcategory: item.subcategory?.name,
    city: item.city?.name ?? "",
    description: item.description,
    delivery: item.delivery_methods ?? [],
    status: item.status,
    author: mapAuthor(item.author),
    views: item.views_count,
    createdAt: item.published_at ?? item.created_at,
  };
}

export async function fetchListings(params?: {
  category_id?: number;
  city_id?: number;
  q?: string;
  per_page?: number;
}): Promise<Listing[]> {
  const search = new URLSearchParams();
  if (params?.category_id) search.set("category_id", String(params.category_id));
  if (params?.city_id) search.set("city_id", String(params.city_id));
  if (params?.q) search.set("q", params.q);
  if (params?.per_page) search.set("per_page", String(params.per_page));
  const qs = search.toString();
  const res = await apiRequest<{ data: ApiListing[] }>(qs ? `/listings?${qs}` : "/listings");
  return (res.data ?? []).map(mapApiListing);
}

export async function fetchListing(uuid: string): Promise<Listing | null> {
  try {
    const res = await apiRequest<{ data: ApiListing }>(`/listings/${uuid}`, { token: getAuthToken() });
    return mapApiListing(res.data);
  } catch {
    return null;
  }
}

export async function fetchMyListings(): Promise<Listing[]> {
  const token = getAuthToken();
  if (!token) return [];
  const res = await apiRequest<{ data: ApiListing[] }>("/users/me/listings", { token });
  return (res.data ?? []).map(mapApiListing);
}

export async function createListing(input: {
  title: string;
  description: string;
  category_id: number;
  subcategory_id?: number;
  price_cents?: number;
  city_id?: number;
  delivery_methods?: string[];
}): Promise<Listing> {
  const res = await apiRequest<{ data: ApiListing }>("/listings", {
    method: "POST",
    token: getAuthToken(),
    json: input,
  });
  return mapApiListing(res.data);
}
