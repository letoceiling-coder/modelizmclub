import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Inbox, Eye, Heart, TrendingUp, MessageCircle, X, Filter, RotateCcw, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ReducedMotionSwitch } from "@/components/ui/reduced-motion-switch";
import { type Ad, type AdCondition } from "@/lib/mock";
import { type AdStatusKey } from "@/lib/store";
import { fetchMyListings, publishListing, archiveListing, deleteListing, restoreListing } from "@/lib/api/listings";
import { MyAdCard, type MyAdStatus } from "@/components/MyAdCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const Route = createFileRoute("/my-ads")({
  head: () => ({ meta: [{ title: "Мои объявления — МоДелизМ" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    await requireAuth(location);
  },
  component: MyAdsPage,
});

type TabKey = "active" | "moderation" | "rejected" | "unpublished" | "archived" | "deleted" | "draft";

const TABS: { key: TabKey; label: string }[] = [
  { key: "active",       label: "Активные" },
  { key: "moderation",   label: "На модерации" },
  { key: "rejected",     label: "С ошибками" },
  { key: "unpublished",  label: "Неопубликованные" },
  { key: "archived",     label: "Архив" },
  { key: "deleted",      label: "Удалённые" },
  { key: "draft",        label: "Черновики" },
];

function statusToTab(s: AdStatusKey): TabKey {
  // map store status → tab key (1:1, both use same labels)
  return s as TabKey;
}

type SortKey = "new" | "old" | "views" | "likes" | "price_asc" | "price_desc" | "updated";
type DateRange = "all" | "today" | "7d" | "30d";
type QuickChip = "all" | "new" | "used" | "delivery";
type ConditionFilter = "all" | AdCondition;
type DeliveryFilter = "all" | "yes" | "no";
type PhotoFilter = "all" | "yes" | "no";

interface Filters {
  category: string;
  city: string;
  condition: ConditionFilter;
  delivery: DeliveryFilter;
  hasPhoto: PhotoFilter;
  dateRange: DateRange;
  priceMin: number;
  priceMax: number;
  sort: SortKey;
}

const DEFAULT_FILTERS: Filters = {
  category: "all",
  city: "all",
  condition: "all",
  delivery: "all",
  hasPhoto: "all",
  dateRange: "all",
  priceMin: 0,
  priceMax: 0,
  sort: "new",
};

const QUICK_CHIPS: { key: QuickChip; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "new", label: "Новые" },
  { key: "used", label: "Б/У" },
  { key: "delivery", label: "Есть доставка" },
];

function MyAdsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("active");
  const [items, setItems] = useState<{ ad: Ad; status: AdStatusKey }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");

  const applyQuickChip = (chip: QuickChip) => {
    if (chip === "all") {
      setFilters(DEFAULT_FILTERS);
      return;
    }
    setFilters((f) => ({
      ...DEFAULT_FILTERS,
      sort: f.sort,
      ...(chip === "new" ? { dateRange: "7d" as const } : {}),
      ...(chip === "used" ? { condition: "Б/у" as const } : {}),
      ...(chip === "delivery" ? { delivery: "yes" as const } : {}),
    }));
  };

  const activeQuickChip = useMemo((): QuickChip => {
    const isBase = filters.category === "all"
      && filters.city === "all"
      && filters.hasPhoto === "all"
      && filters.priceMin === 0
      && filters.priceMax === 0
      && filters.sort === "new";

    if (!isBase) return "all";
    if (filters.dateRange === "7d" && filters.condition === "all" && filters.delivery === "all") return "new";
    if (filters.condition === "Б/у" && filters.delivery === "all" && filters.dateRange === "all") return "used";
    if (filters.delivery === "yes" && filters.condition === "all" && filters.dateRange === "all") return "delivery";
    return "all";
  }, [filters]);

  useEffect(() => {
    fetchMyListings()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const setLocalStatus = (id: string, status: AdStatusKey) =>
    setItems((prev) => prev.map((x) => (x.ad.id === id ? { ...x, status } : x)));
  const doArchive = (id: string) => {
    setLocalStatus(id, "archived");
    archiveListing(id).catch(() => {});
  };
  const doPublish = (id: string) => {
    setLocalStatus(id, "active");
    publishListing(id).catch(() => {});
  };
  const doDelete = (id: string) => {
    setLocalStatus(id, "deleted");
    deleteListing(id).catch(() => {
      fetchMyListings().then(setItems).catch(() => {});
    });
  };
  const doRestore = (id: string) => {
    restoreListing(id)
      .then(() => fetchMyListings().then(setItems))
      .catch(() => fetchMyListings().then(setItems).catch(() => {}));
  };

  const decorated = items;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const { ad } of decorated) if (ad.category) set.add(ad.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [decorated]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const { ad } of decorated) if (ad.city) set.add(ad.city);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [decorated]);

  // Counts derived from store
  const counts = useMemo<Record<TabKey, number>>(() => {
    const c: Record<TabKey, number> = { active: 0, moderation: 0, rejected: 0, unpublished: 0, archived: 0, deleted: 0, draft: 0 };
    for (const { status } of decorated) c[statusToTab(status)] = (c[statusToTab(status)] ?? 0) + 1;
    return c;
  }, [decorated]);

  const filtersDirty = useMemo(
    () =>
      filters.category !== "all"
      || filters.city !== "all"
      || filters.condition !== "all"
      || filters.delivery !== "all"
      || filters.hasPhoto !== "all"
      || filters.dateRange !== "all"
      || filters.priceMin > 0
      || filters.priceMax > 0
      || filters.sort !== "new",
    [filters],
  );

  const visible = useMemo(() => {
    const now = Date.now();
    const rangeMs: Record<DateRange, number> = {
      all: Infinity,
      today: 24 * 3600 * 1000,
      "7d": 7 * 24 * 3600 * 1000,
      "30d": 30 * 24 * 3600 * 1000,
    };
    const q = query.trim().toLowerCase();
    const filtered = decorated.filter(({ ad, status }) => {
      if (statusToTab(status) !== tab) return false;
      if (filters.category !== "all" && ad.category !== filters.category) return false;
      if (filters.city !== "all" && ad.city !== filters.city) return false;
      if (filters.condition !== "all" && ad.condition !== filters.condition) return false;
      if (filters.delivery === "yes" && !(ad.delivery?.length)) return false;
      if (filters.delivery === "no" && (ad.delivery?.length ?? 0) > 0) return false;
      const hasPhoto = Boolean(ad.image || ad.gallery?.length);
      if (filters.hasPhoto === "yes" && !hasPhoto) return false;
      if (filters.hasPhoto === "no" && hasPhoto) return false;
      if (filters.priceMin > 0 && ad.price < filters.priceMin) return false;
      if (filters.priceMax > 0 && ad.price > filters.priceMax) return false;
      if (filters.dateRange !== "all") {
        const ts = ad.publishedAt ? Date.parse(ad.publishedAt) : NaN;
        if (!isFinite(ts) || now - ts > rangeMs[filters.dateRange]) return false;
      }
      if (q && !ad.title.toLowerCase().includes(q)) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const ta = Date.parse(a.ad.publishedAt ?? "0");
      const tb = Date.parse(b.ad.publishedAt ?? "0");
      switch (filters.sort) {
        case "old": return ta - tb;
        case "views": return (b.ad.views ?? 0) - (a.ad.views ?? 0);
        case "likes": return (b.ad.likes ?? 0) - (a.ad.likes ?? 0);
        case "price_asc": return a.ad.price - b.ad.price;
        case "price_desc": return b.ad.price - a.ad.price;
        case "updated": return tb - ta;
        default: return tb - ta;
      }
    });
    return sorted.map((x) => ({ ad: x.ad, status: statusToMyAdStatus(x.status) }));
  }, [decorated, tab, filters, query]);

  // Aggregate stats from active ads
  const stats = useMemo(() => {
    const active = decorated.filter(({ status }) => status === "active");
    const views = active.reduce((s, x) => s + (x.ad.views ?? 0), 0);
    const likes = active.reduce((s, x) => s + (x.ad.likes ?? 0), 0);
    // Sum of active listings' sticker prices — the value on sale, NOT
    // earnings/revenue (kept honestly named so nobody re-surfaces it as income).
    const activeValue = active.reduce((s, x) => s + x.ad.price, 0);
    return { count: active.length, views, likes, activeValue };
  }, [decorated]);

  const handleCreate = () => navigate({ to: "/ads/new" });
  const handleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());
  const archiveSelected = () => { selected.forEach((id) => doArchive(id)); clearSelection(); };
  const deleteSelected = () => { selected.forEach((id) => doDelete(id)); clearSelection(); };
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <AppLayout rightColumn={false} footer>
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-[20px]">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-[12px]">
          <div className="min-w-0">
            <h1 className="font-display text-[20px] font-bold leading-[1.15] sm:text-[28px]" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Мои объявления
            </h1>
            <p className="mt-[4px] text-[12.5px] sm:text-[14px]" style={{ color: "var(--foreground-70)" }}>
              Управляйте публикациями, статистикой и архивом
            </p>
          </div>

          <Button
            onClick={handleCreate}
            size="lg"
            className="hidden rounded-[var(--r-button)] md:inline-flex"
          >
            <Plus size={16} /> Разместить объявление
          </Button>
        </header>

        {/* Stats — 2x2 grid on mobile (was a horizontal-scroll strip that hid
            cards off-screen without any swipe affordance), 4-across on sm+. */}
        <section className="grid grid-cols-2 gap-[8px] sm:grid-cols-4 sm:gap-[12px]">
          <StatCard icon={<TrendingUp size={14} />} label="Активных"   value={stats.count.toString()} accent />
          <StatCard icon={<Eye size={14} />}        label="Просмотров" value={stats.views.toLocaleString("ru")} />
          <StatCard icon={<Heart size={14} />}      label="Лайков"     value={stats.likes.toLocaleString("ru")} />
          {/* "Стоимость" — сумма ценников активных объявлений, НЕ выручка.
              Раньше называлось "Сумма", что читалось как "заработано".
              Продавец не должен думать, что заработал то, чего не заработал
              (реальной монетизации/дохода в системе пока нет). */}
          <StatCard icon={<MessageCircle size={14} />} label="На продаже" value={`${stats.activeValue.toLocaleString("ru")} ₽`} />
        </section>

        {/* Status tabs — equal-width grid, no horizontal scroll */}
        <nav
          className="sticky top-0 z-10 grid w-full grid-cols-7 gap-px py-[6px]"
          style={{ background: "var(--background)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border)" }}
          role="tablist"
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = counts[t.key];
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className="relative flex min-w-0 flex-col items-center justify-end gap-[2px] px-[2px] py-[8px] text-center text-[10px] font-semibold leading-[1.15] transition-colors sm:flex-row sm:justify-center sm:gap-[4px] sm:px-[4px] sm:text-[11px] md:px-[6px] md:text-[12px] lg:text-[13px]"
                style={{ color: active ? "var(--accent)" : "var(--foreground-50)" }}
              >
                <span className="max-w-full whitespace-normal">{t.label}</span>
                <span
                  className="inline-flex h-[16px] min-w-[16px] shrink-0 items-center justify-center px-[4px] text-[9px] font-bold sm:h-[18px] sm:min-w-[18px] sm:text-[10px]"
                  style={{
                    background: active ? "var(--accent-soft)" : "var(--background-surface)",
                    color: active ? "var(--accent)" : "var(--foreground-50)",
                    borderRadius: "var(--r-pill)",
                  }}
                >
                  {count}
                </span>
                {active && (
                  <motion.span
                    layoutId="ads-tab-underline"
                    className="absolute bottom-0 left-[4px] right-[4px] sm:left-[6px] sm:right-[6px]"
                    style={{ height: 3, background: "var(--accent)", borderRadius: 2 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Search + Filter (Avito-style) */}
        <div className="flex items-center gap-[8px]">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2" style={{ color: "var(--foreground-50)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по объявлениям"
              className="w-full text-[13.5px] outline-none transition-colors"
              style={{
                height: 40,
                padding: "0 36px 0 36px",
                background: "var(--background-surface)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-button)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-[8px] top-1/2 grid h-[24px] w-[24px] -translate-y-1/2 place-items-center"
                style={{ color: "var(--foreground-50)", borderRadius: "var(--r-pill)" }}
                aria-label="Очистить"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Фильтры"
            className="relative grid shrink-0 place-items-center transition-colors"
            style={{
              height: 40, width: 40,
              background: showFilters || filtersDirty ? "var(--accent-soft)" : "var(--background-surface)",
              color: showFilters || filtersDirty ? "var(--accent)" : "var(--foreground)",
              border: `1px solid ${showFilters || filtersDirty ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "var(--r-button)",
            }}
          >
            <Filter size={16} />
            {filtersDirty && (
              <span className="absolute right-[6px] top-[6px] h-[6px] w-[6px] rounded-full" style={{ background: "var(--accent)" }} />
            )}
          </button>
          {filtersDirty && (
            <button
              type="button"
              onClick={resetFilters}
              aria-label="Сбросить фильтры"
              className="hidden shrink-0 items-center gap-[6px] px-[12px] text-[13px] font-medium sm:inline-flex"
              style={{
                height: 40, color: "var(--foreground-70)",
                border: "1px solid var(--border)", borderRadius: "var(--r-button)", background: "transparent",
              }}
            >
              <RotateCcw size={13} /> Сбросить
            </button>
          )}
        </div>

        {/* Quick filter chips */}
        <div className="flex flex-wrap gap-[8px]">
          {QUICK_CHIPS.map((chip) => {
            const active = activeQuickChip === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => applyQuickChip(chip.key)}
                className="inline-flex h-[32px] shrink-0 items-center px-[12px] text-[13px] font-medium transition-colors"
                style={{
                  borderRadius: "var(--r-pill)",
                  background: active ? "var(--accent-soft)" : "var(--background-surface)",
                  color: active ? "var(--accent)" : "var(--foreground-70)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Filter panel — grid 0fr/1fr avoids layout jump on collapse */}
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: showFilters ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div
              className="grid grid-cols-1 gap-[12px] p-[14px] sm:grid-cols-2 lg:grid-cols-3"
              style={{ background: "var(--background-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-card-sm)" }}
            >
              <FilterField label="Категория">
                <select
                  value={filters.category}
                  onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                  className="w-full text-[13px]"
                  style={selectStyle}
                >
                  <option value="all">Все категории</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </FilterField>
              <FilterField label="Город">
                <select
                  value={filters.city}
                  onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
                  className="w-full text-[13px]"
                  style={selectStyle}
                >
                  <option value="all">Все города</option>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </FilterField>
              <FilterField label="Период">
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters((f) => ({ ...f, dateRange: e.target.value as DateRange }))}
                  className="w-full text-[13px]"
                  style={selectStyle}
                >
                  <option value="all">За всё время</option>
                  <option value="today">Сегодня</option>
                  <option value="7d">7 дней</option>
                  <option value="30d">30 дней</option>
                </select>
              </FilterField>
              <FilterField label="Состояние">
                <select
                  value={filters.condition}
                  onChange={(e) => setFilters((f) => ({ ...f, condition: e.target.value as ConditionFilter }))}
                  className="w-full text-[13px]"
                  style={selectStyle}
                >
                  <option value="all">Любое</option>
                  <option value="Новое">Новое</option>
                  <option value="Б/у">Б/у</option>
                </select>
              </FilterField>
              <FilterField label="Цена от, ₽">
                <input
                  type="number"
                  min={0}
                  value={filters.priceMin || ""}
                  onChange={(e) => setFilters((f) => ({ ...f, priceMin: Math.max(0, Number(e.target.value) || 0) }))}
                  placeholder="0"
                  className="w-full text-[13px]"
                  style={selectStyle}
                />
              </FilterField>
              <FilterField label="Цена до, ₽">
                <input
                  type="number"
                  min={0}
                  value={filters.priceMax || ""}
                  onChange={(e) => setFilters((f) => ({ ...f, priceMax: Math.max(0, Number(e.target.value) || 0) }))}
                  placeholder="∞"
                  className="w-full text-[13px]"
                  style={selectStyle}
                />
              </FilterField>
              <FilterField label="Доставка">
                <select
                  value={filters.delivery}
                  onChange={(e) => setFilters((f) => ({ ...f, delivery: e.target.value as DeliveryFilter }))}
                  className="w-full text-[13px]"
                  style={selectStyle}
                >
                  <option value="all">Любая</option>
                  <option value="yes">Есть доставка</option>
                  <option value="no">Без доставки</option>
                </select>
              </FilterField>
              <FilterField label="Фото">
                <select
                  value={filters.hasPhoto}
                  onChange={(e) => setFilters((f) => ({ ...f, hasPhoto: e.target.value as PhotoFilter }))}
                  className="w-full text-[13px]"
                  style={selectStyle}
                >
                  <option value="all">Не важно</option>
                  <option value="yes">С фото</option>
                  <option value="no">Без фото</option>
                </select>
              </FilterField>
              <FilterField label="Сортировка">
                <select
                  value={filters.sort}
                  onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as SortKey }))}
                  className="w-full text-[13px]"
                  style={selectStyle}
                >
                  <option value="new">Сначала новые</option>
                  <option value="old">Сначала старые</option>
                  <option value="views">Больше просмотров</option>
                  <option value="likes">Больше лайков</option>
                  <option value="price_asc">По цене ↑</option>
                  <option value="price_desc">По цене ↓</option>
                  <option value="updated">По дате обновления</option>
                </select>
              </FilterField>
            </div>
          </div>
        </div>

        {/* Bulk toolbar */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex flex-wrap items-center justify-between gap-[12px] px-[16px] py-[12px]"
              style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: "var(--r-card-sm)" }}
            >
              <span className="text-[14px] font-semibold" style={{ color: "var(--accent)" }}>Выбрано: {selected.size}</span>
              <div className="flex items-center gap-[8px]">
                <Button variant="outline" size="sm" onClick={archiveSelected} className="rounded-[var(--r-button)]">
                  Архивировать
                </Button>
                <Button variant="destructive" size="sm" onClick={deleteSelected} className="rounded-[var(--r-button)]">
                  Удалить
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearSelection}
                  aria-label="Отменить выбор"
                  className="h-[34px] w-[34px] rounded-full"
                >
                  <X size={16} />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ReducedMotionSwitch
          switchKey={tab}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="flex flex-col gap-[12px] pb-[120px] md:pb-[40px]"
        >
            {visible.length === 0 ? (
              <EmptyTab tab={tab} onCreate={handleCreate} dirty={filtersDirty} onReset={resetFilters} />
            ) : (
              visible.map(({ ad, status }) => (
                <MyAdCard
                  key={ad.id}
                  ad={ad}
                  status={status}
                  selected={selected.has(ad.id)}
                  onSelect={handleSelect}
                  onArchive={(id) => doArchive(id)}
                  onPublish={(id) => doPublish(id)}
                  onDelete={(id) => doDelete(id)}
                  onRestore={(id) => doRestore(id)}
                />
              ))
            )}
        </ReducedMotionSwitch>
      </div>

      {/* Mobile FAB — positioned above BottomNav (z-40) */}
      <button
        type="button"
        onClick={handleCreate}
        aria-label="Разместить объявление"
        className="fixed right-[20px] z-50 grid h-[56px] w-[56px] place-items-center md:hidden"
        style={{
          bottom: "calc(var(--bottom-nav-space) + 16px)",
          background: "var(--accent)",
          color: "#fff",
          borderRadius: "var(--r-pill)",
          boxShadow: "var(--shadow-glow-accent), var(--shadow-float)",
        }}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>
    </AppLayout>
  );
}

const selectStyle: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  background: "var(--background)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--foreground)",
  outline: "none",
};

function statusToMyAdStatus(s: AdStatusKey): MyAdStatus {
  return s as MyAdStatus;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.04em]" style={{ color: "var(--foreground-50)", fontFamily: "var(--font-mono)" }}>{label}</span>
      {children}
    </label>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="flex flex-col gap-[4px] px-[12px] py-[10px] sm:px-[14px] sm:py-[12px]"
      style={{
        background: accent ? "var(--accent-soft)" : "var(--background-surface)",
        border: `1px solid ${accent ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--r-card-sm)",
      }}
    >
      <div className="flex items-center gap-[5px] text-[10.5px] font-semibold uppercase tracking-[0.04em]" style={{ color: accent ? "var(--accent)" : "var(--foreground-50)", fontFamily: "var(--font-mono)" }}>
        {icon}
        <span>{label}</span>
      </div>
      <div
        className="font-display text-[16px] font-bold leading-none sm:text-[18px]"
        style={{ color: accent ? "var(--accent)" : "var(--foreground)", letterSpacing: "-0.01em" }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyTab({ tab, onCreate, dirty, onReset }: { tab: TabKey; onCreate: () => void; dirty: boolean; onReset: () => void }) {
  const config: Record<TabKey, { title: string; desc: string }> = {
    active:       { title: "Нет активных объявлений",      desc: "Создайте первое — это бесплатно и занимает 2 минуты." },
    moderation:   { title: "Нет объявлений на модерации",  desc: "Здесь появятся объявления, которые проверяет модератор." },
    rejected:     { title: "Нет объявлений с ошибками",    desc: "Объявления, отклонённые модерацией, будут здесь." },
    unpublished:  { title: "Нет неопубликованных",         desc: "Объявления, готовые к публикации, появятся здесь." },
    archived:     { title: "Архив пуст",                   desc: "Архивированные объявления можно вернуть в любой момент." },
    deleted:      { title: "Удалённых объявлений нет",     desc: "Удалённые объявления хранятся 30 дней." },
    draft:        { title: "Нет черновиков",               desc: "Незаконченные объявления автоматически сохраняются как черновики." },
  };
  const c = config[tab];
  return (
    <EmptyState icon={Inbox} title={c.title} description={c.desc}>
      {dirty && (
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          <RotateCcw size={13} /> Сбросить фильтры
        </Button>
      )}
      {tab === "active" && (
        <Button type="button" size="sm" onClick={onCreate}>
          <Plus size={14} /> Разместить объявление
        </Button>
      )}
    </EmptyState>
  );
}
