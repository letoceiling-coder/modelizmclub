import type { Category } from "@/lib/mock";
import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { demoCategories } from "@/lib/demo-data";

interface ApiCategoryNode {
  id: number;
  name: string;
  slug?: string;
  icon?: string | null;
  icon_image_url?: string | null;
  depth?: number;
  listings_count?: number;
  usage_count?: number;
  children?: ApiCategoryNode[];
}

export type CategoryApiNode = ApiCategoryNode;

function mapChild(node: ApiCategoryNode): Category["subcategories"][number] {
  return {
    id: String(node.id),
    name: node.name,
    usageCount: node.usage_count ?? 0,
    children: (node.children ?? []).map(mapChild),
  };
}

function mapCategory(node: ApiCategoryNode, includeListingsCount = false): Category {
  return {
    id: String(node.id),
    name: node.name,
    description: "",
    icon: node.icon || "Boxes",
    iconImageUrl: node.icon_image_url ?? null,
    members: includeListingsCount ? (node.listings_count ?? 0) : 0,
    listingsCount: node.listings_count,
    usageCount: node.usage_count ?? 0,
    subcategories: (node.children ?? []).map(mapChild),
  };
}

let cache: { categories: Category[]; byName: Map<string, number> } | null = null;
let inflight: Promise<Category[]> | null = null;

export async function fetchPostCategories(): Promise<Category[]> {
  if (cache) return cache.categories;
  if (inflight) return inflight;
  inflight = (async () => {
    if (isDemoMode()) {
      const categories = demoCategories();
      const byName = new Map<string, number>();
      categories.forEach((c, i) => byName.set(c.name, i + 1));
      cache = { categories, byName };
      return categories;
    }
    const res = await api<{ data: ApiCategoryNode[] }>("/categories/posts");
    const categories = (res.data ?? []).map((n) => mapCategory(n));
    cache = { categories, byName: indexByName(res.data ?? []) };
    return categories;
  })().finally(() => { inflight = null; });
  return inflight;
}

export function categoryIdByName(name: string): number | undefined {
  return cache?.byName.get(name);
}

export function getCachedPostCategories(): Category[] | null {
  return cache?.categories ?? null;
}

let listingCache: Category[] | null = null;
let listingInflight: Promise<Category[]> | null = null;

function indexByName(nodes: ApiCategoryNode[]): Map<string, number> {
  const byName = new Map<string, number>();
  const walk = (list: ApiCategoryNode[]) => {
    for (const n of list) {
      byName.set(n.name, n.id);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return byName;
}

export function seedPostCategoryTree(nodes: ApiCategoryNode[]): void {
  const categories = (nodes ?? []).map((n) => mapCategory(n));
  cache = { categories, byName: indexByName(nodes ?? []) };
}

export function seedListingCategoryTree(nodes: ApiCategoryNode[]): void {
  listingCache = (nodes ?? []).map((n) => mapCategory(n, true));
}

export function getCachedListingCategories(): Category[] | null {
  return listingCache;
}

export async function fetchListingCategories(): Promise<Category[]> {
  if (listingCache) return listingCache;
  if (listingInflight) return listingInflight;
  listingInflight = (async () => {
    if (isDemoMode()) {
      listingCache = demoCategories();
      return listingCache;
    }
    const res = await api<{ data: ApiCategoryNode[] }>("/categories/listings");
    seedListingCategoryTree(res.data ?? []);
    return listingCache ?? [];
  })().finally(() => { listingInflight = null; });
  return listingInflight;
}
