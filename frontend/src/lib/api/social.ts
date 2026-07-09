import type { User } from "@/lib/mock";
import { registerUser } from "@/lib/mock";
import { api } from "./client";
import { mapApiUser, type ApiUser } from "./auth";
import { isDemoMode } from "@/lib/demo-mode";
import {
  demoFriends,
  demoIncomingRequests,
  demoSearchUsers,
  demoPublicProfile,
} from "@/lib/demo-data";

export interface ApiCompactUser {
  id?: number;
  uuid: string;
  display_name?: string | null;
  slug?: string | null;
  avatar?: { url?: string | null } | null;
}

export interface ApiFriendRequest {
  id: number;
  status: string;
  from?: ApiCompactUser | null;
  to?: ApiCompactUser | null;
  created_at?: string | null;
  responded_at?: string | null;
}

interface ApiPublicProfile {
  id: number;
  display_name?: string | null;
  slug?: string | null;
  bio?: string | null;
  city?: { id?: number; name?: string | null; slug?: string | null } | null;
  avatar?: { uuid?: string; url?: string | null } | null;
  stats?: {
    publications_count?: number;
    followers_count?: number;
    following_count?: number;
    rating_score?: number;
  };
  member_since?: string | null;
  is_following?: boolean;
}

export interface PublicProfile {
  user: User;
  bio: string;
  city: string;
  stats: {
    publications: number;
    followers: number;
    following: number;
    rating: number;
  };
  memberSince?: string;
  isFollowing: boolean;
}

interface Paginated<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

export function mapCompactUser(u: ApiCompactUser): User {
  const user = mapApiUser({
    id: u.id,
    uuid: u.uuid,
    name: u.display_name ?? undefined,
    profile: { display_name: u.display_name, slug: u.slug, avatar: u.avatar ?? null },
  } as ApiUser);
  registerUser(user);
  return user;
}

export interface IncomingRequest {
  id: number;
  from: User;
  date: string;
}

export async function searchUsers(q: string): Promise<User[]> {
  if (isDemoMode()) return demoSearchUsers(q);
  const res = await api<Paginated<ApiCompactUser>>("/users/search", {
    query: { q, per_page: 50 },
  });
  return (res.data ?? []).map(mapCompactUser);
}

export async function fetchFriends(): Promise<User[]> {
  if (isDemoMode()) return demoFriends();
  const res = await api<Paginated<ApiCompactUser>>("/users/me/friends", {
    query: { per_page: 50 },
  });
  return (res.data ?? []).map(mapCompactUser);
}

export async function fetchIncomingRequests(): Promise<IncomingRequest[]> {
  if (isDemoMode()) return demoIncomingRequests();
  const res = await api<{ data: ApiFriendRequest[] }>("/users/me/friend-requests");
  return (res.data ?? [])
    .filter((r) => r.from)
    .map((r) => ({
      id: r.id,
      from: mapCompactUser(r.from as ApiCompactUser),
      date: r.created_at ?? "",
    }));
}

export async function sendFriendRequest(userId: number): Promise<void> {
  if (isDemoMode()) return;
  await api(`/users/${userId}/friend-request`, { method: "POST" });
}

export async function removeFriend(userId: number): Promise<void> {
  if (isDemoMode()) return;
  await api(`/users/me/friends/${userId}`, { method: "DELETE" });
}

export async function acceptFriendRequest(requestId: number): Promise<void> {
  if (isDemoMode()) return;
  await api(`/friend-requests/${requestId}/accept`, { method: "POST" });
}

export async function declineFriendRequest(requestId: number): Promise<void> {
  if (isDemoMode()) return;
  await api(`/friend-requests/${requestId}/decline`, { method: "POST" });
}

export async function followUser(userId: number): Promise<void> {
  if (isDemoMode()) return;
  await api(`/users/${userId}/follow`, { method: "POST" });
}

export async function unfollowUser(userId: number): Promise<void> {
  if (isDemoMode()) return;
  await api(`/users/${userId}/follow`, { method: "DELETE" });
}

export async function updateOwnProfile(input: {
  display_name?: string;
  bio?: string;
  slug?: string;
  avatar_media_id?: string | null;
  cover_media_id?: string | null;
}): Promise<void> {
  if (isDemoMode()) return;
  await api("/users/me", { method: "PATCH", json: input });
}

export async function blockUser(userId: number, reason?: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/users/${userId}/block`, { method: "POST", json: reason ? { reason } : {} });
}

export async function unblockUser(userId: number): Promise<void> {
  if (isDemoMode()) return;
  await api(`/users/${userId}/block`, { method: "DELETE" });
}

export async function fetchBlockedUsers(): Promise<User[]> {
  if (isDemoMode()) return [];
  const res = await api<Paginated<ApiCompactUser>>("/users/me/blocks", {
    query: { per_page: 100 },
  });
  return (res.data ?? []).map(mapCompactUser);
}

export async function fetchPublicProfile(slug: string): Promise<PublicProfile> {
  if (isDemoMode()) return demoPublicProfile(slug);
  const res = await api<{ data: ApiPublicProfile }>(`/users/${slug}`);
  const p = res.data;
  const user = mapCompactUser({
    id: p.id,
    uuid: p.slug ?? String(p.id),
    display_name: p.display_name,
    slug: p.slug,
    avatar: p.avatar ?? null,
  });
  return {
    user,
    bio: p.bio ?? "",
    city: p.city?.name ?? "",
    stats: {
      publications: p.stats?.publications_count ?? 0,
      followers: p.stats?.followers_count ?? 0,
      following: p.stats?.following_count ?? 0,
      rating: p.stats?.rating_score ?? 0,
    },
    memberSince: p.member_since ?? undefined,
    isFollowing: Boolean(p.is_following),
  };
}
