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
    const byName = new Map<string, number>();
    const walk = (nodes: ApiCategoryNode[]) => {
      for (const n of nodes) {
        byName.set(n.name, n.id);
        if (n.children) walk(n.children);
      }
    };
    walk(res.data ?? []);
    cache = { categories, byName };
    return categories;
  })().finally(() => { inflight = null; });
  return inflight;
}

export function categoryIdByName(name: string): number | undefined {
  return cache?.byName.get(name);
}

let listingCache: Category[] | null = null;

export async function fetchListingCategories(): Promise<Category[]> {
  if (listingCache) return listingCache;
  if (isDemoMode()) {
    listingCache = demoCategories();
    return listingCache;
  }
  const res = await api<{ data: ApiCategoryNode[] }>("/categories/listings");
  listingCache = (res.data ?? []).map((n) => mapCategory(n, true));
  return listingCache;
}
