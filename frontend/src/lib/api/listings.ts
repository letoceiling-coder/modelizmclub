import type { Ad, AdSeller, User } from "@/lib/mock";
import { registerUser } from "@/lib/mock";
import { api } from "./client";
import { mapApiUser, type ApiUser } from "./auth";
import type { AdStatusKey } from "@/lib/store";
import { isDemoMode } from "@/lib/demo-mode";
import { demoListings, demoListingsFiltered, demoMyListings, demoListing, demoAddListing } from "@/lib/demo-data";
import { categoryPlaceholder } from "@/lib/placeholder-image";

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

export interface CatalogParams {
  q?: string;
  cityId?: number;
  cityName?: string;
  categoryName?: string;
  subcategoryName?: string;
  priceMin?: number;
  priceMax?: number;
  conditions?: string[];
  deliveries?: string[];
  listingStatus?: string;
  sort?: "new" | "cheap" | "expensive" | "popular";
  withPhotoOnly?: boolean;
  perPage?: number;
  /** 1-based page number, for "load more" pagination. Defaults to 1. */
  page?: number;
}

export async function fetchListings(params: CatalogParams = {}): Promise<Ad[]> {
  if (isDemoMode()) return demoListingsFiltered(params);
  const res = await api<Paginated<ApiListing>>("/listings", {
    query: {
      q: params.q || undefined,
      city_id: params.cityId || undefined,
      price_min: params.priceMin || undefined,
      price_max: params.priceMax || undefined,
      has_media: params.withPhotoOnly ? 1 : undefined,
      per_page: params.perPage ?? 50,
      page: params.page && params.page > 1 ? params.page : undefined,
      sort: params.sort || undefined,
    },
  });
  return (res.data ?? []).map(mapListing);
}

export async function fetchPopularListings(limit = 10): Promise<Ad[]> {
  return fetchListings({ sort: "popular", perPage: limit });
}

export async function fetchFavoriteListings(): Promise<Ad[]> {
  if (isDemoMode()) {
    const ids = readDemoFavoriteIds();
    return demoListingsFiltered({}).filter((a) => ids.includes(a.id));
  }
  const res = await api<Paginated<ApiListing>>("/users/me/favorites", {
    query: { per_page: 100 },
  });
  return (res.data ?? []).map(mapListing);
}

export async function addFavoriteListing(uuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/listings/${uuid}/favorite`, { method: "POST" });
}

export async function removeFavoriteListing(uuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/listings/${uuid}/favorite`, { method: "DELETE" });
}

function readDemoFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem("modelizm_favorite_ads") ?? "[]") as string[];
  } catch {
    return [];
  }
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
    const id = `demo-ad-${Date.now()}`;
    const photos = (input.mediaIds ?? []).filter(Boolean);
    const gallery = photos.length > 0 ? photos : [categoryPlaceholder(id)];
    const demoAd: Ad = {
      id,
      title: input.title,
      price: Math.round(input.priceCents / 100),
      category: "",
      subcategory: "",
      city: "Краснодар",
      image: gallery[0],
      gallery,
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
    demoAddListing(demoAd);
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
