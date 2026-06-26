import { apiRequest } from "./client";
import { getAuthToken } from "./auth";
import type { Community } from "@/lib/mock";

export type ApiCommunity = {
  uuid: string;
  name: string;
  slug: string;
  description: string | null;
  is_official: boolean;
  members_count: number;
  posts_count: number;
  category?: { id: number; name: string; slug: string } | null;
  is_member?: boolean;
};

type PaginatedCommunities = {
  data: ApiCommunity[];
  meta?: { current_page: number; last_page: number; total: number };
};

export function mapApiCommunity(item: ApiCommunity): Community {
  return {
    id: item.slug,
    name: item.name,
    description: item.description ?? "",
    members: item.members_count,
    category: item.category?.name ?? "",
    joined: Boolean(item.is_member),
    avatarIcon: "Users",
  };
}

export async function fetchCommunities(params?: {
  q?: string;
  per_page?: number;
}): Promise<Community[]> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.per_page) search.set("per_page", String(params.per_page));
  const qs = search.toString();
  const path = qs ? `/communities?${qs}` : "/communities";

  const token = getAuthToken();
  const res = await apiRequest<PaginatedCommunities>(path, { token });
  return (res.data ?? []).map(mapApiCommunity);
}
