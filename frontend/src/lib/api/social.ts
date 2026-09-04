import type { User } from "@/lib/mock";
import { registerUser } from "@/lib/mock";
import { api, ApiError } from "./client";
import { mapApiUser, type ApiUser } from "./auth";
import { isDemoMode } from "@/lib/demo-mode";
import { firstFieldError } from "./validationErrors";
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
  city?: { id?: number; name?: string | null; slug?: string | null } | null;
  last_seen_at?: string | null;
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
  uuid?: string | null;
  display_name?: string | null;
  slug?: string | null;
  bio?: string | null;
  city?: { id?: number; name?: string | null; slug?: string | null } | null;
  avatar?: { uuid?: string; url?: string | null } | null;
  cover?: { uuid?: string; url?: string | null } | null;
  stats?: {
    publications_count?: number;
    friends_count?: number;
    listings_count?: number;
    communities_count?: number;
    followers_count?: number;
    following_count?: number;
    rating_score?: number;
    reviews_count?: number;
    deals_count?: number;
    is_trusted_seller?: boolean;
  };
  member_since?: string | null;
  is_following?: boolean;
  is_friend?: boolean;
  friend_request_status?: "outgoing" | "incoming" | null;
}

export interface PublicProfile {
  user: User;
  bio: string;
  city: string;
  stats: {
    publications: number;
    friends: number;
    listings: number;
    communities: number;
    followers: number;
    following: number;
    rating: number;
    reviews: number;
    deals: number;
    trusted: boolean;
  };
  memberSince?: string;
  isFollowing: boolean;
  isFriend: boolean;
  friendRequestStatus?: "outgoing" | "incoming" | null;
}

interface Paginated<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

export function mapCompactUser(u: ApiCompactUser): User {
  if (!u?.uuid) {
    throw new ApiError(502, "Сервер вернул неполные данные пользователя");
  }
  const user = mapApiUser({
    id: u.id,
    uuid: u.uuid,
    name: u.display_name ?? undefined,
    last_seen_at: u.last_seen_at ?? undefined,
    profile: {
      display_name: u.display_name,
      slug: u.slug,
      avatar: u.avatar ?? null,
      city: u.city ?? null,
    },
  } as ApiUser);
  registerUser(user);
  return user;
}

export interface IncomingRequest {
  id: number;
  from: User;
  date: string;
}

export interface OutgoingRequest {
  id: number;
  to: User;
  date: string;
}

export interface FriendRequestResult {
  id: number;
  status: string;
  to?: User;
}

function unwrapFriendRequestPayload(res: unknown): ApiFriendRequest {
  if (!res || typeof res !== "object") {
    throw new ApiError(502, "Сервер вернул некорректный ответ при отправке заявки");
  }
  const root = res as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : res) as ApiFriendRequest;
  if (typeof data.id !== "number" || typeof data.status !== "string") {
    throw new ApiError(502, "Сервер вернул некорректный ответ при отправке заявки");
  }
  return data;
}

export function formatSocialActionError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return firstFieldError(err.errors, err.message || fallback);
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
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

export async function fetchOutgoingRequests(): Promise<OutgoingRequest[]> {
  if (isDemoMode()) return [];
  const res = await api<{ data: ApiFriendRequest[] }>("/users/me/friend-requests/sent");
  return (res.data ?? [])
    .filter((r) => r.to)
    .map((r) => ({
      id: r.id,
      to: mapCompactUser(r.to as ApiCompactUser),
      date: r.created_at ?? "",
    }));
}

export async function sendFriendRequest(userId: number): Promise<FriendRequestResult> {
  if (isDemoMode()) return { id: Date.now(), status: "pending" };
  const res = await api<unknown>(`/users/${userId}/friend-request`, { method: "POST" });
  const data = unwrapFriendRequestPayload(res);
  return {
    id: data.id,
    status: data.status,
    to: data.to?.uuid ? mapCompactUser(data.to) : undefined,
  };
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

export async function cancelFriendRequest(requestId: number): Promise<void> {
  if (isDemoMode()) return;
  await api(`/friend-requests/${requestId}`, { method: "DELETE" });
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
  city_id?: number | null;
  phone?: string | null;
  vk_url?: string | null;
  telegram_url?: string | null;
  website_url?: string | null;
  avatar_media_id?: string | null;
  cover_media_id?: string | null;
}): Promise<ApiOwnProfile> {
  if (isDemoMode()) return {};
  const res = await api<{ data: ApiOwnProfile }>("/users/me", { method: "PATCH", json: input });
  return res.data ?? {};
}

export interface ApiOwnProfile {
  display_name?: string | null;
  slug?: string | null;
  bio?: string | null;
  city_id?: number | null;
  city?: { id?: number; name?: string | null; slug?: string | null } | null;
  avatar?: { uuid?: string; url?: string | null } | null;
  cover?: { uuid?: string; url?: string | null } | null;
}

export function applyOwnProfilePatch(user: User, profile: ApiOwnProfile): User {
  const name = profile.display_name ?? user.name;
  const avatarUrl = profile.avatar?.url?.trim();
  const coverUrl = profile.cover?.url?.trim();
  return {
    ...user,
    name,
    slug: profile.slug ?? user.slug,
    bio: profile.bio ?? user.bio,
    city: profile.city?.name ?? user.city,
    cityId: profile.city_id ?? profile.city?.id ?? user.cityId,
    avatar: avatarUrl || user.avatar,
    coverImage: coverUrl || user.coverImage,
  };
}

export async function syncOwnInterests(categoryIds: number[]): Promise<string> {
  if (isDemoMode()) return "";
  const res = await api<{ data: Array<{ id: number; name: string }> }>("/users/me/interests", {
    method: "PUT",
    json: { category_ids: categoryIds },
  });
  return (res.data ?? []).map((c) => c.name).join(", ");
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
    uuid: p.uuid ?? String(p.id),
    display_name: p.display_name,
    slug: p.slug,
    avatar: p.avatar ?? null,
  } as ApiCompactUser);
  const cityName = p.city?.name ?? "";
  const bio = p.bio ?? "";
  return {
    user: {
      ...user,
      coverImage: p.cover?.url?.trim() || user.coverImage,
      city: cityName,
      cityId: p.city?.id ?? user.cityId,
      bio,
    },
    bio,
    city: cityName,
    stats: {
      publications: p.stats?.publications_count ?? 0,
      friends: p.stats?.friends_count ?? 0,
      listings: p.stats?.listings_count ?? 0,
      communities: p.stats?.communities_count ?? 0,
      followers: p.stats?.followers_count ?? 0,
      following: p.stats?.following_count ?? 0,
      rating: p.stats?.rating_score ?? 0,
      reviews: p.stats?.reviews_count ?? 0,
      deals: p.stats?.deals_count ?? 0,
      trusted: Boolean(p.stats?.is_trusted_seller),
    },
    memberSince: p.member_since ?? undefined,
    isFollowing: Boolean(p.is_following),
    isFriend: Boolean(p.is_friend),
    friendRequestStatus: p.friend_request_status ?? null,
  };
}
