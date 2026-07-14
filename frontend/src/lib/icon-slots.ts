// Конечный реестр переопределяемых иконок ("слотов") + допустимые токены цвета.
// Чистые данные, без side-effects. Категории — динамические слоты (см.
// categorySlotKey), поэтому их нет в ICON_SLOTS; статические слоты (навигация,
// заголовки разделов) перечислены явно.

export type TokenKey =
  | "accent"
  | "foreground"
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "commercial"
  | "neutral"
  | "foreground-70";

export interface IconSlot {
  /** Стабильный ключ. Для статических слотов — "group.name"; для категорий — categorySlotKey(). */
  key: string;
  /** Человекочитаемо для админ-select. */
  label: string;
  group: "nav" | "section" | "category";
  /** Имя lucide-иконки по умолчанию (fallback), см. resolveLucideIcon. */
  defaultLucide: string;
  /** Токен цвета по умолчанию. */
  defaultToken: TokenKey;
}

export const GROUP_LABELS: Record<IconSlot["group"], string> = {
  nav: "Навигация",
  section: "Разделы",
  category: "Категории",
};

// Первый набор статических слотов фазы 2b. Имена lucide взяты из nav.tsx/Sidebar.
// Расширяется по мере надобности — добавление слота не ломает существующие.
export const ICON_SLOTS: IconSlot[] = [
  { key: "nav.feed", label: "Навигация — Лента", group: "nav", defaultLucide: "Newspaper", defaultToken: "foreground-70" },
  { key: "nav.ads", label: "Навигация — Каталог объявлений", group: "nav", defaultLucide: "Megaphone", defaultToken: "foreground-70" },
  { key: "nav.reviews", label: "Навигация — Обзоры", group: "nav", defaultLucide: "Clapperboard", defaultToken: "foreground-70" },
  { key: "nav.channels", label: "Навигация — Каналы", group: "nav", defaultLucide: "Radio", defaultToken: "foreground-70" },
  { key: "nav.messenger", label: "Навигация — Мессенджер", group: "nav", defaultLucide: "MessageCircle", defaultToken: "foreground-70" },
  { key: "nav.friends", label: "Навигация — Друзья", group: "nav", defaultLucide: "Users", defaultToken: "foreground-70" },
  { key: "section.directions", label: "Раздел — Направления", group: "section", defaultLucide: "Compass", defaultToken: "accent" },
  { key: "section.safe-deal", label: "Раздел — Безопасная сделка", group: "section", defaultLucide: "ShieldCheck", defaultToken: "success" },
];

export const TOKEN_OPTIONS: { key: TokenKey; label: string; cssVar: string }[] = [
  { key: "accent", label: "Акцент", cssVar: "var(--accent)" },
  { key: "foreground", label: "Основной текст", cssVar: "var(--foreground)" },
  { key: "foreground-70", label: "Приглушённый текст", cssVar: "var(--foreground-70)" },
  { key: "success", label: "Успех / зелёный", cssVar: "var(--success)" },
  { key: "warning", label: "Предупреждение", cssVar: "var(--warning)" },
  { key: "info", label: "Инфо / синий", cssVar: "var(--info)" },
  { key: "danger", label: "Опасность / красный", cssVar: "var(--danger)" },
  { key: "commercial", label: "Коммерческий / оранжевый", cssVar: "var(--accent-commercial)" },
  { key: "neutral", label: "Нейтральный", cssVar: "var(--neutral-400)" },
];

const TOKEN_CSS_VAR: Record<TokenKey, string> = TOKEN_OPTIONS.reduce(
  (acc, t) => { acc[t.key] = t.cssVar; return acc; },
  {} as Record<TokenKey, string>,
);

export function tokenCssVar(token: TokenKey): string {
  return TOKEN_CSS_VAR[token] ?? "var(--foreground)";
}

export function isTokenKey(v: string): v is TokenKey {
  return v in TOKEN_CSS_VAR;
}

export function categorySlotKey(categoryId: string | number): string {
  return `category:${categoryId}`;
}
