// Feed data: fetches real posts from the backend and maps them into the
// original template's `Post`/`User` shapes so components stay unchanged.

import type { Post, User } from "@/lib/mock";
import { upsertUsers, formatRelativeTime } from "@/lib/mock";
import { api } from "./client";

interface ApiAuthor {
  uuid: string;
  display_name: string | null;
  slug: string | null;
  avatar?: { url: string | null } | null;
}

interface ApiPost {
  uuid: string;
  title: string;
  body: string;
  status: string;
  author?: ApiAuthor;
  category?: { id: number; name: string; slug: string } | null;
  media?: Array<{ media?: { url: string | null } | null }>;
  hashtags?: string[];
  stats?: { views: number; reactions: number; comments: number };
  viewer?: { reacted: boolean; bookmarked: boolean };
  published_at?: string | null;
  created_at: string;
}

interface Paginated<T> {
  data: T[];
  meta?: { current_page: number; last_page: number };
}

const avatarFallback = (name: string): string =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

function mapAuthor(a?: ApiAuthor): User {
  const name = a?.display_name ?? "Пользователь";
  return {
    id: a?.uuid ?? "unknown",
    name,
    city: "",
    interests: "",
    avatar: a?.avatar?.url ?? avatarFallback(name),
  };
}

export function mapPost(p: ApiPost): Post {
  const images = (p.media ?? [])
    .map((m) => m.media?.url)
    .filter((u): u is string => Boolean(u));

  return {
    id: p.uuid,
    authorId: p.author?.uuid ?? "unknown",
    date: formatRelativeTime(p.published_at || p.created_at),
    category: p.category?.name ?? "",
    title: p.title,
    text: p.body,
    image: images[0],
    images: images.length > 0 ? images : undefined,
    tags: p.hashtags,
    views: p.stats?.views ?? 0,
    likes: p.stats?.reactions ?? 0,
    comments: p.stats?.comments ?? 0,
    saves: 0,
    reposts: 0,
    status: p.status === "published" ? "published" : "moderation",
    isFollowing: true,
    isLiked: p.viewer?.reacted,
    isSaved: p.viewer?.bookmarked,
    commentList: [],
  };
}

export async function fetchFeedPosts(perPage = 20): Promise<Post[]> {
  const res = await api<Paginated<ApiPost>>(`/feed?per_page=${perPage}`);
  const items = res.data ?? [];
  upsertUsers(items.map((i) => mapAuthor(i.author)));
  return items.map(mapPost);
}
