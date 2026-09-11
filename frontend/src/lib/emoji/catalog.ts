/**
 * Каталог смайлов для панели выбора: сборка из данных emojibase и поиск.
 *
 * Здесь только чистые функции — сами данные (≈740 КБ JSON) живут в
 * `dataset.ts` и приезжают отдельным чанком при первом открытии панели,
 * см. `load.ts`.
 */

/** Запись `emojibase-data/ru/compact.json` — только поля, которые нам нужны. */
export interface RawEmoji {
  unicode?: string;
  label?: string;
  group?: number;
  order?: number;
  tags?: string[];
}

/** Запись `groups` из `emojibase-data/ru/messages.json`. */
export interface RawGroupMessage {
  key: string;
  message: string;
  order: number;
}

export interface EmojiEntry {
  unicode: string;
  /** Русское название — оно же aria-label кнопки. */
  label: string;
  /** Название и теги в нижнем регистре, «ё» → «е»: поиск идёт по этой строке. */
  search: string;
  /** Название в том же виде — для ранжирования совпадений. */
  labelKey: string;
}

export interface EmojiCategory {
  key: string;
  name: string;
  /** Смайл на вкладке категории. */
  icon: string;
  items: EmojiEntry[];
}

export interface EmojiCatalog {
  categories: EmojiCategory[];
  /** Все смайлы подряд в порядке категорий — для поиска. */
  all: EmojiEntry[];
  byUnicode: Map<string, EmojiEntry>;
}

/**
 * Модификаторы тона кожи и причёски — не самостоятельные смайлы: вставленные
 * отдельно, они рисуются цветным квадратом.
 */
const EXCLUDED_GROUPS = new Set(["component"]);

const GROUP_ICONS: Record<string, string> = {
  "smileys-emotion": "😀",
  "people-body": "👋",
  "animals-nature": "🐻",
  "food-drink": "🍔",
  "travel-places": "🚗",
  activities: "⚽",
  objects: "💡",
  symbols: "🔣",
  flags: "🏁",
};

export function normalizeEmojiQuery(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export function buildEmojiCatalog(
  emojis: readonly RawEmoji[],
  groups: readonly RawGroupMessage[],
): EmojiCatalog {
  const ordered = [...groups]
    .filter((g) => !EXCLUDED_GROUPS.has(g.key))
    .sort((a, b) => a.order - b.order);

  // Номер группы в compact.json — это `order` группы в messages.json.
  const byGroup = new Map<number, EmojiCategory>();
  const categories = ordered.map((g) => {
    const category: EmojiCategory = {
      key: g.key,
      name: capitalize(g.message),
      icon: GROUP_ICONS[g.key] ?? "",
      items: [],
    };
    byGroup.set(g.order, category);
    return category;
  });

  const sorted = emojis
    .filter((e) => e.unicode && e.group !== undefined)
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));

  const byUnicode = new Map<string, EmojiEntry>();
  for (const e of sorted) {
    const category = byGroup.get(e.group as number);
    if (!category) continue;
    const unicode = e.unicode as string;
    if (byUnicode.has(unicode)) continue;
    const label = e.label ?? "";
    const labelKey = normalizeEmojiQuery(label);
    const entry: EmojiEntry = {
      unicode,
      label,
      labelKey,
      search: normalizeEmojiQuery([label, ...(e.tags ?? [])].join(" ")),
    };
    category.items.push(entry);
    byUnicode.set(unicode, entry);
  }

  for (const category of categories) {
    if (!category.icon) category.icon = category.items[0]?.unicode ?? "";
  }

  const filled = categories.filter((c) => c.items.length > 0);
  return { categories: filled, all: filled.flatMap((c) => c.items), byUnicode };
}

/** Верхняя граница выдачи: односимвольный запрос совпадает с сотнями смайлов. */
export const EMOJI_SEARCH_LIMIT = 400;

/**
 * Поиск по названию и тегам, без учёта регистра и разницы «е»/«ё».
 * Несколько слов — должны совпасть все. Сначала те, чьё название начинается
 * с запроса, затем те, где с него начинается слово названия, затем
 * совпадения внутри названия, затем — только по тегам.
 */
export function searchEmojis(
  entries: readonly EmojiEntry[],
  query: string,
  limit = EMOJI_SEARCH_LIMIT,
): EmojiEntry[] {
  const q = normalizeEmojiQuery(query);
  if (!q) return [];
  const tokens = q.split(/\s+/);
  const first = tokens[0];

  const ranked: { entry: EmojiEntry; rank: number; index: number }[] = [];
  entries.forEach((entry, index) => {
    if (!tokens.every((t) => entry.search.includes(t))) return;
    const label = entry.labelKey;
    const rank = label.startsWith(q)
      ? 0
      : label.split(/\s+/).some((w) => w.startsWith(first))
        ? 1
        : label.includes(first)
          ? 2
          : 3;
    ranked.push({ entry, rank, index });
  });

  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return ranked.slice(0, limit).map((r) => r.entry);
}
