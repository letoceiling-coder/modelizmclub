import { apiRequest } from "./client";
import { getAuthToken } from "./auth";

export type FriendUser = {
  id: number;
  uuid: string;
  display_name: string | null;
  slug: string | null;
  avatar?: { uuid: string; url: string | null } | null;
};

export type FriendRequestItem = {
  id: number;
  status: string;
  from: FriendUser;
  to: FriendUser;
  created_at: string | null;
  responded_at?: string | null;
};

type PaginatedFriends = {
  data: FriendUser[];
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
};

type FriendRequestsResponse = {
  data: FriendRequestItem[];
};

export function hasAuthForApi(): boolean {
  return Boolean(getAuthToken());
}

export async function fetchFriends(): Promise<FriendUser[]> {
  const token = getAuthToken();
  if (!token) throw new Error("No auth token");
  const res = await apiRequest<PaginatedFriends>("/users/me/friends", { token });
  return res.data ?? [];
}

export async function searchUsers(q: string): Promise<FriendUser[]> {
  const token = getAuthToken();
  if (!token) throw new Error("No auth token");
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  qs.set("per_page", "30");
  const res = await apiRequest<PaginatedFriends>(`/users/search?${qs.toString()}`, { token });
  return res.data ?? [];
}

export async function fetchIncomingFriendRequests(): Promise<FriendRequestItem[]> {
  const token = getAuthToken();
  if (!token) throw new Error("No auth token");
  const res = await apiRequest<FriendRequestsResponse>("/users/me/friend-requests", { token });
  return res.data ?? [];
}

export async function sendFriendRequest(userId: number): Promise<FriendRequestItem> {
  const token = getAuthToken();
  if (!token) throw new Error("No auth token");
  const res = await apiRequest<{ data: FriendRequestItem }>(`/users/${userId}/friend-request`, {
    token,
    method: "POST",
  });
  return res.data;
}

export async function acceptFriendRequest(requestId: number): Promise<void> {
  const token = getAuthToken();
  if (!token) throw new Error("No auth token");
  await apiRequest(`/friend-requests/${requestId}/accept`, { token, method: "POST" });
}

export async function declineFriendRequest(requestId: number): Promise<void> {
  const token = getAuthToken();
  if (!token) throw new Error("No auth token");
  await apiRequest(`/friend-requests/${requestId}/decline`, { token, method: "POST" });
}

export async function removeFriend(userId: number): Promise<void> {
  const token = getAuthToken();
  if (!token) throw new Error("No auth token");
  await apiRequest(`/users/me/friends/${userId}`, { token, method: "DELETE" });
}
