import type { Category } from "@/lib/mock";
import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";

interface ApiCategoryNode {
  id: number;
  name: string;
  slug?: string;
  icon?: string | null;
  icon_image_url?: string | null;
  depth?: number;
  listings_count?: number;
  usage_count?: number;
  /** Людей в чатах этого узла: у комнаты — свои, у направления — объединение комнат. */
  members_count?: number;
  children?: ApiCategoryNode[];
}

export type CategoryApiNode = ApiCategoryNode;

function mapChild(node: ApiCategoryNode): Category["subcategories"][number] {
  return {
    id: String(node.id),
    // API отдавал slug и раньше, но обе функции разбора его выбрасывали —
    // во фронтенде адреса направлений просто не существовало.
    slug: node.slug ?? String(node.id),
    name: node.name,
    usageCount: node.usage_count ?? 0,
    members: node.members_count ?? 0,
    children: (node.children ?? []).map(mapChild),
  };
}

function mapCategory(node: ApiCategoryNode, includeListingsCount = false): Category {
  return {
    id: String(node.id),
    slug: node.slug ?? String(node.id),
    name: node.name,
    description: "",
    icon: node.icon || "Boxes",
    iconImageUrl: node.icon_image_url ?? null,
    /*
     * Участники — люди в чатах направления, и приходят они с сервера.
     *
     * Раньше здесь стояло `includeListingsCount ? listings_count : 0`: на
     * витрине направлений флаг не ставился, и у всех пятнадцати всегда был
     * ноль, а со флагом в поле «участников» лежало бы число объявлений.
     * Считалось не то и показывалось не там.
     */
    members: node.members_count ?? 0,
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
      const categories = (await import("@/lib/demo-data")).demoCategories();
      const byName = new Map<string, number>();
      categories.forEach((c, i) => byName.set(c.name, i + 1));
      cache = { categories, byName };
      return categories;
    }
    const res = await api<{ data: ApiCategoryNode[] }>("/categories/posts");
    const categories = (res.data ?? []).map((n) => mapCategory(n));
    cache = { categories, byName: indexByName(res.data ?? []) };
    return categories;
  })().finally(() => {
    inflight = null;
  });
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

type NamedNode = {
  id: string;
  name: string;
  subcategories?: NamedNode[];
  children?: NamedNode[];
};

function namedChildren(node: NamedNode): NamedNode[] {
  return node.subcategories ?? node.children ?? [];
}

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase("ru") === b.trim().toLocaleLowerCase("ru");
}

/** Map a selected path between post/listing taxonomy trees by node names. */
export function mapCategorySelectionByName(
  fromTree: Category[],
  toTree: Category[],
  categoryId: string,
  subcategoryId = "",
  nestedId = "",
): { categoryId: string; subcategoryId: string; nestedCategoryId: string } | null {
  const names: string[] = [];
  const l1 = fromTree.find((c) => c.id === categoryId);
  if (!l1) return null;
  names.push(l1.name);
  let cursor: NamedNode = l1;
  if (subcategoryId) {
    const l2 = namedChildren(cursor).find((c) => c.id === subcategoryId);
    if (!l2) return null;
    names.push(l2.name);
    cursor = l2;
  }
  if (nestedId) {
    const l3 = namedChildren(cursor).find((c) => c.id === nestedId);
    if (!l3) return null;
    names.push(l3.name);
  }

  let level: NamedNode[] = toTree;
  const ids: string[] = [];
  for (const name of names) {
    const hit = level.find((n) => namesMatch(n.name, name));
    if (!hit) return null;
    ids.push(hit.id);
    level = namedChildren(hit);
  }
  return {
    categoryId: ids[0] ?? "",
    subcategoryId: ids[1] ?? "",
    nestedCategoryId: ids[2] ?? "",
  };
}

export async function fetchListingCategories(): Promise<Category[]> {
  if (listingCache) return listingCache;
  if (listingInflight) return listingInflight;
  listingInflight = (async () => {
    if (isDemoMode()) {
      listingCache = (await import("@/lib/demo-data")).demoCategories();
      return listingCache;
    }
    const res = await api<{ data: ApiCategoryNode[] }>("/categories/listings");
    seedListingCategoryTree(res.data ?? []);
    return listingCache ?? [];
  })().finally(() => {
    listingInflight = null;
  });
  return listingInflight;
}

/**
 * Направление по адресу: сначала по slug, потом по числовому id.
 *
 * Числовой путь оставлен ради старых ссылок — уведомлений, закладок,
 * внешних переходов. Маршрут по такому адресу отвечает переадресацией на
 * slug (см. beforeLoad в routes/categories.$id.index.tsx), а не рисует
 * страницу: два адреса у одной страницы — это два адреса в поиске и две
 * разные строки в отчётах.
 *
 * Дерево двухуровневое, поэтому ответ плоский: узел найдётся и на верхнем
 * уровне, и среди детей, и вызывающему не нужно знать, где именно.
 */
export interface ResolvedCategory {
  id: string;
  slug: string;
  name: string;
  /** Прямой родитель. null у направления верхнего уровня. */
  parentSlug: string | null;
  /** Цепочка от корня до узла включительно — для хлебных крошек. */
  chain: { id: string; slug: string; name: string }[];
}

export async function resolveCategory(key: string): Promise<ResolvedCategory | null> {
  const categories = await fetchPostCategories();

  /*
   * Обход любой глубины, а не двух уровней.
   *
   * До 10.09 функция перебирала верхний уровень и его детей и на этом
   * останавливалась: дерево держали плоским нарочно. С возвращением третьего
   * уровня («Авиация → Планеры → ИЛ-6») такой перебор перестал находить
   * узел — а от него зависят переадресация с числового адреса и заголовок
   * вкладки. Адрес при этом односегментный, и глубина в нём не выражена:
   * узел опознаётся слугом, который с этой же ветки уникален во всём дереве
   * (миграция `make_category_slugs_globally_unique`).
   */
  const walk = (
    nodes: { id: string; slug?: string; name: string; children?: unknown }[],
    trail: { id: string; slug: string; name: string }[],
  ): ResolvedCategory | null => {
    for (const node of nodes) {
      const slug = node.slug ?? node.id;
      const chain = [...trail, { id: node.id, slug, name: node.name }];

      if (slug === key || node.id === key) {
        return {
          id: node.id,
          slug,
          name: node.name,
          parentSlug: trail.length > 0 ? trail[trail.length - 1].slug : null,
          chain,
        };
      }

      const children = (node as { children?: typeof nodes }).children ?? [];
      const found = walk(children, chain);
      if (found) return found;
    }

    return null;
  };

  for (const top of categories) {
    const topSlug = top.slug ?? top.id;
    const root = { id: top.id, slug: topSlug, name: top.name };

    if (topSlug === key || top.id === key) {
      return { id: top.id, slug: topSlug, name: top.name, parentSlug: null, chain: [root] };
    }

    const found = walk(top.subcategories, [root]);
    if (found) return found;
  }

  return null;
}
