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
  rules?: string | null;
  is_official?: boolean;
  access_type?: "open" | "request";
  custom_category?: string | null;
  members_count?: number;
  posts_count?: number;
  category?: { id?: number; name?: string; slug?: string } | null;
  city?: { id: number; name: string } | null;
  topics?: Array<{ id: number; name: string; slug?: string }>;
  contacts?: { telegram?: string | null; website?: string | null; phone?: string | null } | null;
  avatar?: { uuid?: string; url?: string | null } | null;
  cover?: { uuid?: string; url?: string | null } | null;
  is_member?: boolean;
  is_owner?: boolean;
  can_manage?: boolean;
  viewer_role?: "owner" | "moderator" | "member" | null;
  unread_posts?: number;
  unread_messages?: number;
  online_avatars?: Array<{ uuid: string; name: string; url?: string | null }>;
  join_request_pending?: boolean;
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
  city?: string | { name?: string | null } | null;
  role?: string | null;
  joined_at?: string | null;
  online?: boolean;
}

export interface CommunityMember {
  user: {
    id: string;
    uuid?: string;
    name: string;
    avatar?: string;
    city?: string;
    online?: boolean;
  };
  role: string;
  roleKey: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Создатель",
  moderator: "Модератор",
  member: "Участник",
};

export function mapCommunity(c: ApiCommunity): Community {
  const contacts = c.contacts
    ? {
        telegram: c.contacts.telegram ?? undefined,
        website: c.contacts.website ?? undefined,
        phone: c.contacts.phone ?? undefined,
      }
    : undefined;
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
    canManage: Boolean(c.can_manage),
    role: c.viewer_role ?? (c.is_owner ? "owner" : c.is_member ? "member" : undefined),
    accessType: c.access_type ?? "open",
    rules: c.rules ?? null,
    customCategory: c.custom_category ?? null,
    city: c.city ?? null,
    topics: c.topics ?? [],
    contacts,
    unreadPosts: c.unread_posts ?? 0,
    unreadMessages: c.unread_messages ?? 0,
    onlineAvatars: c.online_avatars ?? [],
    joinRequestPending: Boolean(c.join_request_pending),
  };
}

function mapCommunityMember(m: ApiCommunityMember): CommunityMember {
  const name = m.display_name ?? m.name ?? "Участник";
  const city = typeof m.city === "string" ? m.city : m.city?.name ?? undefined;
  const roleKey = m.role ?? "member";
  return {
    user: {
      id: m.slug ?? m.uuid,
      uuid: m.uuid,
      name,
      avatar: m.avatar?.url ?? undefined,
      city: city ?? undefined,
      online: Boolean(m.online),
    },
    role: ROLE_LABELS[roleKey] ?? "Участник",
    roleKey,
  };
}

export async function fetchCommunities(query?: string, taxonomyId?: number): Promise<Community[]> {
  if (isDemoMode()) return demoCommunities(query);
  const res = await api<Paginated<ApiCommunity>>("/communities", {
    auth: Boolean(getToken()),
    query: { q: query || undefined, taxonomy_id: taxonomyId || undefined, per_page: 50 },
  });
  return (res.data ?? []).map(mapCommunity);
}

export async function fetchCommunityMembers(slug: string): Promise<CommunityMember[]> {
  if (isDemoMode()) {
    const { demoCommunityMembers } = await import("@/lib/demo-data");
    return demoCommunityMembers(slug).map((m) => ({
      user: m.user,
      role: m.role,
      roleKey: m.role === "Администратор" ? "owner" : "member",
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

export async function joinCommunity(slug: string): Promise<{ status: "member" | "pending" }> {
  if (isDemoMode()) {
    setDemoCommunitySubscription(slug, true);
    return { status: "member" };
  }
  const res = await api<{ status?: string }>(`/communities/${slug}/join`, { method: "POST" });
  return { status: res.status === "pending" ? "pending" : "member" };
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
  input: {
    name?: string;
    description?: string;
    categoryId?: number;
    cityId?: number | null;
    rules?: string | null;
    accessType?: "open" | "request";
    contacts?: { telegram?: string; website?: string; phone?: string } | null;
    customCategory?: string | null;
    postCategoryIds?: number[];
  },
): Promise<Community> {
  if (isDemoMode()) {
    const current = await fetchCommunity(slug);
    return {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      categoryId: input.categoryId ?? current.categoryId,
      rules: input.rules ?? current.rules,
      accessType: input.accessType ?? current.accessType,
      contacts: input.contacts ?? current.contacts,
    };
  }
  const res = await api<{ data: ApiCommunity }>(`/communities/${slug}`, {
    method: "PATCH",
    json: {
      name: input.name,
      description: input.description,
      category_id: input.categoryId,
      city_id: input.cityId,
      rules: input.rules,
      access_type: input.accessType,
      contacts: input.contacts,
      custom_category: input.customCategory,
      post_category_ids: input.postCategoryIds,
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

export interface CommunityEvent {
  uuid: string;
  title: string;
  description?: string | null;
  startsAt: string;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coverUrl?: string | null;
  attendeesCount: number;
  going: boolean;
  mapUrl?: string | null;
}

interface ApiCommunityEvent {
  uuid: string;
  title: string;
  description?: string | null;
  starts_at: string;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  cover?: { url?: string | null } | null;
  attendees_count?: number;
  going?: boolean;
  map_url?: string | null;
}

function mapEvent(e: ApiCommunityEvent): CommunityEvent {
  return {
    uuid: e.uuid,
    title: e.title,
    description: e.description,
    startsAt: e.starts_at,
    locationName: e.location_name,
    latitude: e.latitude,
    longitude: e.longitude,
    coverUrl: e.cover?.url ?? null,
    attendeesCount: e.attendees_count ?? 0,
    going: Boolean(e.going),
    mapUrl: e.map_url ?? null,
  };
}

export async function fetchCommunityEvents(slug: string): Promise<CommunityEvent[]> {
  if (isDemoMode()) return [];
  const res = await api<{ data: ApiCommunityEvent[] }>(`/communities/${slug}/events`);
  return (res.data ?? []).map(mapEvent);
}

export async function createCommunityEvent(
  slug: string,
  input: {
    title: string;
    description?: string;
    startsAt: string;
    locationName?: string;
    latitude?: number;
    longitude?: number;
  },
): Promise<CommunityEvent> {
  const res = await api<{ data: ApiCommunityEvent }>(`/communities/${slug}/events`, {
    method: "POST",
    json: {
      title: input.title,
      description: input.description || null,
      starts_at: input.startsAt,
      location_name: input.locationName || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    },
  });
  return mapEvent(res.data);
}

export async function attendCommunityEvent(slug: string, uuid: string): Promise<CommunityEvent> {
  const res = await api<{ data: ApiCommunityEvent }>(`/communities/${slug}/events/${uuid}/attend`, {
    method: "POST",
  });
  return mapEvent(res.data);
}

export async function fetchCommunityChat(slug: string): Promise<{ conversationUuid: string }> {
  const res = await api<{ data: { conversation_uuid: string } }>(`/communities/${slug}/chat`);
  return { conversationUuid: res.data.conversation_uuid };
}

export interface CommunityJoinRequestRow {
  id: number;
  message?: string | null;
  createdAt?: string | null;
  user: { uuid: string; name: string; slug?: string | null; avatar?: string };
}

export async function fetchCommunityJoinRequests(slug: string): Promise<CommunityJoinRequestRow[]> {
  if (isDemoMode()) return [];
  const res = await api<{
    data: Array<{
      id: number;
      message?: string | null;
      created_at?: string | null;
      user: { uuid: string; display_name?: string | null; slug?: string | null; avatar?: { url?: string | null } | null };
    }>;
  }>(`/communities/${slug}/join-requests`);
  return (res.data ?? []).map((row) => ({
    id: row.id,
    message: row.message,
    createdAt: row.created_at,
    user: {
      uuid: row.user.uuid,
      name: row.user.display_name ?? "Участник",
      slug: row.user.slug,
      avatar: row.user.avatar?.url ?? undefined,
    },
  }));
}

export async function decideCommunityJoinRequest(
  slug: string,
  id: number,
  action: "approve" | "reject",
): Promise<void> {
  await api(`/communities/${slug}/join-requests/${id}/${action}`, { method: "POST" });
}

export async function banCommunityMember(slug: string, userUuid: string): Promise<void> {
  await api(`/communities/${slug}/members/${userUuid}`, { method: "DELETE" });
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
