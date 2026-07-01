import type { Post, Comment, User } from "@/lib/mock";
import { registerUser } from "@/lib/mock";
import { api } from "./client";
import { mapApiUser, type ApiUser } from "./auth";
import { isDemoMode } from "@/lib/demo-mode";
import { demoFeed, demoPostComments } from "@/lib/demo-data";

interface ApiPostAuthor {
  id?: number;
  uuid: string;
  display_name?: string | null;
  slug?: string | null;
  avatar?: { url?: string | null } | null;
}

interface ApiPostMedia {
  type?: string;
  media?: { url?: string | null } | null;
}

export interface ApiPost {
  uuid: string;
  title?: string | null;
  body?: string | null;
  status?: string;
  author?: ApiPostAuthor | null;
  category?: { id?: number; name?: string; slug?: string } | null;
  media?: ApiPostMedia[];
  hashtags?: string[];
  stats?: { views?: number; reactions?: number; comments?: number };
  viewer?: { reacted?: boolean; bookmarked?: boolean };
  published_at?: string | null;
  created_at?: string;
}

interface Paginated<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

function registerAuthor(a?: ApiPostAuthor | null): User | null {
  if (!a?.uuid) return null;
  const user = mapApiUser({
    uuid: a.uuid,
    name: a.display_name ?? undefined,
    profile: {
      display_name: a.display_name,
      slug: a.slug,
      avatar: a.avatar ?? null,
    },
  } as ApiUser);
  registerUser(user);
  return user;
}

export function mapPost(p: ApiPost): Post {
  const author = registerAuthor(p.author);
  const images = (p.media ?? [])
    .map((m) => m.media?.url)
    .filter((u): u is string => Boolean(u));
  return {
    id: p.uuid,
    authorId: author?.id ?? "",
    date: p.published_at ?? p.created_at ?? "",
    category: p.category?.name ?? "",
    title: p.title ?? "",
    text: p.body ?? "",
    image: images[0],
    images,
    tags: p.hashtags ?? [],
    views: p.stats?.views ?? 0,
    likes: p.stats?.reactions ?? 0,
    comments: p.stats?.comments ?? 0,
    saves: 0,
    reposts: 0,
    status: p.status === "published" ? "published" : "moderation",
    isLiked: p.viewer?.reacted ?? false,
    isSaved: p.viewer?.bookmarked ?? false,
  };
}

export interface FeedQuery {
  filter?: "all" | "following" | "category";
  categoryId?: number;
  page?: number;
  perPage?: number;
}

export interface FeedResult {
  posts: Post[];
  page: number;
  lastPage: number;
  total: number;
}

export async function fetchFeed(opts: FeedQuery = {}): Promise<FeedResult> {
  if (isDemoMode()) {
    return demoFeed({ filter: opts.filter, page: opts.page, perPage: opts.perPage });
  }
  const res = await api<Paginated<ApiPost>>("/feed", {
    query: {
      filter: opts.filter ?? "all",
      category_id: opts.categoryId,
      page: opts.page,
      per_page: opts.perPage ?? 20,
    },
  });
  return {
    posts: (res.data ?? []).map(mapPost),
    page: res.meta?.current_page ?? 1,
    lastPage: res.meta?.last_page ?? 1,
    total: res.meta?.total ?? res.data?.length ?? 0,
  };
}

export async function reactToPost(uuid: string, on: boolean): Promise<void> {
  if (isDemoMode()) return;
  await api(`/posts/${uuid}/react`, { method: on ? "POST" : "DELETE" });
}

export async function bookmarkPost(uuid: string, on: boolean): Promise<void> {
  if (isDemoMode()) return;
  await api(`/posts/${uuid}/bookmark`, { method: on ? "POST" : "DELETE" });
}

interface ApiComment {
  uuid: string;
  body?: string | null;
  author?: ApiPostAuthor | null;
  parent_uuid?: string | null;
  stats?: { reactions?: number };
  replies?: ApiComment[];
  created_at?: string;
}

function mapComment(c: ApiComment): Comment {
  const author = registerAuthor(c.author);
  return {
    id: c.uuid,
    authorId: author?.id ?? "",
    time: c.created_at ?? "",
    text: c.body ?? "",
    likes: c.stats?.reactions ?? 0,
    replies: (c.replies ?? []).map(mapComment),
  };
}

export async function fetchPostComments(uuid: string): Promise<Comment[]> {
  if (isDemoMode()) return demoPostComments(uuid);
  const res = await api<Paginated<ApiComment>>(`/posts/${uuid}/comments`);
  return (res.data ?? []).map(mapComment);
}

export async function createComment(
  uuid: string,
  body: string,
  parentUuid?: string,
): Promise<Comment> {
  if (isDemoMode()) {
    return {
      id: `demo-c-${Date.now()}`,
      authorId: "u1",
      time: "только что",
      text: body,
      likes: 0,
      replies: [],
    };
  }
  const res = await api<{ data: ApiComment }>(`/posts/${uuid}/comments`, {
    method: "POST",
    json: { body, parent_uuid: parentUuid },
  });
  return mapComment(res.data);
}

export interface CreatePostInput {
  title: string;
  body: string;
  categoryId?: number;
  mediaIds?: number[];
  hashtags?: string[];
}

export async function createPost(input: CreatePostInput): Promise<Post> {
  if (isDemoMode()) {
    return {
      id: `demo-p-${Date.now()}`,
      authorId: "u1",
      date: "только что",
      category: "",
      title: input.title,
      text: input.body,
      tags: input.hashtags ?? [],
      views: 0,
      likes: 0,
      comments: 0,
      saves: 0,
      reposts: 0,
      status: "published",
      isLiked: false,
      isSaved: false,
      commentList: [],
    };
  }
  const res = await api<{ data: ApiPost }>("/posts", {
    method: "POST",
    json: {
      title: input.title,
      body: input.body,
      category_id: input.categoryId,
      media_ids: input.mediaIds,
      hashtags: input.hashtags,
    },
  });
  return mapPost(res.data);
}
