/**
 * Отбор каталога объявлений по разделу — в адресе страницы.
 *
 * Раздел каталога до этого жил только в состоянии страницы: выбрать «Авиацию»
 * можно было слева, а сослаться на неё — нечем. Из-за этого крошки на странице
 * объявления («Объявления / Авиация / ил 6») были не ссылками, а текстом.
 *
 * Не `taxonomy_id`: он означает раздел ленты и переводится в каталожный через
 * зеркало (см. `ListingService::list`). Здесь идентификаторы самого каталога —
 * те же, что уходят в запрос как `category_id` / `subcategory_id`.
 */
import type { Category } from "@/lib/mock";

export function parseCatalogId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? n : undefined;
  }
  return undefined;
}

/** Поисковая часть адреса каталога для раздела объявления. */
export function catalogSearchForListing(
  categoryId?: string | number,
  subcategoryId?: string | number,
): { category_id?: number; subcategory_id?: number } {
  const category = parseCatalogId(categoryId);
  if (category === undefined) return {};
  const subcategory = parseCatalogId(subcategoryId);
  return subcategory === undefined
    ? { category_id: category }
    : { category_id: category, subcategory_id: subcategory };
}

/**
 * Подраздел ищется по всему поддереву, а не среди прямых детей: дерево
 * каталога трёхуровневое. «ил 6» лежит под «Планерами», и поиск по первому
 * уровню не находил его — отбор по подразделу терялся при следующем запросе.
 */
type Node = { id: Category["id"]; name: string; children?: Node[] };

function walk(nodes: Node[] | undefined, match: (n: Node) => boolean): Node | null {
  for (const node of nodes ?? []) {
    if (match(node)) return node;
    const inner = walk(node.children, match);
    if (inner) return inner;
  }
  return null;
}

export function findSubcategoryById(category: Category, id: number): Node | null {
  return walk(category.subcategories, (n) => parseCatalogId(n.id) === id);
}

export function findSubcategoryByName(category: Category, name: string): Node | null {
  return walk(category.subcategories, (n) => n.name === name);
}

/**
 * Все подразделы раздела в один список, включая третий уровень.
 *
 * Список в фильтре был по первому уровню детей, а `subcategory_id` у
 * объявления может указывать на внука: «ил 6» лежит под «Планерами». Такое
 * объявление через панель было не найти, а отбор из адреса — не показать.
 * Совпадение по названию, как и раньше: при двух одинаковых именах берётся
 * первое — это поведение панели не меняется.
 */
export function flattenSubcategories(category: Category): Node[] {
  const out: Node[] = [];
  const push = (nodes: Node[] | undefined) => {
    for (const n of nodes ?? []) {
      out.push(n);
      push(n.children);
    }
  };
  push(category.subcategories);
  return out;
}

/**
 * Названия разделов по идентификаторам из адреса. Панель слева, крошки и фишка
 * над списком работают с названиями — этот перевод нужен, чтобы выбранный
 * раздел был виден, а не только учтён в запросе.
 */
export function catalogNamesFromIds(
  categories: Category[],
  categoryId?: number,
  subcategoryId?: number,
): { category: string; subcategory: string } | null {
  if (categoryId === undefined) return null;
  const category = categories.find((c) => parseCatalogId(c.id) === categoryId);
  if (!category) return null;
  const subcategory =
    subcategoryId === undefined ? null : findSubcategoryById(category, subcategoryId);
  return { category: category.name, subcategory: subcategory?.name ?? "Все" };
}
