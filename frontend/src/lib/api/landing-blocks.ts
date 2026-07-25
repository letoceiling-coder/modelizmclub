import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";

export interface LandingCardPublic {
  id: number;
  title: string;
  description: string | null;
  icon: string;
  icon_url?: string | null;
  link_url: string | null;
  post_category_id: number | null;
  listings_count: number;
}

export interface LandingSectionPublic {
  slug: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  cards: LandingCardPublic[];
}

export interface LandingBlocksPublic {
  sections: LandingSectionPublic[];
}

const DEMO_ECOSYSTEM: LandingSectionPublic = {
  slug: "ecosystem",
  eyebrow: "Экосистема для моделистов",
  title: "Что есть в МоДелизМ",
  subtitle: "Шесть инструментов, которые закрывают повседневные задачи моделиста — от покупки детали до участия в гонках.",
  cards: [
    { id: 1, title: "Объявления", description: "Покупка и продажа моделей, запчастей и техники как на Авито.", icon: "Megaphone", link_url: "/ads", post_category_id: null, listings_count: 0 },
    { id: 2, title: "Лента публикаций", description: "Проекты, сборки, фото и видео других моделистов.", icon: "Newspaper", link_url: "/feed", post_category_id: null, listings_count: 0 },
    { id: 3, title: "Сообщества", description: "Клубы по интересам: RC, авиа, суда, электроника.", icon: "Users2", link_url: "/communities", post_category_id: null, listings_count: 0 },
    { id: 4, title: "Каналы", description: "Официальные каналы брендов, магазинов и экспертов.", icon: "Radio", link_url: "/channels", post_category_id: null, listings_count: 0 },
    { id: 5, title: "Мессенджер", description: "Личные и групповые чаты внутри платформы.", icon: "MessageSquare", link_url: "/messenger", post_category_id: null, listings_count: 0 },
    { id: 6, title: "Обзоры", description: "Видеообзоры моделей, сборок и техники от участников сообщества.", icon: "Clapperboard", link_url: "/reviews", post_category_id: null, listings_count: 0 },
  ],
};

const DEMO_DIRECTIONS: LandingSectionPublic = {
  slug: "directions",
  eyebrow: "Направления",
  title: "Всё, что движется и летает",
  subtitle: null,
  cards: [
    { id: 101, title: "Авиация", description: null, icon: "Plane", link_url: "/categories/aviation", post_category_id: null, listings_count: 0 },
    { id: 102, title: "Бронетехника", description: null, icon: "Tank", link_url: "/categories/armor", post_category_id: null, listings_count: 0 },
    { id: 103, title: "Корабли", description: null, icon: "Ship", link_url: "/categories/ships", post_category_id: null, listings_count: 0 },
  ],
};

export async function fetchLandingBlocks(): Promise<LandingBlocksPublic> {
  if (isDemoMode()) {
    return { sections: [DEMO_ECOSYSTEM, DEMO_DIRECTIONS] };
  }
  const res = await api<{ data: LandingBlocksPublic }>("/public/landing-blocks", { auth: false });
  return res.data ?? { sections: [] };
}

export function sectionBySlug(data: LandingBlocksPublic, slug: string): LandingSectionPublic | undefined {
  return data.sections.find((s) => s.slug === slug);
}
