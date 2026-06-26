import { apiRequest } from "./client";
import { getAuthToken } from "./auth";
import type { Category } from "@/lib/types";

type ApiCategoryNode = {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  children?: ApiCategoryNode[];
};

function flattenCategories(nodes: ApiCategoryNode[]): Category[] {
  return nodes.map((n) => ({
    id: String(n.id),
    slug: n.slug,
    name: n.name,
    icon: n.icon ?? undefined,
    subcategories: (n.children ?? []).map((c) => ({
      id: String(c.id),
      name: c.name,
      slug: c.slug,
    })),
  }));
}

export async function fetchPostCategories(): Promise<Category[]> {
  const res = await apiRequest<{ data: ApiCategoryNode[] }>("/categories/posts");
  return flattenCategories(res.data ?? []);
}

export async function fetchListingCategories(): Promise<Category[]> {
  const res = await apiRequest<{ data: ApiCategoryNode[] }>("/categories/listings");
  return flattenCategories(res.data ?? []);
}

export async function fetchCities(): Promise<{ id: number; name: string }[]> {
  const res = await apiRequest<{ data: { id: number; name: string }[] }>("/cities");
  return res.data ?? [];
}

export async function fetchUserProfile(slug: string) {
  const token = getAuthToken();
  const res = await apiRequest<{ data: Record<string, unknown> }>(`/users/${encodeURIComponent(slug)}`, { token });
  return res.data;
}

export async function updateMyProfile(data: { display_name?: string; bio?: string }) {
  const token = getAuthToken();
  return apiRequest("/users/me", { method: "PATCH", token, json: data });
}

export async function syncMyInterests(interestIds: number[]) {
  const token = getAuthToken();
  return apiRequest("/users/me/interests", { method: "PUT", token, json: { interest_ids: interestIds } });
}
