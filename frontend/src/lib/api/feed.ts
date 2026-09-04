import type { Post, Comment, PostMediaItem, User } from "@/lib/mock";
import { registerUser } from "@/lib/mock";
import { api, getToken } from "./client";
import { mapApiUser, type ApiUser } from "./auth";
import { isDemoMode } from "@/lib/demo-mode";
import { rememberMediaAspect } from "@/lib/media/aspectCache";
import { demoFeed, demoPostComments } from "@/lib/demo-data";
import type { MediaVariantSet } from "@/lib/media/variants";

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
    status?: string | null;
    variants?: MediaVariantSet;
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
    body?: string | null;
    category?: string | null;
    author?: ApiPostAuthor | null;
    media?: ApiPostMedia[];
    hashtags?: string[];
    stats?: { views?: number; reactions?: number; comments?: number; reposts?: number };
    viewer?: { reacted?: boolean; bookmarked?: boolean; reposted?: boolean };
    published_at?: string | null;
  } | null;
  stats?: { views?: number; reactions?: number; comments?: number; reposts?: number };
  viewer?: { reacted?: boolean; bookmarked?: boolean; reposted?: boolean };
  permissions?: {
    can_delete?: boolean;
    can_edit?: boolean;
    can_publish?: boolean;
    can_cancel_schedule?: boolean;
    can_interact?: boolean;
  };
  can?: Record<string, boolean>;
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

export function mapPostMedia(p: ApiPost): {
  images: string[];
  video?: string;
  mediaItems: PostMediaItem[];
} {
  const mediaItems = (p.media ?? [])
    .map((m) => {
      const status =
        (m.media?.status as PostMediaItem["status"] | undefined) ??
        (m.media?.url ? "ready" : undefined);
      const url = m.media?.url ?? "";
      if (!url && status !== "pending" && status !== "failed") return null;
      const width = m.media?.width ?? undefined;
      const height = m.media?.height ?? undefined;
      if (url && width && height) rememberMediaAspect(url, width / height);
      // Annotated, not inferred: an inferred literal makes every key required,
      // which the `item is PostMediaItem` predicate below then rejects.
      const item: PostMediaItem = {
        type: isVideoMedia(m) ? "video" : "image",
        url,
        status,
        width,
        height,
        variants: m.media?.variants,
      };
      return item;
    })
    .filter((item): item is PostMediaItem => item !== null);

  const images = mediaItems.filter((m) => m.type === "image").map((m) => m.url);
  const video = mediaItems.find((m) => m.type === "video")?.url;
  return { images, video, mediaItems };
}

export function mapEmbeddedOriginal(r: NonNullable<ApiPost["repost_of"]>): Post | undefined {
  if (!r?.uuid) return undefined;
  const author = registerAuthor(r.author);
  const { images, video, mediaItems } = mapPostMedia({ media: r.media ?? [] } as ApiPost);
  return {
    id: r.uuid,
    authorId: author?.id ?? "",
    date: r.published_at ?? "",
    category: r.category ?? "",
    title: r.title ?? "",
    text: r.body ?? "",
    image: images[0],
    images,
    video,
    mediaItems,
    tags: r.hashtags ?? [],
    views: r.stats?.views ?? 0,
    likes: r.stats?.reactions ?? 0,
    comments: r.stats?.comments ?? 0,
    saves: 0,
    reposts: r.stats?.reposts ?? 0,
    status: "published",
    isLiked: r.viewer?.reacted ?? false,
    isSaved: r.viewer?.bookmarked ?? false,
    isReposted: r.viewer?.reposted ?? false,
    canInteract: true,
  };
}

export function mapPost(p: ApiPost): Post {
  const author = registerAuthor(p.author);
  const { images, video, mediaItems } = mapPostMedia(p);
  const isShare = Boolean(p.repost_of?.uuid);
  return {
    id: p.uuid,
    authorId: author?.id ?? "",
    date: p.published_at ?? p.scheduled_at ?? p.created_at ?? "",
    category: p.category?.name ?? "",
    title: isShare ? "" : p.title || "",
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
    status:
      p.status === "published"
        ? "published"
        : p.status === "scheduled"
          ? "scheduled"
          : "moderation",
    scheduledAt: p.scheduled_at ?? undefined,
    isLiked: p.viewer?.reacted ?? false,
    isSaved: p.viewer?.bookmarked ?? false,
    isReposted: p.viewer?.reposted ?? false,
    repostOf: isShare && p.repost_of ? mapEmbeddedOriginal(p.repost_of) : undefined,
    canDelete: p.permissions?.can_delete ?? false,
    canEdit: p.permissions?.can_edit ?? false,
    canPublish: p.permissions?.can_publish ?? false,
    canCancelSchedule: p.permissions?.can_cancel_schedule ?? false,
    canInteract: p.permissions?.can_interact ?? p.status === "published",
    can: p.can,
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
  /** Bare hashtag name (no "#"); FeedService matches it against tag name/slug. */
  hashtag?: string;
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
    return demoFeed({
      filter: opts.filter,
      categoryName: opts.categoryName,
      page: opts.page,
      perPage: opts.perPage,
    });
  }
  const res = await api<Paginated<ApiPost>>("/feed", {
    auth: Boolean(getToken()),
    query: {
      filter: opts.filter ?? "all",
      category_id: opts.categoryId,
      author_id: opts.authorId,
      hashtag: opts.hashtag,
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

export async function repostPost(uuid: string, on: boolean, body?: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/posts/${uuid}/repost`, {
    method: on ? "POST" : "DELETE",
    json: on ? { body: body ?? "" } : undefined,
  });
}

export interface ApiComment {
  uuid: string;
  can?: Record<string, boolean>;
  body?: string | null;
  author?: ApiPostAuthor | null;
  parent_uuid?: string | null;
  media?: Array<{ uuid?: string; url?: string | null } | null>;
  stats?: { reactions?: number };
  replies?: ApiComment[];
  created_at?: string;
}

export type CommentSort = "interesting" | "old" | "new";

export function mapComment(c: ApiComment): Comment {
  const author = registerAuthor(c.author);
  return {
    id: c.uuid,
    authorId: author?.id ?? "",
    time: c.created_at ?? "",
    can: c.can,
    text: c.body ?? "",
    likes: c.stats?.reactions ?? 0,
    replies: (c.replies ?? []).map(mapComment),
    images: (c.media ?? []).map((m) => m?.url).filter((url): url is string => Boolean(url)),
  };
}

export async function fetchPostComments(
  uuid: string,
  opts?: { sort?: CommentSort; perPage?: number; page?: number },
): Promise<Comment[]> {
  const { comments } = await fetchPostCommentsPage(uuid, opts);
  return comments;
}

async function fetchPostCommentsPage(
  uuid: string,
  opts?: { sort?: CommentSort; perPage?: number; page?: number },
): Promise<{ comments: Comment[]; lastPage: number }> {
  if (isDemoMode()) {
    return { comments: demoPostComments(uuid), lastPage: 1 };
  }
  const res = await api<Paginated<ApiComment>>(`/posts/${uuid}/comments`, {
    auth: false,
    query: {
      sort: opts?.sort ?? "interesting",
      per_page: opts?.perPage ?? 50,
      page: opts?.page || undefined,
    },
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  return {
    comments: rows.map(mapComment),
    lastPage: Math.max(1, res.meta?.last_page ?? 1),
  };
}

export async function fetchAllPostComments(
  uuid: string,
  sort: CommentSort = "interesting",
): Promise<Comment[]> {
  if (isDemoMode()) return demoPostComments(uuid);
  const all: Comment[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const chunk = await fetchPostCommentsPage(uuid, { sort, perPage: 50, page });
    all.push(...chunk.comments);
    lastPage = chunk.lastPage;
    page += 1;
  } while (page <= lastPage && page <= 20);
  return all;
}

export async function reactToComment(uuid: string, on: boolean): Promise<void> {
  if (isDemoMode()) return;
  await api(`/comments/${uuid}/react`, { method: on ? "POST" : "DELETE" });
}

export async function deleteComment(uuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/comments/${uuid}`, { method: "DELETE" });
}

export async function createComment(
  uuid: string,
  body: string,
  parentUuid?: string,
  mediaIds?: string[],
): Promise<Comment> {
  if (isDemoMode()) {
    return {
      id: `demo-c-${Date.now()}`,
      authorId: "u1",
      time: new Date().toISOString(),
      text: body,
      likes: 0,
      replies: [],
      images: [],
    };
  }
  const res = await api<{ data: ApiComment }>(`/posts/${uuid}/comments`, {
    method: "POST",
    json: { body, parent_uuid: parentUuid, media_ids: mediaIds ?? [] },
  });
  return mapComment(res.data);
}

export interface CreatePostInput {
  title: string;
  body: string;
  /** Post taxonomy node — pass the deepest one the author picked ("Масштаб"
   *  when set, otherwise "Направление"): post categories are a single tree,
   *  and the feed's category filter already matches descendants, so storing
   *  the leaf keeps the direction filter working while preserving the scale.
   *  Optional — like VK, a post may carry no category at all. */
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

export async function fetchPost(uuid: string): Promise<Post> {
  if (isDemoMode()) {
    const found = demoFeed().posts.find((p) => p.id === uuid);
    if (!found) throw new Error("not found");
    return found;
  }
  const res = await api<{ data: ApiPost }>(`/posts/${uuid}`);
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

export async function updatePost(
  uuid: string,
  data: { title?: string; body?: string },
): Promise<Post> {
  if (isDemoMode()) {
    return {
      id: uuid,
      authorId: "",
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
