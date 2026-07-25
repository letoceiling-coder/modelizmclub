import type { Community } from "@/lib/mock";
import { api, getToken } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { demoCommunities, demoCommunity, setDemoCommunitySubscription } from "@/lib/demo-data";
import { useCallback, useEffect, useState } from "react";

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
  is_owner?: boolean;
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
    isOwner: Boolean(c.is_owner),
  };
}

export async function fetchCommunities(query?: string): Promise<Community[]> {
  if (isDemoMode()) return demoCommunities(query);
  const res = await api<Paginated<ApiCommunity>>("/communities", {
    query: { q: query || undefined, per_page: 50 },
  });
  return (res.data ?? []).map(mapCommunity);
}

export async function fetchCommunity(slug: string): Promise<Community> {
  if (isDemoMode()) {
    const c = demoCommunity(slug);
    if (c) return c;
    throw new Error("Community not found");
  }
  const res = await api<{ data: ApiCommunity }>(`/communities/${slug}`);
  return mapCommunity(res.data);
}

export async function joinCommunity(slug: string): Promise<void> {
  if (isDemoMode()) {
    setDemoCommunitySubscription(slug, true);
    return;
  }
  await api(`/communities/${slug}/join`, { method: "POST" });
}

export async function leaveCommunity(slug: string): Promise<void> {
  if (isDemoMode()) {
    setDemoCommunitySubscription(slug, false);
    return;
  }
  await api(`/communities/${slug}/leave`, { method: "DELETE" });
}

export async function fetchOwnedCommunities(): Promise<Community[]> {
  if (isDemoMode()) {
    return demoCommunities().filter((c) => Boolean(c.isOwner));
  }
  if (!getToken()) return [];
  const res = await api<Paginated<ApiCommunity>>("/communities", {
    query: { owned: 1, per_page: 10 },
  });
  return (res.data ?? []).map(mapCommunity);
}

export async function updateCommunityBranding(
  slug: string,
  input: { avatar_media_uuid?: string | null; cover_media_uuid?: string | null },
): Promise<Community> {
  if (isDemoMode()) {
    const current = await fetchCommunity(slug);
    return {
      ...current,
      avatarImage: input.avatar_media_uuid === null ? undefined : current.avatarImage,
      coverImage: input.cover_media_uuid === null ? undefined : current.coverImage,
    };
  }
  const res = await api<{ data: ApiCommunity }>(`/communities/${slug}/branding`, {
    method: "PATCH",
    json: {
      avatar_media_uuid: input.avatar_media_uuid,
      cover_media_uuid: input.cover_media_uuid,
    },
  });
  return mapCommunity(res.data);
}

export async function deleteCommunity(slug: string, confirmName: string): Promise<void> {
  if (isDemoMode()) {
    return;
  }
  await api(`/communities/${slug}`, {
    method: "DELETE",
    json: { confirm_name: confirmName },
  });
}

export function useOwnedCommunities(): { communities: Community[]; loading: boolean; reload: () => void } {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!isDemoMode() && !getToken()) {
      setCommunities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchOwnedCommunities()
      .then(setCommunities)
      .catch(() => setCommunities([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload]);
  return { communities, loading, reload };
}
