import type { Community, Post } from "@/lib/mock";
import { api, getToken } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { demoCommunities, demoCommunity, demoCommunityPosts, setDemoCommunitySubscription } from "@/lib/demo-data";
import { mapPost, type ApiPost } from "./feed";
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
  viewer_role?: "owner" | "moderator" | "member" | null;
}

interface Paginated<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

interface ApiCommunityMember {
  uuid: string;
  display_name?: string | null;
  name?: string | null;
  slug?: string | null;
  avatar?: { url?: string | null } | null;
  city?: string | null;
  role?: string | null;
  joined_at?: string | null;
}

export interface CommunityMember {
  user: {
    id: string;
    name: string;
    avatar?: string;
    city?: string;
    online?: boolean;
  };
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  moderator: "Модератор",
  member: "Участник",
};

export function mapCommunity(c: ApiCommunity): Community {
  return {
    id: c.slug,
    backendId: c.id,
    uuid: c.uuid,
    name: c.name,
    description: c.description ?? "",
    fullDescription: c.description ?? undefined,
    members: c.members_count ?? 0,
    category: c.category?.name ?? "",
    categoryId: c.category?.id,
    joined: c.is_member ?? false,
    coverImage: c.cover?.url ?? undefined,
    avatarImage: c.avatar?.url ?? undefined,
    isOwner: Boolean(c.is_owner),
    role: c.viewer_role ?? (c.is_owner ? "owner" : c.is_member ? "member" : undefined),
  };
}

function mapCommunityMember(m: ApiCommunityMember): CommunityMember {
  const name = m.display_name ?? m.name ?? "Участник";
  return {
    user: {
      id: m.slug ?? m.uuid,
      name,
      avatar: m.avatar?.url ?? undefined,
      city: m.city ?? undefined,
    },
    role: ROLE_LABELS[m.role ?? "member"] ?? "Участник",
  };
}

export async function fetchCommunities(query?: string): Promise<Community[]> {
  if (isDemoMode()) return demoCommunities(query);
  const res = await api<Paginated<ApiCommunity>>("/communities", {
    query: { q: query || undefined, per_page: 50 },
  });
  return (res.data ?? []).map(mapCommunity);
}

export async function fetchCommunityMembers(slug: string): Promise<CommunityMember[]> {
  if (isDemoMode()) {
    const { demoCommunityMembers } = await import("@/lib/demo-data");
    return demoCommunityMembers(slug).map((m) => ({
      user: m.user,
      role: m.role,
    }));
  }
  const res = await api<Paginated<ApiCommunityMember>>(`/communities/${slug}/members`, {
    query: { per_page: 100 },
  });
  return (res.data ?? []).map(mapCommunityMember);
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

export async function fetchCommunityPosts(slug: string): Promise<Post[]> {
  if (isDemoMode()) {
    const c = demoCommunity(slug);
    return c ? demoCommunityPosts(c.id) : [];
  }
  const res = await api<{ data: ApiPost[] }>(`/communities/${slug}/posts`, {
    query: { per_page: 50 },
  });
  const payload = res.data;
  const list = Array.isArray(payload) ? payload : [];
  return list.map(mapPost);
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

export async function updateCommunity(
  slug: string,
  input: { name?: string; description?: string; categoryId?: number },
): Promise<Community> {
  if (isDemoMode()) {
    const current = await fetchCommunity(slug);
    return {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      categoryId: input.categoryId ?? current.categoryId,
    };
  }
  const res = await api<{ data: ApiCommunity }>(`/communities/${slug}`, {
    method: "PATCH",
    json: {
      name: input.name,
      description: input.description,
      category_id: input.categoryId,
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
