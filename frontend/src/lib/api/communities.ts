import type { Community } from "@/lib/mock";
import { api } from "./client";

interface ApiCommunity {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  description?: string | null;
  is_official?: boolean;
  members_count?: number;
  posts_count?: number;
  category?: { id?: number; name?: string; slug?: string } | null;
  avatar?: { uuid?: string; url?: string | null } | null;
  cover?: { uuid?: string; url?: string | null } | null;
  is_member?: boolean;
}

interface Paginated<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

export function mapCommunity(c: ApiCommunity): Community {
  return {
    id: c.slug,
    name: c.name,
    description: c.description ?? "",
    fullDescription: c.description ?? undefined,
    members: c.members_count ?? 0,
    category: c.category?.name ?? "",
    joined: c.is_member ?? false,
    coverImage: c.cover?.url ?? undefined,
    avatarImage: c.avatar?.url ?? undefined,
  };
}

export async function fetchCommunities(query?: string): Promise<Community[]> {
  const res = await api<Paginated<ApiCommunity>>("/communities", {
    query: { q: query || undefined, per_page: 50 },
  });
  return (res.data ?? []).map(mapCommunity);
}

export async function fetchCommunity(slug: string): Promise<Community> {
  const res = await api<{ data: ApiCommunity }>(`/communities/${slug}`);
  return mapCommunity(res.data);
}

export async function joinCommunity(slug: string): Promise<void> {
  await api(`/communities/${slug}/join`, { method: "POST" });
}

export async function leaveCommunity(slug: string): Promise<void> {
  await api(`/communities/${slug}/leave`, { method: "DELETE" });
}
