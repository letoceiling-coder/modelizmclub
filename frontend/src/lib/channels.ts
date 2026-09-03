// API-backed module for the "Каналы" (Channels) section.
// Channels are one-way publishing surfaces: only owners post, users subscribe.
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import {
  demoChannels,
  demoChannel,
  demoChannelPosts,
  setDemoChannelSubscription,
} from "@/lib/demo-data";
import { formatDate } from "@/lib/format/date";

export type ChannelKind = "official" | "brand" | "shop" | "author" | "expert";
export type PostStatus = "published" | "moderation" | "rejected";
export type PostKind = "news" | "review" | "announce" | "promo";

export const POST_KIND_LABEL: Record<PostKind, string> = {
  news: "Новость",
  review: "Обзор",
  announce: "Анонс",
  promo: "Спецпредложение",
};

export interface ChannelPostMediaItem {
  type: "image" | "video";
  url: string;
  width?: number;
  height?: number;
}

export const CHANNEL_NAME_MAX = 60;
export const CHANNEL_SLUG_MAX = 80;

export interface ChannelPost {
  id: string;
  channelId: string;
  authorName: string;
  createdAt: string;
  text: string;
  status: PostStatus;
  likes: number;
  views: number;
  liked?: boolean;
  pinned?: boolean;
  feedPostId?: string;
  kind?: PostKind;
  media: ChannelPostMediaItem[];
  images: string[];
  video?: string;
  rejectionReason?: string;
}

export interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  kind: ChannelKind;
  avatarColor: string;
  bannerColor: string;
  subscribers: number;
  createdAt: string;
  ownerName: string;
  ownerAvatar?: string;
  ownerSlug?: string;
  ownerId?: string;
  avatarImage?: string;
  bannerImage?: string;
  isOwner?: boolean;
  canManage?: boolean;
  isSubscribed?: boolean;
  commentsEnabled?: boolean;
  /** Reactions on channel posts; undefined = allowed. */
  reactionsEnabled?: boolean;
  rules?: string;
  contacts?: string;
  ownerNumericId?: number;
  postsRequireModeration?: boolean;
}

const KIND_LABEL: Record<ChannelKind, string> = {
  official: "Официальный",
  brand: "Бренд",
  shop: "Магазин",
  author: "Автор",
  expert: "Эксперт",
};

export function kindLabel(k: ChannelKind) {
  return KIND_LABEL[k] ?? "Канал";
}

/** True when the viewer can edit channel settings (owner only). */
export function isChannelOwner(channel: Channel, viewerId?: string | null): boolean {
  if (!viewerId || viewerId === "guest") return false;
  if (channel.isOwner) return true;
  return Boolean(channel.ownerId && channel.ownerId === viewerId);
}

/** Owner or assigned channel admin — can publish/pin/delete posts. */
export function isChannelManager(channel: Channel, viewerId?: string | null): boolean {
  if (channel.canManage) return true;
  return isChannelOwner(channel, viewerId);
}

// ---- API mapping ----
interface ApiChannel {
  id: string;
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  kind?: string;
  avatar_color?: string;
  banner_color?: string | null;
  avatar?: { uuid?: string; url?: string | null } | null;
  banner?: { uuid?: string; url?: string | null } | null;
  subscribers?: number;
  created_at?: string;
  owner_name?: string;
  owner?: {
    id?: number;
    uuid?: string;
    display_name?: string | null;
    slug?: string | null;
    avatar?: { url?: string | null } | null;
  } | null;
  is_owner?: boolean;
  can_manage?: boolean;
  is_subscribed?: boolean;
  comments_enabled?: boolean;
  rules?: string | null;
  contacts?: string | null;
  posts_require_moderation?: boolean;
}

interface ApiChannelPostMedia {
  type?: string;
  sort_order?: number;
  media?: {
    url?: string | null;
    mime_type?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
}

interface ApiChannelPost {
  id: string;
  channel_id?: string;
  author_name?: string;
  text?: string;
  kind?: string;
  status?: string;
  likes?: number;
  views?: number;
  liked?: boolean;
  pinned?: boolean;
  feed_post_uuid?: string | null;
  created_at?: string;
  media?: ApiChannelPostMedia[];
  rejection_reason?: string | null;
}

function mapChannel(c: ApiChannel): Channel {
  return {
    id: c.slug ?? c.id,
    name: c.name ?? "",
    slug: c.slug ?? c.id,
    description: c.description ?? "",
    category: c.category ?? "",
    kind: (c.kind as ChannelKind) ?? "author",
    avatarColor: c.avatar_color ?? "#2563eb",
    bannerColor: c.banner_color ?? "linear-gradient(135deg,#1e3a8a,#2563eb)",
    avatarImage: c.avatar?.url ?? undefined,
    bannerImage: c.banner?.url ?? undefined,
    subscribers: c.subscribers ?? 0,
    createdAt: c.created_at ?? "",
    ownerName: c.owner?.display_name ?? c.owner_name ?? "",
    ownerAvatar: c.owner?.avatar?.url ?? undefined,
    ownerSlug: c.owner?.slug ?? undefined,
    ownerId: c.owner?.uuid ?? undefined,
    ownerNumericId: c.owner?.id,
    isOwner: Boolean(c.is_owner),
    canManage: Boolean(c.can_manage ?? c.is_owner),
    isSubscribed: Boolean(c.is_subscribed),
    commentsEnabled: c.comments_enabled !== false,
    rules: c.rules ?? "",
    contacts: c.contacts ?? "",
    postsRequireModeration: Boolean(c.posts_require_moderation),
  };
}

function mapStatus(s?: string): PostStatus {
  if (s === "rejected") return "rejected";
  if (s === "pending_moderation" || s === "moderation") return "moderation";
  return "published";
}

function isVideoMedia(m: ApiChannelPostMedia): boolean {
  if (m.type === "video") return true;
  return (m.media?.mime_type ?? "").startsWith("video/");
}

function mapPostMediaItem(m: ApiChannelPostMedia): ChannelPostMediaItem | null {
  const url = m.media?.url;
  if (!url) return null;
  return {
    type: isVideoMedia(m) ? "video" : "image",
    url,
    width: m.media?.width ?? undefined,
    height: m.media?.height ?? undefined,
  };
}

function mapPost(p: ApiChannelPost, channelId: string): ChannelPost {
  const media = (p.media ?? [])
    .map(mapPostMediaItem)
    .filter((item): item is ChannelPostMediaItem => item !== null);
  return {
    id: p.id,
    channelId: p.channel_id ?? channelId,
    authorName: p.author_name ?? "",
    createdAt: p.created_at ?? "",
    text: p.text ?? "",
    status: mapStatus(p.status),
    likes: p.likes ?? 0,
    views: p.views ?? 0,
    liked: Boolean(p.liked),
    pinned: Boolean(p.pinned),
    feedPostId: p.feed_post_uuid ?? undefined,
    kind: (p.kind as PostKind) ?? undefined,
    media,
    images: media.filter((item) => item.type === "image").map((item) => item.url),
    video: media.find((item) => item.type === "video")?.url,
    rejectionReason: p.rejection_reason ?? undefined,
  };
}

// ---- fetchers ----
let channelsCache: { taxonomyId?: number; list: Channel[] } | null = null;

export function getCachedChannels(taxonomyId?: number): Channel[] | null {
  if (channelsCache && channelsCache.taxonomyId === taxonomyId) return channelsCache.list;
  return null;
}

export async function fetchChannels(taxonomyId?: number): Promise<Channel[]> {
  if (isDemoMode()) return demoChannels() as Channel[];
  const res = await api<{ data: ApiChannel[] }>("/channels", {
    query: { taxonomy_id: taxonomyId || undefined },
  });
  const list = (res.data ?? []).map(mapChannel);
  channelsCache = { taxonomyId, list };
  return list;
}

export async function fetchChannel(slug: string): Promise<Channel | null> {
  if (isDemoMode()) return (demoChannel(slug) as Channel | null) ?? null;
  try {
    const res = await api<{ data: ApiChannel }>(`/channels/${slug}`);
    return mapChannel(res.data);
  } catch {
    return null;
  }
}

export async function fetchChannelPosts(slug: string): Promise<ChannelPost[]> {
  if (isDemoMode()) return demoChannelPosts(slug) as ChannelPost[];
  const res = await api<{ data: ApiChannelPost[] }>(`/channels/${slug}/posts`, {
    query: { per_page: 50 },
  });
  return (res.data ?? []).map((p) => mapPost(p, slug));
}

export async function updateChannelBranding(
  slug: string,
  input: { avatar_media_uuid?: string | null; banner_media_uuid?: string | null },
): Promise<Channel> {
  if (isDemoMode()) {
    const current = await fetchChannel(slug);
    if (!current) throw new Error("Channel not found");
    return {
      ...current,
      avatarImage: input.avatar_media_uuid === null ? undefined : current.avatarImage,
      bannerImage: input.banner_media_uuid === null ? undefined : current.bannerImage,
    };
  }
  const res = await api<{ data: ApiChannel }>(`/channels/${slug}/branding`, {
    method: "PATCH",
    json: {
      avatar_media_uuid: input.avatar_media_uuid,
      banner_media_uuid: input.banner_media_uuid,
    },
  });
  return mapChannel(res.data);
}

export async function updateChannel(
  slug: string,
  input: {
    name?: string;
    description?: string;
    category?: string;
    kind?: ChannelKind;
    comments_enabled?: boolean;
    rules?: string;
    contacts?: string;
    slug?: string;
  },
): Promise<Channel> {
  if (isDemoMode()) {
    const current = await fetchChannel(slug);
    if (!current) throw new Error("Channel not found");
    return { ...current, ...input, name: input.name ?? current.name };
  }
  const res = await api<{ data: ApiChannel }>(`/channels/${slug}`, {
    method: "PATCH",
    json: input,
  });
  return mapChannel(res.data);
}

export async function deleteChannel(slug: string, confirmName: string): Promise<void> {
  if (isDemoMode()) {
    return;
  }
  await api(`/channels/${slug}`, {
    method: "DELETE",
    json: { confirm_name: confirmName },
  });
}

export async function setChannelSubscription(slug: string, subscribe: boolean): Promise<void> {
  if (isDemoMode()) {
    setDemoChannelSubscription(slug, subscribe);
    return;
  }
  await api(`/channels/${slug}/subscribe`, { method: subscribe ? "POST" : "DELETE" });
}

export async function deleteChannelPost(channelSlug: string, postId: string): Promise<void> {
  if (isDemoMode()) {
    return;
  }
  await api(`/channels/${channelSlug}/posts/${postId}`, { method: "DELETE" });
}

const GUEST_VIEWER_KEY = "mc_vid";

export function getGuestViewerId(): string {
  if (typeof window === "undefined") return "guest-ssr-fallback";
  try {
    let id = window.localStorage.getItem(GUEST_VIEWER_KEY);
    if (!id || !/^[A-Za-z0-9._:-]{8,80}$/.test(id)) {
      id = crypto.randomUUID();
      window.localStorage.setItem(GUEST_VIEWER_KEY, id);
    }
    return id;
  } catch {
    return `guest-${Date.now()}`;
  }
}

export async function setChannelPostLiked(
  channelSlug: string,
  postId: string,
  liked: boolean,
): Promise<ChannelPost> {
  if (isDemoMode()) {
    return {
      id: postId,
      channelId: channelSlug,
      authorName: "",
      createdAt: new Date().toISOString(),
      text: "",
      status: "published",
      likes: liked ? 1 : 0,
      views: 0,
      liked,
      media: [],
      images: [],
    };
  }
  const res = await api<{ data: ApiChannelPost }>(`/channels/${channelSlug}/posts/${postId}/like`, {
    method: liked ? "POST" : "DELETE",
  });
  return mapPost(res.data, channelSlug);
}

export async function recordChannelPostView(
  channelSlug: string,
  postId: string,
): Promise<number | null> {
  if (isDemoMode()) return null;
  try {
    const res = await api<{ data: { views?: number } }>(
      `/channels/${channelSlug}/posts/${postId}/view`,
      {
        method: "POST",
        headers: { "X-Guest-Viewer": getGuestViewerId() },
      },
    );
    return res.data?.views ?? null;
  } catch {
    return null;
  }
}

export async function setChannelPostPinned(
  channelSlug: string,
  postId: string,
  pinned: boolean,
): Promise<ChannelPost> {
  if (isDemoMode()) {
    throw new Error("demo");
  }
  const res = await api<{ data: ApiChannelPost }>(`/channels/${channelSlug}/posts/${postId}/pin`, {
    method: pinned ? "POST" : "DELETE",
  });
  return mapPost(res.data, channelSlug);
}

export async function createChannelPost(input: {
  channelSlug: string;
  text: string;
  kind: PostKind;
  mediaIds?: string[];
  /** Demo mode has no real upload — pass the local blob preview URLs
   *  straight through so the composer's own preview reflects what was picked. */
  demoImages?: string[];
  demoVideo?: string;
}): Promise<ChannelPost> {
  if (isDemoMode()) {
    const media: ChannelPostMediaItem[] = [
      ...(input.demoImages ?? []).map((url) => ({ type: "image" as const, url })),
      ...(input.demoVideo ? [{ type: "video" as const, url: input.demoVideo }] : []),
    ];
    return {
      id: `demo-ch-post-${Date.now()}`,
      channelId: input.channelSlug,
      authorName: "Вы",
      createdAt: new Date().toISOString(),
      text: input.text,
      status: "published",
      likes: 0,
      views: 0,
      kind: input.kind,
      media,
      images: media.filter((item) => item.type === "image").map((item) => item.url),
      video: media.find((item) => item.type === "video")?.url,
    };
  }
  const res = await api<{ data: ApiChannelPost }>(`/channels/${input.channelSlug}/posts`, {
    method: "POST",
    json: { text: input.text, kind: input.kind, media_ids: input.mediaIds ?? [] },
  });
  return mapPost(res.data, input.channelSlug);
}

// ---- hooks ----
export function seedChannelsCache(list: Channel[], taxonomyId?: number): void {
  channelsCache = { taxonomyId, list };
}

export function useChannels(
  taxonomyId?: number,
  initial?: Channel[],
): { channels: Channel[]; loading: boolean; reload: () => void } {
  if (initial && initial.length > 0 && !getCachedChannels(taxonomyId)) {
    seedChannelsCache(initial, taxonomyId);
  }
  const cached = getCachedChannels(taxonomyId);
  const [channels, setChannels] = useState<Channel[]>(() => cached ?? []);
  const [loading, setLoading] = useState(() => !cached);

  const reload = useCallback(() => {
    setLoading(true);
    fetchChannels(taxonomyId)
      .then(setChannels)
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, [taxonomyId]);

  useEffect(() => {
    const hit = getCachedChannels(taxonomyId);
    if (hit) {
      setChannels(hit);
      setLoading(false);
      return;
    }
    reload();
  }, [reload, taxonomyId]);
  return { channels, loading, reload };
}

export function useChannel(slug: string): {
  channel: Channel | null;
  loading: boolean;
  notFound: boolean;
  reload: () => void;
} {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    fetchChannel(slug)
      .then((c) => {
        setChannel(c);
        setNotFound(c === null);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(reload, [reload]);
  return { channel, loading, notFound, reload };
}

export function useChannelPosts(slug: string): {
  posts: ChannelPost[];
  loading: boolean;
  reload: () => void;
} {
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetchChannelPosts(slug)
      .then(setPosts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(reload, [reload]);
  return { posts, loading, reload };
}

export function formatCount(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(n);
}

export function formatChannelDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return formatDate(d, "relative");
}
