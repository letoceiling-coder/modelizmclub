import type { Ad } from "@/lib/mock";
import { upsertUsers } from "@/lib/mock";
import { hydrateStore, type AdStatusKey } from "@/lib/store";
import { me } from "@/lib/mock";
import { api } from "./client";

interface ApiListing {
  uuid: string;
  title: string;
  description?: string | null;
  price_cents: number;
  currency: string;
  status: string;
  delivery_methods?: string[];
  views_count?: number;
  favorites_count?: number;
  author?: {
    uuid: string;
    display_name?: string | null;
    avatar?: { url?: string | null } | null;
  };
  category?: { name: string } | null;
  subcategory?: { name: string } | null;
  city?: { name: string } | null;
  media?: Array<{ url?: string | null }>;
  created_at: string;
  published_at?: string | null;
}

interface Paginated<T> {
  data: T[];
}

function mapListingStatus(status: string): AdStatusKey {
  switch (status) {
    case "draft":
      return "draft";
    case "pending_moderation":
    case "awaiting_payment":
    case "revision":
      return "moderation";
    case "published":
      return "active";
    case "rejected":
      return "rejected";
    case "unpublished":
      return "unpublished";
    case "sold":
    case "expired":
      return "archived";
    default:
      return "active";
  }
}

export function mapListing(l: ApiListing): { ad: Ad; status: AdStatusKey } {
  const images = (l.media ?? []).map((m) => m.url).filter((u): u is string => Boolean(u));
  const authorName = l.author?.display_name ?? "Продавец";
  if (l.author) {
    upsertUsers([
      {
        id: l.author.uuid,
        name: authorName,
        city: l.city?.name ?? "",
        interests: "",
        avatar: l.author.avatar?.url ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authorName)}`,
      },
    ]);
  }

  const ad: Ad = {
    id: l.uuid,
    title: l.title,
    price: Math.round(l.price_cents / 100),
    category: l.category?.name ?? "",
    subcategory: l.subcategory?.name ?? "",
    city: l.city?.name ?? "",
    image: images[0] ?? "",
    gallery: images.length > 1 ? images : undefined,
    description: l.description ?? undefined,
    delivery: l.delivery_methods ?? [],
    status: "Продаю",
    contact: "messenger",
    authorId: l.author?.uuid ?? me.id,
    views: l.views_count ?? 0,
    likes: l.favorites_count ?? 0,
    createdAt: l.created_at,
    moderation: l.status === "published" ? "published" : l.status === "rejected" ? "rejected" : "moderation",
  };

  return { ad, status: mapListingStatus(l.status) };
}

export async function fetchMyListings(): Promise<{ ads: Ad[]; adStatus: Record<string, AdStatusKey> }> {
  const res = await api<Paginated<ApiListing>>("/users/me/listings?per_page=100");
  const ads: Ad[] = [];
  const adStatus: Record<string, AdStatusKey> = {};
  for (const item of res.data ?? []) {
    const mapped = mapListing(item);
    ads.push(mapped.ad);
    adStatus[mapped.ad.id] = mapped.status;
  }
  return { ads, adStatus };
}

export async function loadMyListingsIntoStore(): Promise<void> {
  try {
    const { ads, adStatus } = await fetchMyListings();
    hydrateStore({ userId: me.id, ads, adStatus });
  } catch {
    // not authenticated — keep empty
  }
}
