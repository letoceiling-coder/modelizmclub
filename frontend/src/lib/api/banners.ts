import type { Banner } from "@/lib/mock";
import { api } from "./client";

interface ApiBanner {
  id: number;
  placement?: string;
  title?: string | null;
  text?: string | null;
  link_url?: string | null;
  image_url?: string | null;
}

// Стабильный градиент по id — чтобы баннеры без картинки не были одинаковыми.
const GRADIENTS = [
  "from-indigo-600 to-violet-700",
  "from-rose-500 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-blue-700",
  "from-fuchsia-600 to-purple-700",
];

function kindFor(placement?: string): Banner["kind"] {
  if (placement === "events") return "event";
  if (placement === "news") return "news";
  return "promo";
}

function mapBanner(b: ApiBanner): Banner {
  return {
    id: String(b.id),
    title: b.title ?? "",
    text: b.text ?? "",
    cta: "Подробнее",
    until: "",
    color: GRADIENTS[b.id % GRADIENTS.length],
    image: b.image_url ?? undefined,
    link: b.link_url ?? undefined,
    kind: kindFor(b.placement),
  };
}

export async function fetchBanners(placement = "feed"): Promise<Banner[]> {
  const res = await api<{ data: ApiBanner[] }>("/public/banners", {
    query: { placement },
    auth: false,
  });
  return (res.data ?? []).map(mapBanner);
}
