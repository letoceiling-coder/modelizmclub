import type { Post, Comment, PostMediaItem, User } from "@/lib/mock";
import { registerUser } from "@/lib/mock";
import { api } from "./client";
import { mapApiUser, type ApiUser } from "./auth";
import { isDemoMode } from "@/lib/demo-mode";
import { rememberMediaAspect } from "@/lib/media/aspectCache";
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
  media?: {
    url?: string | null;
    mime_type?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
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
  repost_of?: {
    uuid?: string;
    title?: string | null;
    category?: string | null;
    author?: ApiPostAuthor | null;
  } | null;
  stats?: { views?: number; reactions?: number; comments?: number; reposts?: number };
  viewer?: { reacted?: boolean; bookmarked?: boolean; reposted?: boolean };
  permissions?: { can_delete?: boolean; can_edit?: boolean; can_publish?: boolean; can_cancel_schedule?: boolean; can_interact?: boolean };
  published_at?: string | null;
  scheduled_at?: string | null;
  created_at?: string;
  channel?: {
    id?: string;
    slug?: string;
    name?: string;
    kind?: string;
    avatar?: { url?: string | null } | null;
    is_subscribed?: boolean;
    comments_enabled?: boolean;
  } | null;
}

interface Paginated<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

export function registerAuthor(a?: ApiPostAuthor | null): User | null {
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

function isVideoMedia(m: ApiPostMedia): boolean {
  if (m.type === "video") return true;
  const mime = m.media?.mime_type ?? "";
  return mime.startsWith("video/");
}

export function mapPostMedia(p: ApiPost): { images: string[]; video?: string; mediaItems: PostMediaItem[] } {
  const mediaItems = (p.media ?? [])
    .map((m) => {
      const url = m.media?.url;
      if (!url) return null;
      // Dimensions let the feed reserve the exact box before the image loads.
      const width = m.media?.width ?? undefined;
      const height = m.media?.height ?? undefined;
      if (width && height) rememberMediaAspect(url, width / height);
      return { type: isVideoMedia(m) ? ("video" as const) : ("image" as const), url, width, height };
    })
    .filter((item): item is PostMediaItem => item !== null);

  const images = mediaItems.filter((m) => m.type === "image").map((m) => m.url);
  const video = mediaItems.find((m) => m.type === "video")?.url;
  return { images, video, mediaItems };
}

export function mapPost(p: ApiPost): Post {
  const author = registerAuthor(p.author);
  const { images, video, mediaItems } = mapPostMedia(p);
  return {
    id: p.uuid,
    authorId: author?.id ?? "",
    date: p.published_at ?? p.scheduled_at ?? p.created_at ?? "",
    category: p.category?.name ?? "",
    title: p.title ?? "",
    text: p.body ?? "",
    image: images[0],
    images,
    video,
    mediaItems,
    tags: p.hashtags ?? [],
    views: p.stats?.views ?? 0,
    likes: p.stats?.reactions ?? 0,
    comments: p.stats?.comments ?? 0,
    saves: 0,
    reposts: p.stats?.reposts ?? 0,
    status: p.status === "published" ? "published" : p.status === "scheduled" ? "scheduled" : "moderation",
    scheduledAt: p.scheduled_at ?? undefined,
    isLiked: p.viewer?.reacted ?? false,
    isSaved: p.viewer?.bookmarked ?? false,
    isReposted: p.viewer?.reposted ?? false,
    repostOf: p.repost_of?.uuid
      ? {
          id: p.repost_of.uuid,
          title: p.repost_of.title ?? "",
          category: p.repost_of.category ?? "",
          authorName: p.repost_of.author?.display_name ?? "",
        }
      : undefined,
    canDelete: p.permissions?.can_delete ?? false,
    canEdit: p.permissions?.can_edit ?? false,
    canPublish: p.permissions?.can_publish ?? false,
    canCancelSchedule: p.permissions?.can_cancel_schedule ?? false,
    canInteract: p.permissions?.can_interact ?? p.status === "published",
    channel: p.channel?.slug
      ? {
          slug: p.channel.slug,
          name: p.channel.name ?? "",
          kind: p.channel.kind,
          avatar: p.channel.avatar?.url ?? undefined,
          isSubscribed: Boolean(p.channel.is_subscribed),
          commentsEnabled: p.channel.comments_enabled !== false,
        }
      : undefined,
  };
}

export interface FeedQuery {
  filter?: "all" | "following" | "category" | "scheduled";
  categoryId?: number;
  authorId?: number;
  /** Demo-mode filtering only — mockPosts.category is a name string, not an
   *  id, and categoryIdByName()'s id cache isn't guaranteed populated yet on
   *  a fresh page load (e.g. /feed?category=... opened directly, not via an
   *  in-app link from a page that already warmed the cache). Real backend
   *  filtering still uses categoryId below; this is ignored on that path. */
  categoryName?: string;
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
    return demoFeed({ filter: opts.filter, categoryName: opts.categoryName, page: opts.page, perPage: opts.perPage });
  }
  const res = await api<Paginated<ApiPost>>("/feed", {
    query: {
      filter: opts.filter ?? "all",
      category_id: opts.categoryId,
      author_id: opts.authorId,
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

export async function repostPost(uuid: string, on: boolean): Promise<void> {
  if (isDemoMode()) return;
  await api(`/posts/${uuid}/repost`, { method: on ? "POST" : "DELETE" });
}

export interface ApiComment {
  uuid: string;
  body?: string | null;
  author?: ApiPostAuthor | null;
  parent_uuid?: string | null;
  stats?: { reactions?: number };
  replies?: ApiComment[];
  created_at?: string;
}

export function mapComment(c: ApiComment): Comment {
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
  const res = await api<Paginated<ApiComment>>(`/posts/${uuid}/comments`, { auth: false });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map(mapComment);
}

export async function reactToComment(uuid: string, on: boolean): Promise<void> {
  if (isDemoMode()) return;
  await api(`/comments/${uuid}/react`, { method: on ? "POST" : "DELETE" });
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
  communityId?: number;
  /** Media UUIDs from uploadMedia() — the backend's StorePostRequest
   *  validates media_ids.* as uuid strings, not numeric ids. */
  mediaIds?: string[];
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
      community_id: input.communityId,
      media_ids: input.mediaIds,
      hashtags: input.hashtags,
    },
  });
  return mapPost(res.data);
}

/** createPost() only creates a Draft — the composer must call this
 *  afterwards to actually publish it (goes through the normal moderation
 *  queue, per PostService::publish on the backend). Demo mode's createPost
 *  already returns a "published" fake post, so callers should skip this
 *  in demo mode rather than call it. */
export async function publishPost(uuid: string): Promise<Post> {
  const res = await api<{ data: ApiPost }>(`/posts/${uuid}/publish`, { method: "POST" });
  return mapPost(res.data);
}

export async function schedulePost(
  uuid: string,
  input: { scheduled_at_local: string; timezone: string },
): Promise<Post> {
  if (isDemoMode()) {
    return {
      id: uuid,
      authorId: "u1",
      date: input.scheduled_at_local,
      category: "",
      title: "",
      text: "",
      tags: [],
      views: 0,
      likes: 0,
      comments: 0,
      saves: 0,
      reposts: 0,
      status: "scheduled",
      scheduledAt: new Date().toISOString(),
      isLiked: false,
      isSaved: false,
      canCancelSchedule: true,
    };
  }
  const res = await api<{ data: ApiPost }>(`/posts/${uuid}/schedule`, {
    method: "POST",
    json: input,
  });
  return mapPost(res.data);
}

export async function cancelScheduledPost(uuid: string): Promise<Post> {
  if (isDemoMode()) {
    return {
      id: uuid,
      authorId: "u1",
      date: "",
      category: "",
      title: "",
      text: "",
      tags: [],
      views: 0,
      likes: 0,
      comments: 0,
      saves: 0,
      reposts: 0,
      status: "moderation",
      isLiked: false,
      isSaved: false,
    };
  }
  const res = await api<{ data: ApiPost }>(`/posts/${uuid}/schedule`, { method: "DELETE" });
  return mapPost(res.data);
}

export async function updatePost(uuid: string, data: { title?: string; body?: string }): Promise<Post> {
  if (isDemoMode()) {
    return {
      id: uuid,
      authorId: "",
      author: "Вы",
      date: "",
      category: "",
      title: data.title ?? "",
      text: data.body ?? "",
      tags: [],
      views: 0,
      likes: 0,
      comments: 0,
      saves: 0,
      reposts: 0,
      status: "published",
      isLiked: false,
      isSaved: false,
    };
  }
  const res = await api<{ data: ApiPost }>(`/posts/${uuid}`, { method: "PATCH", json: data });
  return mapPost(res.data);
}

export async function deletePost(uuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/posts/${uuid}`, { method: "DELETE" });
}
