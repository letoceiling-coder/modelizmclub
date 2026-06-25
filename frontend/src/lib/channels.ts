// Self-contained mini-store for the "Каналы" (Channels) section.
// Channels are one-way publishing surfaces: only owners post, users subscribe.
import { useSyncExternalStore } from "react";

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
  createdAt: string; // ISO
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
}

const KIND_LABEL: Record<ChannelKind, string> = {
  official: "Официальный",
  brand: "Бренд",
  shop: "Магазин",
  author: "Автор",
  expert: "Эксперт",
};

export function kindLabel(k: ChannelKind) {
  return KIND_LABEL[k];
}

const channels: Channel[] = [
  {
    id: "ch-modelizm",
    slug: "modelizm",
    name: "МоДелизМ Форум",
    description: "Официальный канал форума: анонсы, события, новости комьюнити.",
    category: "Сообщество",
    kind: "official",
    avatarColor: "#2563eb",
    bannerColor: "linear-gradient(135deg,#1e3a8a,#2563eb)",
    subscribers: 12480,
    createdAt: "2024-01-15",
    ownerName: "МоДелизМ Форум",
  },
  {
    id: "ch-tamiya",
    slug: "tamiya",
    name: "Tamiya News",
    description: "Новинки, обзоры и спецпредложения от Tamiya.",
    category: "Бренд",
    kind: "brand",
    avatarColor: "#dc2626",
    bannerColor: "linear-gradient(135deg,#7f1d1d,#dc2626)",
    subscribers: 8920,
    createdAt: "2024-03-02",
    ownerName: "Tamiya",
  },
  {
    id: "ch-modelshop",
    slug: "modelshop",
    name: "ModelShop24",
    description: "Скидки, поступления и распродажи в магазине ModelShop24.",
    category: "Магазин",
    kind: "shop",
    avatarColor: "#16a34a",
    bannerColor: "linear-gradient(135deg,#14532d,#16a34a)",
    subscribers: 5230,
    createdAt: "2024-05-20",
    ownerName: "ModelShop24",
  },
  {
    id: "ch-airbrush-pro",
    slug: "airbrush-pro",
    name: "Airbrush Pro",
    description: "Техники аэрографии, обзоры красок и пошаговые уроки.",
    category: "Эксперт",
    kind: "expert",
    avatarColor: "#9333ea",
    bannerColor: "linear-gradient(135deg,#4c1d95,#9333ea)",
    subscribers: 3410,
    createdAt: "2024-06-11",
    ownerName: "Сергей Орлов",
  },
  {
    id: "ch-scale-weekly",
    slug: "scale-weekly",
    name: "Scale Weekly",
    description: "Еженедельный дайджест новинок и обзоров моделей.",
    category: "Автор",
    kind: "author",
    avatarColor: "#ea580c",
    bannerColor: "linear-gradient(135deg,#7c2d12,#ea580c)",
    subscribers: 2140,
    createdAt: "2025-01-08",
    ownerName: "Иван Петров",
  },
  {
    id: "ch-rc-cars",
    slug: "rc-cars",
    name: "RC Cars Russia",
    description: "Радиоуправляемые модели: соревнования, тюнинг, обзоры.",
    category: "Сообщество",
    kind: "author",
    avatarColor: "#0891b2",
    bannerColor: "linear-gradient(135deg,#164e63,#0891b2)",
    subscribers: 6780,
    createdAt: "2024-09-14",
    ownerName: "RC Russia",
  },
  {
    id: "ch-my-workshop",
    slug: "my-workshop",
    name: "Моя мастерская",
    description: "Мой личный канал — делюсь сборками и текущими проектами.",
    category: "Автор",
    kind: "author",
    avatarColor: "#f59e0b",
    bannerColor: "linear-gradient(135deg,#92400e,#f59e0b)",
    subscribers: 142,
    createdAt: "2025-08-01",
    ownerName: "Вы",
    isOwner: true,
  },
];

const posts: ChannelPost[] = [
  {
    id: "p1", channelId: "ch-modelizm", authorName: "МоДелизМ Форум",
    createdAt: "2026-06-21T10:00:00Z", status: "published", likes: 312, views: 4820,
    text: "Открыта регистрация на летнюю выставку моделистов 2026. Подробности и билеты — на сайте форума.",
  },
  {
    id: "p2", channelId: "ch-modelizm", authorName: "МоДелизМ Форум",
    createdAt: "2026-06-18T14:30:00Z", status: "published", likes: 198, views: 2940,
    text: "Новый сезон встреч в регионах. Смотрите расписание и добавляйте свой город.",
  },
  {
    id: "p3", channelId: "ch-tamiya", authorName: "Tamiya",
    createdAt: "2026-06-20T09:00:00Z", status: "published", likes: 540, views: 8120,
    text: "Анонс: новый набор Tamiya 1/24 — Porsche 911 GT3 RS. Старт продаж 1 июля.",
  },
  {
    id: "p4", channelId: "ch-tamiya", authorName: "Tamiya",
    createdAt: "2026-06-15T12:00:00Z", status: "published", likes: 410, views: 6200,
    text: "Спецпредложение: скидка 15% на всю линейку красок Tamiya Acrylic до конца месяца.",
  },
  {
    id: "p5", channelId: "ch-modelshop", authorName: "ModelShop24",
    createdAt: "2026-06-19T11:00:00Z", status: "published", likes: 87, views: 1430,
    text: "Поступление: инструменты Hasegawa Tritool. Количество ограничено.",
  },
  {
    id: "p6", channelId: "ch-airbrush-pro", authorName: "Сергей Орлов",
    createdAt: "2026-06-22T08:15:00Z", status: "published", likes: 124, views: 1890,
    text: "Урок №14: имитация выцветшей краски на бронетехнике — разбираю весь процесс по слоям.",
  },
  {
    id: "p7", channelId: "ch-scale-weekly", authorName: "Иван Петров",
    createdAt: "2026-06-21T18:00:00Z", status: "published", likes: 76, views: 1120,
    text: "Дайджест недели: ТОП-5 анонсов производителей и обзор новой линейки Zvezda.",
  },
  {
    id: "p8", channelId: "ch-rc-cars", authorName: "RC Russia",
    createdAt: "2026-06-20T16:00:00Z", status: "published", likes: 230, views: 3400,
    text: "Итоги этапа Кубка России по RC-багги. Победители, фото и видео заездов внутри.",
  },
  {
    id: "p9", channelId: "ch-my-workshop", authorName: "Вы",
    createdAt: "2026-06-22T09:00:00Z", status: "published", likes: 12, views: 84,
    text: "Закончил покраску корпуса — финальные фото готовой модели в посте.",
  },
  {
    id: "p10", channelId: "ch-my-workshop", authorName: "Вы",
    createdAt: "2026-06-22T11:30:00Z", status: "moderation", likes: 0, views: 0,
    text: "Готовлю обзор нового набора красок — пост уйдёт после проверки модератором.",
  },
  {
    id: "p11", channelId: "ch-my-workshop", authorName: "Вы",
    createdAt: "2026-06-20T20:00:00Z", status: "rejected", likes: 0, views: 0,
    text: "Реклама стороннего магазина — отклонено модератором (нарушение правил).",
  },
];

// --- subscriptions store ---
const SUBS_KEY = "channels:subs:v1";

function loadSubs(): Set<string> {
  if (typeof window === "undefined") return new Set(["ch-modelizm"]);
  try {
    const raw = window.localStorage.getItem(SUBS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set(["ch-modelizm"]);
}

let subs: Set<string> = loadSubs();
const listeners = new Set<() => void>();
let snapshot: ReadonlySet<string> = subs;

function emit() {
  snapshot = new Set(subs);
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(SUBS_KEY, JSON.stringify([...subs])); } catch {}
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useSubscriptions() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export function toggleSubscribe(channelId: string) {
  if (subs.has(channelId)) subs.delete(channelId);
  else subs.add(channelId);
  // adjust mock subscriber count
  const ch = channels.find((c) => c.id === channelId);
  if (ch) ch.subscribers += subs.has(channelId) ? 1 : -1;
  emit();
}

export function isSubscribed(channelId: string) {
  return snapshot.has(channelId);
}

export function getAllChannels(): Channel[] {
  return channels;
}

export function getChannel(id: string): Channel | undefined {
  return channels.find((c) => c.id === id || c.slug === id);
}

// --- posts reactivity ---
const postListeners = new Set<() => void>();
let postsVersion = 0;
function subscribePosts(l: () => void) {
  postListeners.add(l);
  return () => { postListeners.delete(l); };
}
function emitPosts() {
  postsVersion++;
  postListeners.forEach((l) => l());
}

export function useChannelPosts(channelId: string): ChannelPost[] {
  useSyncExternalStore(subscribePosts, () => postsVersion, () => postsVersion);
  return getChannelPosts(channelId);
}

export function getChannelPosts(channelId: string): ChannelPost[] {
  return posts
    .filter((p) => p.channelId === channelId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function createChannelPost(input: {
  channelId: string;
  authorName: string;
  text: string;
  kind: PostKind;
}): ChannelPost {
  const post: ChannelPost = {
    id: `p-${Date.now()}`,
    channelId: input.channelId,
    authorName: input.authorName,
    createdAt: new Date().toISOString(),
    text: input.text,
    status: "moderation",
    likes: 0,
    views: 0,
    kind: input.kind,
  };
  posts.unshift(post);
  emitPosts();
  return post;
}


export function formatCount(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(n);
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
