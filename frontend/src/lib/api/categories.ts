import type { Category } from "@/lib/mock";
import { api } from "./client";

interface ApiCategoryNode {
  id: number;
  name: string;
  slug?: string;
  icon?: string | null;
  depth?: number;
  children?: ApiCategoryNode[];
}

function mapCategory(node: ApiCategoryNode): Category {
  return {
    id: String(node.id),
    name: node.name,
    description: "",
    icon: node.icon || "Boxes",
    members: 0,
    subcategories: (node.children ?? []).map((c) => ({
      id: String(c.id),
      name: c.name,
    })),
  };
}

let cache: { categories: Category[]; byName: Map<string, number> } | null = null;

export async function fetchPostCategories(): Promise<Category[]> {
  if (cache) return cache.categories;
  const res = await api<{ data: ApiCategoryNode[] }>("/categories/posts");
  const categories = (res.data ?? []).map(mapCategory);
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
}

export function categoryIdByName(name: string): number | undefined {
  return cache?.byName.get(name);
}

let listingCache: Category[] | null = null;

export async function fetchListingCategories(): Promise<Category[]> {
  if (listingCache) return listingCache;
  const res = await api<{ data: ApiCategoryNode[] }>("/categories/listings");
  listingCache = (res.data ?? []).map(mapCategory);
  return listingCache;
}
