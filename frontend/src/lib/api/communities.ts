import { apiRequest } from "./client";
import { getAuthToken } from "./auth";
import type { Community, Post } from "@/lib/types";
import { mapApiPost, type ApiPost } from "./feed";

export type ApiCommunity = {
  id: number;
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
    dbId: item.id,
    uuid: item.uuid,
    name: item.name,
    description: item.description ?? "",
    members: item.members_count,
    category: item.category?.name ?? "",
    joined: Boolean(item.is_member),
    isOfficial: item.is_official,
    avatarIcon: "Users",
  };
}

export async function fetchCommunities(params?: {
  q?: string;
  per_page?: number;
  official?: boolean;
}): Promise<Community[]> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.per_page) search.set("per_page", String(params.per_page));
  if (params?.official !== undefined) search.set("official", params.official ? "1" : "0");

  const token = getAuthToken();
  const qs = search.toString();

  try {
    const res = await apiRequest<PaginatedCommunities>(qs ? `/communities?${qs}` : "/communities", { token });
    return (res.data ?? []).map(mapApiCommunity);
  } catch {
    return [];
  }
}

export async function fetchCommunity(slug: string): Promise<Community | null> {
  try {
    const token = getAuthToken();
    const res = await apiRequest<{ data: ApiCommunity }>(`/communities/${encodeURIComponent(slug)}`, { token });
    return mapApiCommunity(res.data);
  } catch {
    return null;
  }
}

export async function fetchCommunityPosts(slug: string): Promise<Post[]> {
  try {
    const res = await apiRequest<{ data: ApiPost[] }>(`/communities/${encodeURIComponent(slug)}/posts`, {
      token: getAuthToken(),
    });
    return (res.data ?? []).map(mapApiPost);
  } catch {
    return [];
  }
}

export async function joinCommunity(slug: string): Promise<void> {
  await apiRequest(`/communities/${encodeURIComponent(slug)}/join`, {
    method: "POST",
    token: getAuthToken(),
  });
}

export async function leaveCommunity(slug: string): Promise<void> {
  await apiRequest(`/communities/${encodeURIComponent(slug)}/leave`, {
    method: "DELETE",
    token: getAuthToken(),
  });
}
