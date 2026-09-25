import type { Community } from "@/lib/mock";

/**
 * Отбор сообществ: текст, категория, город (C6).
 *
 * Отдельным модулем, потому что это единственная часть отбора, которую
 * можно проверить без браузера. Работает по уже загруженному списку — так
 * же, как работал поиск до C6: страница просит пятьдесят сообществ одним
 * запросом и отбирает на месте, поэтому фильтр всегда показывает ровно то,
 * что в списке, и не спорит с ним.
 */

export interface CommunityFilter {
  /** Поисковая строка; пустая — не отбирает. */
  query: string;
  /** Идентификатор категории; null — любая. */
  categoryId: number | null;
  /** Идентификатор города; null — любой. Сообщества без города при
   *  выбранном городе не показываются — у них города нет вовсе. */
  cityId: number | null;
}

export const ПУСТОЙ_ОТБОР: CommunityFilter = { query: "", categoryId: null, cityId: null };

/** Выбран ли хоть один отбор — от этого зависит, что писать на пустой выдаче. */
export function isFiltering(filter: CommunityFilter): boolean {
  return filter.query.trim().length > 0 || filter.categoryId !== null || filter.cityId !== null;
}

/**
 * Города, встречающиеся в списке.
 *
 * Отдельного справочника не заводим: предлагать город, в котором нет ни
 * одного сообщества, значит показывать отбор, дающий пустоту.
 */
export function citiesOf(items: Community[]): Array<{ id: number; name: string }> {
  const найденные = new Map<number, string>();
  for (const c of items) {
    if (c.city) найденные.set(c.city.id, c.city.name);
  }

  return [...найденные]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

/** Категории, встречающиеся в списке. Без идентификатора категорию отобрать нечем. */
export function categoriesOf(items: Community[]): Array<{ id: number; name: string }> {
  const найденные = new Map<number, string>();
  for (const c of items) {
    if (c.categoryId != null && c.category) найденные.set(c.categoryId, c.category);
  }

  return [...найденные]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function applyCommunityFilter(items: Community[], filter: CommunityFilter): Community[] {
  const строка = filter.query.trim().toLowerCase();

  return items.filter((c) => {
    /*
     * Сообщество, у которого категория записана своими словами
     * (`custom_category`), приходит без `categoryId` и в отбор по
     * категории не попадает: отбирать его нечем. В списке вариантов его
     * категории тоже нет — иначе выбор вёл бы в пустоту.
     */
    if (filter.categoryId !== null && c.categoryId !== filter.categoryId) return false;
    if (filter.cityId !== null && (c.city?.id ?? null) !== filter.cityId) return false;
    if (строка === "") return true;

    // Город ищется и строкой тоже: иначе «Москва» в поиске и «Москва» в
    // отборе отвечали бы по-разному на одинаково выглядящий вопрос.
    return (
      c.name.toLowerCase().includes(строка) ||
      c.category.toLowerCase().includes(строка) ||
      c.description.toLowerCase().includes(строка) ||
      (c.city?.name ?? "").toLowerCase().includes(строка)
    );
  });
}

/**
 * Убрать из отбора то, чего в списке больше нет.
 *
 * Список перезапрашивается при смене направления в адресе и после
 * удаления сообщества, а выбранные значения живут в состоянии страницы и
 * переживают это. Останься выбранным город, которого в новом списке нет,
 * — поле нарисуется пустым, выдача будет пустой, а причина не названа
 * нигде. Если при этом пропадут и сами списки вариантов, исчезнет и
 * кнопка сброса: выйти можно будет только перезагрузкой.
 */
export function reconcileFilter(filter: CommunityFilter, items: Community[]): CommunityFilter {
  const категории = new Set(categoriesOf(items).map((c) => c.id));
  const города = new Set(citiesOf(items).map((c) => c.id));

  const categoryId =
    filter.categoryId !== null && категории.has(filter.categoryId) ? filter.categoryId : null;
  const cityId = filter.cityId !== null && города.has(filter.cityId) ? filter.cityId : null;

  if (categoryId === filter.categoryId && cityId === filter.cityId) return filter;

  return { ...filter, categoryId, cityId };
}

/**
 * Что сказать на пустой выдаче.
 *
 * Совет «измените запрос» при пустой строке поиска относится к тому,
 * чего человек не делал: он выбрал город. Разводим по тому, что задано
 * на самом деле, а не по тому, что задан хоть какой-то отбор.
 */
export type EmptyReason = "query" | "filters" | "none";

export function emptyReason(filter: CommunityFilter): EmptyReason {
  if (filter.query.trim().length > 0) return "query";
  if (filter.categoryId !== null || filter.cityId !== null) return "filters";

  return "none";
}
