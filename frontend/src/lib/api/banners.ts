import type { Banner } from "@/lib/mock";
import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { demoBanners } from "@/lib/demo-data";

export interface BannerCarouselSettings {
  enabled: boolean;
  placement: string;
  autoplay_seconds: number;
  max_slides: number;
}

interface ApiBanner {
  id: number;
  placement?: string;
  title?: string | null;
  text?: string | null;
  link_url?: string | null;
  image_url?: string | null;
  cta_text?: string | null;
  kind?: string | null;
  until_label?: string | null;
  is_pinned?: boolean;
  priority?: number;
  is_active?: boolean;
}

interface BannersResponse {
  data: ApiBanner[];
  meta?: { carousel?: BannerCarouselSettings };
}

const GRADIENTS = [
  "from-indigo-600 to-violet-700",
  "from-rose-500 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-blue-700",
  "from-fuchsia-600 to-purple-700",
];

function kindFor(kind?: string | null, placement?: string): Banner["kind"] {
  if (kind === "event" || kind === "news" || kind === "promo") return kind;
  if (placement === "events") return "event";
  if (placement === "news") return "news";
  return "promo";
}

function mapBanner(b: ApiBanner): Banner {
  return {
    id: String(b.id),
    title: b.title ?? "",
    text: b.text ?? "",
    cta: b.cta_text?.trim() || "Подробнее",
    until: b.until_label?.trim() || "",
    color: GRADIENTS[b.id % GRADIENTS.length],
    image: b.image_url ?? undefined,
    link: b.link_url ?? undefined,
    kind: kindFor(b.kind, b.placement),
    pinned: b.is_pinned ?? false,
    priority: b.priority ?? 0,
    active: b.is_active !== false,
  };
}

export async function fetchBanners(placement?: string): Promise<Banner[]> {
  if (isDemoMode()) return demoBanners();
  const res = await api<BannersResponse>("/public/banners", {
    query: placement ? { placement } : undefined,
    auth: false,
  });
  return (res.data ?? []).map(mapBanner);
}

export async function fetchBannersWithSettings(placement?: string): Promise<{
  banners: Banner[];
  carousel: BannerCarouselSettings;
}> {
  if (isDemoMode()) {
    return {
      banners: demoBanners(),
      carousel: { enabled: true, placement: "events", autoplay_seconds: 10, max_slides: 5 },
    };
  }
  const res = await api<BannersResponse>("/public/banners", {
    query: placement ? { placement } : undefined,
    auth: false,
  });
  return {
    banners: (res.data ?? []).map(mapBanner),
    carousel: res.meta?.carousel ?? {
      enabled: true,
      placement: placement ?? "events",
      autoplay_seconds: 10,
      max_slides: 5,
    },
  };
}

export async function recordBannerEvent(
  bannerId: string,
  event: "impression" | "click",
): Promise<void> {
  if (isDemoMode()) return;
  await api(`/public/banners/${bannerId}/events`, {
    method: "POST",
    json: { event },
    auth: false,
  }).catch(() => {});
}
