import type { Ad, AdSeller, User } from "@/lib/mock";
import { registerUser } from "@/lib/mock";
import { api } from "./client";
import { mapApiUser, type ApiUser } from "./auth";
import type { AdStatusKey } from "@/lib/store";
import { isDemoMode } from "@/lib/demo-mode";
import { demoListings, demoMyListings, demoListing } from "@/lib/demo-data";

interface ApiListingAuthor {
  id?: number;
  uuid: string;
  display_name?: string | null;
  slug?: string | null;
  avatar?: { url?: string | null } | null;
}

interface ApiListing {
  uuid: string;
  title: string;
  slug?: string;
  description?: string | null;
  price_cents?: number;
  currency?: string;
  status?: string;
  delivery_methods?: string[];
  contact_via_messenger?: boolean;
  views_count?: number;
  favorites_count?: number;
  author?: ApiListingAuthor | null;
  category?: { id?: number; name?: string; slug?: string } | null;
  subcategory?: { id?: number; name?: string; slug?: string } | null;
  city?: { id?: number; name?: string } | null;
  media?: Array<{ uuid?: string; url?: string | null }>;
  published_at?: string | null;
  created_at?: string;
}

interface Paginated<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

function registerAuthor(a?: ApiListingAuthor | null): User | null {
  if (!a?.uuid) return null;
  const user = mapApiUser({
    uuid: a.uuid,
    name: a.display_name ?? undefined,
    profile: { display_name: a.display_name, slug: a.slug, avatar: a.avatar ?? null },
  } as ApiUser);
  registerUser(user);
  return user;
}

export function mapListingStatus(status?: string): AdStatusKey {
  switch (status) {
    case "published":
      return "active";
    case "draft":
      return "draft";
    case "pending_moderation":
    case "awaiting_payment":
      return "moderation";
    case "rejected":
    case "revision":
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

export function mapListing(l: ApiListing): Ad {
  const author = registerAuthor(l.author);
  const gallery = (l.media ?? [])
    .map((m) => m.url)
    .filter((u): u is string => Boolean(u));
  const seller: AdSeller | undefined = author
    ? { id: author.id, numericId: l.author?.id ?? undefined, name: author.name, avatar: author.avatar, rating: 0, deals: 0, since: "" }
    : undefined;
  return {
    id: l.uuid,
    title: l.title,
    price: Math.round((l.price_cents ?? 0) / 100),
    category: l.category?.name ?? "",
    subcategory: l.subcategory?.name ?? "",
    city: l.city?.name ?? "",
    image: gallery[0] ?? "",
    gallery,
    description: l.description ?? undefined,
    delivery: l.delivery_methods ?? [],
    status: "Продаю",
    contact: l.contact_via_messenger ? "Написать в мессенджере" : "",
    authorId: author?.id ?? "",
    seller,
    views: l.views_count ?? 0,
    likes: l.favorites_count ?? 0,
    createdAt: l.published_at ?? l.created_at ?? undefined,
    moderation:
      l.status === "published"
        ? "published"
        : l.status === "rejected" || l.status === "revision"
          ? "rejected"
          : "moderation",
  };
}

export async function fetchListings(query?: string): Promise<Ad[]> {
  if (isDemoMode()) return demoListings(query);
  const res = await api<Paginated<ApiListing>>("/listings", {
    query: { q: query || undefined, per_page: 50 },
  });
  return (res.data ?? []).map(mapListing);
}

export async function fetchMyListings(): Promise<{ ad: Ad; status: AdStatusKey }[]> {
  if (isDemoMode()) return demoMyListings();
  const res = await api<Paginated<ApiListing>>("/users/me/listings", {
    query: { per_page: 100 },
  });
  return (res.data ?? []).map((l) => ({ ad: mapListing(l), status: mapListingStatus(l.status) }));
}

export async function fetchListing(uuid: string): Promise<Ad> {
  if (isDemoMode()) {
    const ad = demoListing(uuid);
    if (ad) return ad;
    throw new Error("Listing not found");
  }
  const res = await api<{ data: ApiListing }>(`/listings/${uuid}`);
  return mapListing(res.data);
}

export async function publishListing(uuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/listings/${uuid}/publish`, { method: "POST" });
}

export async function archiveListing(uuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/listings/${uuid}/archive`, { method: "POST" });
}

export async function deleteListing(uuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/listings/${uuid}`, { method: "DELETE" });
}

export interface CreateListingInput {
  title: string;
  description: string;
  priceCents: number;
  categoryId: number;
  subcategoryId?: number;
  cityId?: number;
  deliveryMethods?: string[];
  mediaIds?: string[];
  publish?: boolean;
}

export async function createListing(input: CreateListingInput): Promise<Ad> {
  if (isDemoMode()) {
    const demoAd: Ad = {
      id: `demo-ad-${Date.now()}`,
      title: input.title,
      price: Math.round(input.priceCents / 100),
      category: "",
      subcategory: "",
      city: "Краснодар",
      image: "https://picsum.photos/seed/demo-new-ad/1200/900",
      gallery: ["https://picsum.photos/seed/demo-new-ad/1200/900"],
      description: input.description,
      delivery: input.deliveryMethods ?? [],
      status: "Продаю",
      contact: "Написать в мессенджере",
      authorId: "u1",
      views: 0,
      likes: 0,
      createdAt: "только что",
      moderation: input.publish === false ? "moderation" : "published",
    };
    return demoAd;
  }
  const res = await api<{ data: ApiListing }>("/listings", {
    method: "POST",
    json: {
      title: input.title,
      description: input.description,
      price_cents: input.priceCents,
      category_id: input.categoryId,
      subcategory_id: input.subcategoryId,
      city_id: input.cityId,
      delivery_methods: input.deliveryMethods ?? [],
      media_ids: input.mediaIds ?? [],
      publish: input.publish ?? true,
    },
  });
  return mapListing(res.data);
}
