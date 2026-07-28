// Конечный реестр переопределяемых иконок ("слотов") + допустимые токены цвета.
// Чистые данные, без side-effects. Категории и карточки лендинга — динамические слоты.

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

export type IconPage = "landing" | "navigation" | "feed" | "global";

export type IconSlotGroup = "nav" | "section" | "category" | "header" | "landing" | "ui" | "feed";

export type IconPreviewKind = "nav" | "category" | "landing" | "value" | "header" | "faq";

export interface IconSlot {
  key: string;
  label: string;
  group: IconSlotGroup;
  page: IconPage;
  defaultLucide: string;
  defaultToken: TokenKey;
  /** false для PNG-иллюстраций (цвет не перекрашивается) */
  supportsRecolor?: boolean;
  previewKind?: IconPreviewKind;
}

export const PAGE_LABELS: Record<IconPage, string> = {
  landing: "Главная страница",
  navigation: "Навигация",
  feed: "Лента",
  global: "Общее",
};

export const GROUP_LABELS: Record<IconSlotGroup, string> = {
  nav: "Боковое меню и таб-бар",
  header: "Шапка сайта",
  section: "Разделы",
  category: "Направления",
  landing: "Главная",
  ui: "Элементы интерфейса",
  feed: "Лента",
};

export const ICON_SLOTS: IconSlot[] = [
  { key: "nav.feed", label: "Лента", group: "nav", page: "navigation", defaultLucide: "Newspaper", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.ads", label: "Каталог объявлений", group: "nav", page: "navigation", defaultLucide: "Megaphone", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.ad-create", label: "Разместить объявление", group: "nav", page: "navigation", defaultLucide: "Plus", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.my-ads", label: "Мои объявления", group: "nav", page: "navigation", defaultLucide: "ClipboardList", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.favorites", label: "Избранное", group: "nav", page: "navigation", defaultLucide: "Heart", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.communities", label: "Сообщества", group: "nav", page: "navigation", defaultLucide: "Users2", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.reviews", label: "Обзоры", group: "nav", page: "navigation", defaultLucide: "Clapperboard", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.channels", label: "Каналы", group: "nav", page: "navigation", defaultLucide: "Radio", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.messenger", label: "Мессенджер", group: "nav", page: "navigation", defaultLucide: "MessageSquare", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.friends", label: "Друзья", group: "nav", page: "navigation", defaultLucide: "UserPlus", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.profile", label: "Профиль (меню пользователя)", group: "nav", page: "navigation", defaultLucide: "User", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.settings", label: "Настройки", group: "nav", page: "navigation", defaultLucide: "Settings", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.subscription", label: "Подписка", group: "nav", page: "navigation", defaultLucide: "Crown", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.market", label: "Маркет", group: "nav", page: "navigation", defaultLucide: "ShoppingBag", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.feedback", label: "Обратная связь", group: "nav", page: "navigation", defaultLucide: "MessageSquarePlus", defaultToken: "foreground-70", previewKind: "nav" },
  { key: "nav.admin", label: "Админ-панель (меню)", group: "nav", page: "navigation", defaultLucide: "ShieldCheck", defaultToken: "foreground-70", previewKind: "nav" },

  { key: "header.notifications", label: "Уведомления", group: "header", page: "navigation", defaultLucide: "Bell", defaultToken: "foreground-70", previewKind: "header" },
  { key: "header.favorites", label: "Избранное (шапка)", group: "header", page: "navigation", defaultLucide: "Heart", defaultToken: "foreground-70", previewKind: "header" },
  { key: "header.messenger", label: "Мессенджер (шапка)", group: "header", page: "navigation", defaultLucide: "MessageSquare", defaultToken: "foreground-70", previewKind: "header" },

  { key: "landing.value:focus", label: "«Только моделизм»", group: "landing", page: "landing", defaultLucide: "Target", defaultToken: "accent", previewKind: "value", supportsRecolor: true },
  { key: "landing.value:community", label: "«Живое сообщество»", group: "landing", page: "landing", defaultLucide: "HeartHandshake", defaultToken: "accent", previewKind: "value", supportsRecolor: true },
  { key: "landing.value:allInOne", label: "«Всё в одном месте»", group: "landing", page: "landing", defaultLucide: "LayoutGrid", defaultToken: "accent", previewKind: "value", supportsRecolor: true },
  { key: "landing.value:direct", label: "«Прямое общение»", group: "landing", page: "landing", defaultLucide: "Send", defaultToken: "accent", previewKind: "value", supportsRecolor: true },

  { key: "ui.faq.expand", label: "FAQ — раскрытие", group: "ui", page: "landing", defaultLucide: "Plus", defaultToken: "foreground-70", previewKind: "faq" },

  { key: "feed.find-people", label: "«Найди своих» — заголовок", group: "feed", page: "feed", defaultLucide: "Users", defaultToken: "accent", previewKind: "nav" },

  { key: "section.safe-deal", label: "Безопасная сделка", group: "section", page: "global", defaultLucide: "ShieldCheck", defaultToken: "success" },
];

export function navSlotKey(section: string): string {
  return `nav.${section}`;
}

export function categorySlotKey(categoryId: string | number): string {
  return `category:${categoryId}`;
}

export function landingCardSlotKey(cardId: string | number): string {
  return `landing.card:${cardId}`;
}

export function landingValueSlotKey(key: string): string {
  return `landing.value:${key}`;
}

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

const SLOT_BY_KEY: Record<string, IconSlot> = ICON_SLOTS.reduce(
  (acc, s) => { acc[s.key] = s; return acc; },
  {} as Record<string, IconSlot>,
);

export function getIconSlot(key: string): IconSlot | undefined {
  return SLOT_BY_KEY[key];
}

/** Admin tree entry — static or dynamic slot with display metadata. */
export interface AdminIconSlotEntry {
  key: string;
  label: string;
  page: IconPage;
  group: IconSlotGroup;
  defaultLucide: string;
  defaultToken: TokenKey;
  supportsRecolor: boolean;
  previewKind: IconPreviewKind;
  /** For landing cards — DB default icon_url */
  defaultImageUrl?: string | null;
}

export function buildAdminSlotEntries(opts: {
  categories: { id: string; name: string; icon?: string; iconImageUrl?: string | null }[];
  landingCards: { id: number; title: string; icon: string; icon_url?: string | null; section_slug: string }[];
}): AdminIconSlotEntry[] {
  const staticEntries: AdminIconSlotEntry[] = ICON_SLOTS.map((s) => ({
    key: s.key,
    label: s.label,
    page: s.page,
    group: s.group,
    defaultLucide: s.defaultLucide,
    defaultToken: s.defaultToken,
    supportsRecolor: s.supportsRecolor !== false,
    previewKind: s.previewKind ?? "nav",
  }));

  const categoryEntries: AdminIconSlotEntry[] = opts.categories.map((c) => ({
    key: categorySlotKey(c.id),
    label: c.name,
    page: "feed" as IconPage,
    group: "category" as IconSlotGroup,
    defaultLucide: c.icon || "Boxes",
    defaultToken: "accent" as TokenKey,
    supportsRecolor: Boolean(!c.iconImageUrl),
    previewKind: "category" as IconPreviewKind,
    defaultImageUrl: c.iconImageUrl ?? null,
  }));

  const landingEntries: AdminIconSlotEntry[] = opts.landingCards.map((card) => ({
    key: landingCardSlotKey(card.id),
    label: `${card.title} (${card.section_slug})`,
    page: "landing" as IconPage,
    group: "landing" as IconSlotGroup,
    defaultLucide: card.icon || "Box",
    defaultToken: "accent" as TokenKey,
    supportsRecolor: !card.icon_url,
    previewKind: "landing" as IconPreviewKind,
    defaultImageUrl: card.icon_url ?? null,
  }));

  return [...staticEntries, ...landingEntries, ...categoryEntries];
}
