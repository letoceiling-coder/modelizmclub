// API-backed module for the "Каналы" (Channels) section.
// Channels are one-way publishing surfaces: only owners post, users subscribe.
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import { demoChannels, demoChannel, demoChannelPosts, setDemoChannelSubscription } from "@/lib/demo-data";

export type ChannelKind = "official" | "brand" | "shop" | "author" | "expert";
export type PostStatus = "published" | "moderation" | "rejected";
export type PostKind = "news" | "review" | "announce" | "promo";

export const POST_KIND_LABEL: Record<PostKind, string> = {
  news: "Новость",
  review: "Обзор",
  announce: "Анонс",
  promo: "Спецпредложение",
};

export interface ChannelPost {
  id: string;
  channelId: string;
  authorName: string;
  createdAt: string;
  text: string;
  status: PostStatus;
  likes: number;
  views: number;
  kind?: PostKind;
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
  isOwner?: boolean;
  isSubscribed?: boolean;
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
  subscribers?: number;
  created_at?: string;
  owner_name?: string;
  is_owner?: boolean;
  is_subscribed?: boolean;
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
  created_at?: string;
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
    subscribers: c.subscribers ?? 0,
    createdAt: c.created_at ?? "",
    ownerName: c.owner_name ?? "",
    isOwner: Boolean(c.is_owner),
    isSubscribed: Boolean(c.is_subscribed),
  };
}

function mapStatus(s?: string): PostStatus {
  if (s === "rejected") return "rejected";
  if (s === "pending_moderation" || s === "moderation") return "moderation";
  return "published";
}

function mapPost(p: ApiChannelPost, channelId: string): ChannelPost {
  return {
    id: p.id,
    channelId: p.channel_id ?? channelId,
    authorName: p.author_name ?? "",
    createdAt: p.created_at ?? "",
    text: p.text ?? "",
    status: mapStatus(p.status),
    likes: p.likes ?? 0,
    views: p.views ?? 0,
    kind: (p.kind as PostKind) ?? undefined,
  };
}

// ---- fetchers ----
export async function fetchChannels(): Promise<Channel[]> {
  if (isDemoMode()) return demoChannels() as Channel[];
  const res = await api<{ data: ApiChannel[] }>("/channels");
  return (res.data ?? []).map(mapChannel);
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
  const res = await api<{ data: ApiChannelPost[] }>(`/channels/${slug}/posts`, { query: { per_page: 50 } });
  return (res.data ?? []).map((p) => mapPost(p, slug));
}

export async function setChannelSubscription(slug: string, subscribe: boolean): Promise<void> {
  if (isDemoMode()) {
    setDemoChannelSubscription(slug, subscribe);
    return;
  }
  await api(`/channels/${slug}/subscribe`, { method: subscribe ? "POST" : "DELETE" });
}

export async function createChannelPost(input: {
  channelSlug: string;
  text: string;
  kind: PostKind;
}): Promise<ChannelPost> {
  if (isDemoMode()) {
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
    };
  }
  const res = await api<{ data: ApiChannelPost }>(`/channels/${input.channelSlug}/posts`, {
    method: "POST",
    json: { text: input.text, kind: input.kind },
  });
  return mapPost(res.data, input.channelSlug);
}

// ---- hooks ----
export function useChannels(): { channels: Channel[]; loading: boolean; reload: () => void } {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetchChannels()
      .then(setChannels)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload]);
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

export function useChannelPosts(slug: string): { posts: ChannelPost[]; loading: boolean; reload: () => void } {
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

export function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
