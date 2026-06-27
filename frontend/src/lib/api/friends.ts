import type { FriendRequest, ID } from "@/lib/mock";
import { upsertUsers } from "@/lib/mock";
import { hydrateStore, type Friendship } from "@/lib/store";
import { me } from "@/lib/mock";
import { api } from "./client";

interface ApiUser {
  uuid: string;
  display_name?: string | null;
  avatar?: { url?: string | null } | null;
}

interface ApiFriendRequest {
  id: number;
  from?: ApiUser;
  to?: ApiUser;
  status: string;
  created_at: string;
}

interface ApiFriend {
  uuid: string;
  display_name?: string | null;
  avatar?: { url?: string | null } | null;
  friends_since?: string;
}

interface Paginated<T> {
  data: T[];
}

function mapUser(u: ApiUser) {
  const name = u.display_name ?? "Пользователь";
  return {
    id: u.uuid,
    name,
    city: "",
    interests: "",
    avatar: u.avatar?.url ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
  };
}

export async function loadFriendsIntoStore(): Promise<void> {
  try {
    const [friendsRes, requestsRes] = await Promise.all([
      api<Paginated<ApiFriend>>("/users/me/friends?per_page=100"),
      api<Paginated<ApiFriendRequest>>("/users/me/friend-requests?per_page=50"),
    ]);

    const friendships: Friendship[] = [];
    for (const f of friendsRes.data ?? []) {
      upsertUsers([mapUser(f)]);
      friendships.push({
        id: `fs_${[me.id, f.uuid].sort().join("|")}`,
        userId1: me.id,
        userId2: f.uuid,
        since: f.friends_since ?? new Date().toISOString(),
      });
    }

    const friendRequests: FriendRequest[] = [];
    for (const r of requestsRes.data ?? []) {
      if (r.from) upsertUsers([mapUser(r.from)]);
      if (r.to) upsertUsers([mapUser(r.to)]);
      friendRequests.push({
        id: String(r.id),
        fromId: r.from?.uuid ?? "",
        toId: r.to?.uuid ?? me.id,
        status: r.status === "pending" ? "pending" : r.status === "accepted" ? "accepted" : "rejected",
        date: r.created_at,
      });
    }

    hydrateStore({ userId: me.id, friendships, friendRequests });
  } catch {
    // not authenticated
  }
}
