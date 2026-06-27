// Catalog data: real post categories mapped into the template's Category shape.

import { useEffect, useState } from "react";
import type { Category } from "@/lib/mock";
import { api } from "./client";

interface ApiCategoryNode {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  depth: number;
  sort_order: number;
  children: ApiCategoryNode[];
}

const pascal = (s: string): string =>
  s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");

function mapNode(n: ApiCategoryNode): Category {
  return {
    id: String(n.id),
    name: n.name,
    description: "",
    icon: n.icon ? pascal(n.icon) : "Hash",
    members: 0,
    subcategories: (n.children ?? []).map((c) => ({ id: String(c.id), name: c.name })),
  };
}

export async function fetchPostCategories(): Promise<Category[]> {
  const res = await api<{ data: ApiCategoryNode[] }>(`/categories/posts`);
  return (res.data ?? []).map(mapNode);
}

let cache: Category[] | null = null;
let inflight: Promise<Category[]> | null = null;

export function useCategories(): Category[] {
  const [cats, setCats] = useState<Category[]>(cache ?? []);

  useEffect(() => {
    if (cache) {
      setCats(cache);
      return;
    }
    if (!inflight) {
      inflight = fetchPostCategories()
        .then((c) => {
          cache = c;
          return c;
        })
        .catch(() => []);
    }
    let alive = true;
    void inflight.then((c) => {
      if (alive) setCats(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  return cats;
}
