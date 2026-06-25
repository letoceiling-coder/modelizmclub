import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Inbox, Eye, Heart, TrendingUp, MessageCircle, X, Filter, RotateCcw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { type Ad } from "@/lib/mock";
import { useStore, actions, selectors, type AdStatusKey } from "@/lib/store";
import { MyAdCard, type MyAdStatus } from "@/components/MyAdCard";

export const Route = createFileRoute("/ads/")({
  head: () => ({ meta: [{ title: "Мои объявления — МоДелизМ Форум" }] }),
  component: MyAdsPage,
});

const CURRENT_USER_ID = "u1";

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

type SortKey = "new" | "old" | "views" | "price";
type DateRange = "all" | "7d" | "30d" | "90d";

interface Filters {
  category: string;
  dateRange: DateRange;
  minViews: number;
  sort: SortKey;
}

const DEFAULT_FILTERS: Filters = { category: "all", dateRange: "all", minViews: 0, sort: "new" };

function MyAdsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("active");
  const allMyAds = useStore(selectors.myAds(CURRENT_USER_ID));
  const adStatusMap = useStore((s) => s.adStatus);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const decorated = useMemo(
    () => allMyAds.map((ad) => ({ ad, status: (adStatusMap[ad.id] ?? "active") as AdStatusKey })),
    [allMyAds, adStatusMap]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const { ad } of decorated) if (ad.category) set.add(ad.category);
    return Array.from(set).sort();
  }, [decorated]);

  // Counts derived from store
  const counts = useMemo<Record<TabKey, number>>(() => {
    const c: Record<TabKey, number> = { active: 0, moderation: 0, rejected: 0, unpublished: 0, archived: 0, deleted: 0, draft: 0 };
    for (const { status } of decorated) c[statusToTab(status)] = (c[statusToTab(status)] ?? 0) + 1;
    return c;
  }, [decorated]);

  const filtersDirty = useMemo(
    () => filters.category !== "all" || filters.dateRange !== "all" || filters.minViews > 0 || filters.sort !== "new",
    [filters]
  );

  const visible = useMemo(() => {
    const now = Date.now();
    const rangeMs: Record<DateRange, number> = {
      all: Infinity,
      "7d": 7 * 24 * 3600 * 1000,
      "30d": 30 * 24 * 3600 * 1000,
      "90d": 90 * 24 * 3600 * 1000,
    };
    const filtered = decorated.filter(({ ad, status }) => {
      if (statusToTab(status) !== tab) return false;
      if (filters.category !== "all" && ad.category !== filters.category) return false;
      if (filters.minViews > 0 && (ad.views ?? 0) < filters.minViews) return false;
      if (filters.dateRange !== "all") {
        const createdAt = ad.createdAt ? Date.parse(ad.createdAt) : NaN;
        if (!isFinite(createdAt) || now - createdAt > rangeMs[filters.dateRange]) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (filters.sort) {
        case "old":   return Date.parse(a.ad.createdAt ?? "0") - Date.parse(b.ad.createdAt ?? "0");
        case "views": return (b.ad.views ?? 0) - (a.ad.views ?? 0);
        case "price": return b.ad.price - a.ad.price;
        default:      return Date.parse(b.ad.createdAt ?? "0") - Date.parse(a.ad.createdAt ?? "0");
      }
    });
    return sorted.map((x) => ({ ad: x.ad, status: statusToMyAdStatus(x.status) }));
  }, [decorated, tab, filters]);

  // Aggregate stats from active ads
  const stats = useMemo(() => {
    const active = decorated.filter(({ status }) => status === "active");
    const views = active.reduce((s, x) => s + (x.ad.views ?? 0), 0);
    const likes = active.reduce((s, x) => s + (x.ad.likes ?? 0), 0);
    const earnings = active.reduce((s, x) => s + x.ad.price, 0);
    return { count: active.length, views, likes, earnings };
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
  const archiveSelected = () => { selected.forEach((id) => actions.archiveAd(id)); clearSelection(); };
  const deleteSelected = () => { selected.forEach((id) => actions.deleteAd(id)); clearSelection(); };
  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-[20px]">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-[16px]">
          <div>
            <h1 className="font-display text-[28px] font-bold leading-[1.1] sm:text-[32px]" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Мои объявления
            </h1>
            <p className="mt-[6px] text-[14px]" style={{ color: "var(--foreground-70)" }}>
              Управляйте своими публикациями, статистикой и архивом
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            className="hidden items-center gap-[8px] px-[20px] text-[14px] font-semibold transition-all md:inline-flex"
            style={{
              background: "var(--accent)", color: "#fff",
              borderRadius: "var(--r-button)", boxShadow: "var(--shadow-button)", height: 44,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
          >
            <Plus size={16} /> Разместить объявление
          </button>
        </header>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-[12px] md:grid-cols-4">
          <StatCard icon={<TrendingUp size={18} />} label="Активных" value={stats.count.toString()} accent />
          <StatCard icon={<Eye size={18} />} label="Просмотров" value={stats.views.toLocaleString("ru")} />
          <StatCard icon={<Heart size={18} />} label="Лайков" value={stats.likes.toLocaleString("ru")} />
          <StatCard icon={<MessageCircle size={18} />} label="Сумма" value={`${stats.earnings.toLocaleString("ru")} ₽`} />
        </section>

        {/* Tabs */}
        <nav
          className="sticky top-0 z-10 flex items-center gap-[4px] overflow-x-auto py-[8px]"
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
                ref={(el) => { tabRefs.current[t.key] = el; }}
                onClick={() => setTab(t.key)}
                className="relative inline-flex items-center gap-[8px] whitespace-nowrap px-[16px] py-[10px] text-[14px] font-semibold transition-colors"
                style={{ color: active ? "var(--foreground)" : "var(--foreground-50)" }}
              >
                {t.label}
                <span
                  className="inline-flex h-[20px] min-w-[20px] items-center justify-center px-[6px] text-[11px] font-bold"
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
                    className="absolute bottom-0 left-[8px] right-[8px]"
                    style={{ height: 3, background: "var(--accent)", borderRadius: 2 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Filter toolbar */}
        <div className="flex flex-wrap items-center gap-[8px]">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-[8px] px-[14px] text-[13px] font-semibold"
            style={{
              height: 36,
              background: showFilters || filtersDirty ? "var(--accent-soft)" : "var(--background-surface)",
              color: showFilters || filtersDirty ? "var(--accent)" : "var(--foreground)",
              border: `1px solid ${showFilters || filtersDirty ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "var(--r-button)",
            }}
          >
            <Filter size={14} /> Фильтры{filtersDirty ? " · активны" : ""}
          </button>
          {filtersDirty && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-[6px] px-[12px] text-[13px] font-medium"
              style={{
                height: 36, color: "var(--foreground-70)",
                border: "1px solid var(--border)", borderRadius: "var(--r-button)", background: "transparent",
              }}
            >
              <RotateCcw size={13} /> Сбросить фильтры
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              key="filterbar"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div
                className="grid gap-[12px] p-[14px] sm:grid-cols-2 md:grid-cols-4"
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
                <FilterField label="Период">
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters((f) => ({ ...f, dateRange: e.target.value as DateRange }))}
                    className="w-full text-[13px]"
                    style={selectStyle}
                  >
                    <option value="all">За всё время</option>
                    <option value="7d">7 дней</option>
                    <option value="30d">30 дней</option>
                    <option value="90d">90 дней</option>
                  </select>
                </FilterField>
                <FilterField label="Просмотров не менее">
                  <input
                    type="number"
                    min={0}
                    value={filters.minViews || ""}
                    onChange={(e) => setFilters((f) => ({ ...f, minViews: Math.max(0, Number(e.target.value) || 0) }))}
                    placeholder="0"
                    className="w-full text-[13px]"
                    style={selectStyle}
                  />
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
                    <option value="views">По просмотрам</option>
                    <option value="price">По цене</option>
                  </select>
                </FilterField>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                <button type="button" onClick={archiveSelected}
                  className="inline-flex items-center px-[14px] text-[13px] font-semibold"
                  style={{ background: "var(--background)", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--r-button)", height: 34 }}>
                  Архивировать
                </button>
                <button type="button" onClick={deleteSelected}
                  className="inline-flex items-center px-[14px] text-[13px] font-semibold"
                  style={{ background: "var(--error)", color: "#fff", borderRadius: "var(--r-button)", height: 34 }}>
                  Удалить
                </button>
                <button type="button" onClick={clearSelection}
                  className="grid h-[34px] w-[34px] place-items-center"
                  style={{ background: "transparent", color: "var(--foreground-50)", borderRadius: "var(--r-pill)" }}
                  aria-label="Отменить выбор">
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
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
                  onArchive={(id) => actions.archiveAd(id)}
                  onPublish={(id) => actions.setAdStatus(id, "active")}
                  onDelete={(id) => actions.deleteAd(id)}
                />
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={handleCreate}
        aria-label="Разместить объявление"
        className="fixed right-[20px] bottom-[20px] z-30 grid h-[56px] w-[56px] place-items-center md:hidden"
        style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-pill)", boxShadow: "var(--shadow-glow-accent), var(--shadow-float)" }}
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
      className="flex flex-col gap-[6px] p-[14px]"
      style={{
        background: accent ? "var(--accent-soft)" : "var(--background-surface)",
        border: `1px solid ${accent ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--r-card-sm)",
      }}
    >
      <div className="flex items-center gap-[6px] text-[12px] font-medium" style={{ color: accent ? "var(--accent)" : "var(--foreground-50)" }}>
        {icon}
        <span style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      </div>
      <div
        className="font-display text-[22px] font-bold leading-none"
        style={{ color: accent ? "var(--accent)" : "var(--foreground)" }}
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
    <div
      className="grid place-items-center gap-[14px] p-[56px] text-center"
      style={{ background: "var(--background-surface)", border: "1px dashed var(--border-strong)", borderRadius: "var(--r-card)" }}
    >
      <div
        className="grid h-[64px] w-[64px] place-items-center"
        style={{ background: "var(--background-elevated)", color: "var(--foreground-50)", borderRadius: "var(--r-pill)" }}
      >
        <Inbox size={26} />
      </div>
      <div>
        <h3 className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)" }}>{c.title}</h3>
        <p className="mt-[6px] text-[14px]" style={{ color: "var(--foreground-70)" }}>{c.desc}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-[8px]">
        {dirty && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-[6px] px-[14px] text-[13px] font-semibold"
            style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--foreground-70)", borderRadius: "var(--r-button)", height: 38 }}
          >
            <RotateCcw size={13} /> Сбросить фильтры
          </button>
        )}
        {tab === "active" && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-[8px] px-[20px] text-[14px] font-semibold"
            style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-button)", boxShadow: "var(--shadow-button)", height: 42 }}
          >
            <Plus size={16} /> Разместить объявление
          </button>
        )}
      </div>
    </div>
  );
}
