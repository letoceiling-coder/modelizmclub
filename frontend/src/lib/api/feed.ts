import { apiRequest } from "./client";
import { getAuthToken } from "./auth";
import type { Post, PostAuthor, Comment } from "@/lib/types";
import { avatarUrl } from "@/lib/utils/time";
import { tStatic } from "@/lib/i18n";

export type ApiPostAuthor = {
  id: number;
  uuid: string;
  display_name: string | null;
  slug: string | null;
  avatar?: { uuid: string; url: string | null } | null;
};

export type ApiPost = {
  uuid: string;
  title: string;
  body: string;
  status: string;
  author?: ApiPostAuthor;
  category?: { id: number; name: string; slug: string } | null;
  media?: Array<{ media?: { url: string | null } | null }>;
  hashtags?: string[];
  stats?: { views: number; reactions: number; comments: number };
  viewer?: { reacted: boolean; bookmarked: boolean };
  published_at?: string | null;
  created_at: string;
};

type PaginatedFeed = {
  data: ApiPost[];
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
};

function mapAuthor(a?: ApiPostAuthor): PostAuthor {
  const name = a?.display_name ?? "User";
  return {
    slug: a?.slug ?? a?.uuid ?? "user",
    name,
    avatar: a?.avatar?.url ?? avatarUrl(name),
  };
}

function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return tStatic("common.justNow");
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return tStatic("common.justNow");
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн назад`;
  return date.toLocaleDateString("ru-RU");
}

export function mapApiPost(item: ApiPost): Post {
  const images =
    item.media?.map((m) => m.media?.url).filter((url): url is string => Boolean(url)) ?? [];

  return {
    id: item.uuid,
    author: mapAuthor(item.author),
    date: formatRelativeDate(item.published_at || item.created_at),
    category: item.category?.name ?? "",
    categoryId: item.category?.id,
    title: item.title,
    text: item.body,
    image: images[0],
    images: images.length > 0 ? images : undefined,
    tags: item.hashtags,
    views: item.stats?.views ?? 0,
    likes: item.stats?.reactions ?? 0,
    comments: item.stats?.comments ?? 0,
    saves: 0,
    reposts: 0,
    status: item.status === "published" ? "published" : "moderation",
    isFollowing: true,
    isLiked: item.viewer?.reacted,
    isSaved: item.viewer?.bookmarked,
    commentList: [],
  };
}

export async function fetchFeed(params?: {
  filter?: "all" | "following" | "category";
  category_id?: number;
  author_id?: number;
  page?: number;
  per_page?: number;
}): Promise<{ posts: Post[]; hasMore: boolean; error?: boolean }> {
  const search = new URLSearchParams();
  if (params?.filter && params.filter !== "all") search.set("filter", params.filter);
  if (params?.category_id) search.set("category_id", String(params.category_id));
  if (params?.author_id) search.set("author_id", String(params.author_id));
  if (params?.page) search.set("page", String(params.page));
  search.set("per_page", String(params?.per_page ?? 20));

  const token = getAuthToken();
  const qs = search.toString();

  try {
    const res = await apiRequest<PaginatedFeed>(`/feed?${qs}`, { token });
    const posts = (res.data ?? []).map(mapApiPost);
    const current = res.meta?.current_page ?? 1;
    const last = res.meta?.last_page ?? 1;
    return { posts, hasMore: current < last };
  } catch {
    return { posts: [], hasMore: false, error: true };
  }
}

export async function createPost(input: {
  title: string;
  body: string;
  category_id: number;
  community_id?: number;
  hashtags?: string[];
  media_ids?: string[];
  publish?: boolean;
}): Promise<Post> {
  const token = getAuthToken();
  const res = await apiRequest<{ data: ApiPost }>("/posts", {
    method: "POST",
    token,
    json: {
      title: input.title,
      body: input.body,
      category_id: input.category_id,
      community_id: input.community_id,
      hashtags: input.hashtags ?? [],
      media_ids: input.media_ids ?? [],
    },
  });

  const created = res.data;
  if (input.publish !== false) {
    try {
      const pub = await apiRequest<{ data: ApiPost }>(`/posts/${created.uuid}/publish`, {
        method: "POST",
        token,
      });
      return mapApiPost(pub.data);
    } catch {
      return mapApiPost(created);
    }
  }
  return mapApiPost(created);
}

export async function reactToPost(uuid: string, reacted: boolean): Promise<void> {
  const token = getAuthToken();
  await apiRequest(`/posts/${uuid}/react`, { method: reacted ? "POST" : "DELETE", token });
}

export async function bookmarkPost(uuid: string, bookmarked: boolean): Promise<void> {
  const token = getAuthToken();
  await apiRequest(`/posts/${uuid}/bookmark`, { method: bookmarked ? "POST" : "DELETE", token });
}

export async function repostPost(uuid: string, comment?: string): Promise<void> {
  const token = getAuthToken();
  await apiRequest(`/posts/${uuid}/repost`, { method: "POST", token, json: { comment: comment ?? null } });
}

type ApiCommentAuthor = {
  display_name: string | null;
  slug: string | null;
  uuid?: string;
  avatar?: { url: string | null } | null;
};

type ApiComment = {
  uuid: string;
  body: string;
  author?: ApiCommentAuthor;
  stats?: { reactions: number };
  replies?: ApiComment[];
  created_at: string;
};

function mapApiComment(item: ApiComment): Comment {
  const name = item.author?.display_name ?? "User";
  return {
    id: item.uuid,
    author: {
      slug: item.author?.slug ?? item.author?.uuid ?? "user",
      name,
      avatar: item.author?.avatar?.url ?? avatarUrl(name),
    },
    time: formatRelativeDate(item.created_at),
    text: item.body,
    likes: item.stats?.reactions ?? 0,
    replies: (item.replies ?? []).map(mapApiComment),
  };
}

export async function fetchPostComments(uuid: string): Promise<Comment[]> {
  try {
    const res = await apiRequest<{ data: ApiComment[] }>(`/posts/${uuid}/comments?per_page=50`, {
      token: getAuthToken(),
    });
    return (res.data ?? []).map(mapApiComment);
  } catch {
    return [];
  }
}

export async function createPostComment(
  uuid: string,
  body: string,
  parentUuid?: string,
): Promise<Comment | null> {
  const token = getAuthToken();
  if (!token) return null;
  const res = await apiRequest<{ data: ApiComment }>(`/posts/${uuid}/comments`, {
    method: "POST",
    token,
    json: { body, parent_uuid: parentUuid ?? null },
  });
  return mapApiComment(res.data);
}
