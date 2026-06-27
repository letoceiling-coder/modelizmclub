import type { Community } from "@/lib/mock";
import { replaceCommunities } from "@/lib/mock";
import { hydrateStore } from "@/lib/store";
import { me } from "@/lib/mock";
import { api } from "./client";
import { mediaUrl } from "./config";

interface ApiCommunity {
  uuid: string;
  name: string;
  slug: string;
  description: string | null;
  members_count: number;
  is_member?: boolean;
  category?: { name: string } | null;
  avatar?: { uuid: string } | null;
  cover?: { uuid: string } | null;
}

interface Paginated<T> {
  data: T[];
}

const iconForCategory = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes("ави")) return "Plane";
  if (n.includes("брон") || n.includes("танк")) return "Car";
  if (n.includes("кораб") || n.includes("суд")) return "Ship";
  if (n.includes("квадр") || n.includes("fpv")) return "Send";
  if (n.includes("электр")) return "Cpu";
  if (n.includes("аккум")) return "BatteryCharging";
  if (n.includes("разраб")) return "Code2";
  if (n.includes("запчаст")) return "Wrench";
  return "Users";
};

export function mapCommunity(c: ApiCommunity): Community {
  return {
    id: c.slug,
    name: c.name,
    description: c.description ?? "",
    members: c.members_count ?? 0,
    category: c.category?.name ?? "",
    joined: Boolean(c.is_member),
    avatarIcon: iconForCategory(c.category?.name ?? c.name),
    coverImage: mediaUrl(c.cover?.uuid),
    avatarImage: mediaUrl(c.avatar?.uuid),
    allowSubmitPost: true,
  };
}

export async function fetchCommunities(perPage = 50): Promise<Community[]> {
  const res = await api<Paginated<ApiCommunity>>(`/communities?per_page=${perPage}`);
  return (res.data ?? []).map(mapCommunity);
}

export async function fetchCommunity(slug: string): Promise<Community | null> {
  try {
    const res = await api<{ data: ApiCommunity }>(`/communities/${encodeURIComponent(slug)}`);
    return mapCommunity(res.data);
  } catch {
    return null;
  }
}

export async function loadCommunitiesIntoStore(): Promise<void> {
  const list = await fetchCommunities();
  replaceCommunities(list);
  hydrateStore({ userId: me.id, communities: list });
}
