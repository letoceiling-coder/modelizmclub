import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Inbox, Eye, Heart, TrendingUp, MessageCircle, X, Filter, RotateCcw, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { type Ad } from "@/lib/mock";
import { useStore, actions, selectors, type AdStatusKey } from "@/lib/store";
import { MyAdCard, type MyAdStatus } from "@/components/MyAdCard";

export const Route = createFileRoute("/ads/")({
  head: () => ({ meta: [{ title: tStatic("ads.myMetaTitle") }] }),
  component: MyAdsPage,
});

const CURRENT_USER_ID = "u1";

type TabKey = "active" | "moderation" | "rejected" | "unpublished" | "archived" | "deleted" | "draft";

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: "active",       labelKey: "ads.tabActive" },
  { key: "moderation",   labelKey: "ads.tabModeration" },
  { key: "rejected",     labelKey: "ads.tabRejected" },
  { key: "unpublished",  labelKey: "ads.tabUnpublished" },
  { key: "archived",     labelKey: "ads.tabArchived" },
  { key: "deleted",      labelKey: "ads.tabDeleted" },
  { key: "draft",        labelKey: "ads.tabDraft" },
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("active");
  const allMyAds = useStore(selectors.myAds(CURRENT_USER_ID));
  const adStatusMap = useStore((s) => s.adStatus);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");

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
    const q = query.trim().toLowerCase();
    const filtered = decorated.filter(({ ad, status }) => {
      if (statusToTab(status) !== tab) return false;
      if (filters.category !== "all" && ad.category !== filters.category) return false;
      if (filters.minViews > 0 && (ad.views ?? 0) < filters.minViews) return false;
      if (filters.dateRange !== "all") {
        const createdAt = ad.createdAt ? Date.parse(ad.createdAt) : NaN;
        if (!isFinite(createdAt) || now - createdAt > rangeMs[filters.dateRange]) return false;
      }
      if (q && !ad.title.toLowerCase().includes(q)) return false;
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
  }, [decorated, tab, filters, query]);

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
        <header className="flex flex-wrap items-end justify-between gap-[12px]">
          <div className="min-w-0">
            <h1 className="font-display text-[20px] font-bold leading-[1.15] sm:text-[28px]" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>{t("ads.myTitle")}</h1>
            <p className="mt-[4px] text-[12.5px] sm:text-[14px]" style={{ color: "var(--foreground-70)" }}>
              {t("ads.mySubtitle")}
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
            <Plus size={16} /> {t("ads.createAd")}
          </button>
        </header>

        {/* Stats — compact (Avito-style) */}
        <section className="-mx-3 flex gap-[8px] overflow-x-auto px-3 pb-[2px] sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-[12px] sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <StatCard icon={<TrendingUp size={14} />} label={t("ads.statActive")}   value={stats.count.toString()} accent />
          <StatCard icon={<Eye size={14} />}        label={t("ads.statViews")} value={stats.views.toLocaleString("ru")} />
          <StatCard icon={<Heart size={14} />}      label={t("ads.statLikes")}     value={stats.likes.toLocaleString("ru")} />
          <StatCard icon={<MessageCircle size={14} />} label={t("ads.statSum")}   value={`${stats.earnings.toLocaleString("ru")} ₽`} />
        </section>

        {/* Tabs */}
        <nav
          className="sticky top-0 z-10 flex items-center gap-[4px] overflow-x-auto py-[8px]"
          style={{ background: "var(--background)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border)" }}
          role="tablist"
        >
          {TABS.map((tabItem) => {
            const active = tab === tabItem.key;
            const count = counts[tabItem.key];
            return (
              <button
                key={tabItem.key}
                role="tab"
                aria-selected={active}
                ref={(el) => { tabRefs.current[tabItem.key] = el; }}
                onClick={() => setTab(tabItem.key)}
                className="relative inline-flex items-center gap-[8px] whitespace-nowrap px-[16px] py-[10px] text-[14px] font-semibold transition-colors"
                style={{ color: active ? "var(--foreground)" : "var(--foreground-50)" }}
              >
                {t(tabItem.labelKey)}
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

        {/* Search + Filter (Avito-style) */}
        <div className="flex items-center gap-[8px]">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2" style={{ color: "var(--foreground-50)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ads.searchPlaceholder")}
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
                style={{ color: "var(--foreground-50)", borderRadius: 999 }}
                aria-label={t("categories.clear")}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-label={t("ads.filtersTitle")}
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
              aria-label={t("ads.resetFiltersAria")}
              className="hidden shrink-0 items-center gap-[6px] px-[12px] text-[13px] font-medium sm:inline-flex"
              style={{
                height: 40, color: "var(--foreground-70)",
                border: "1px solid var(--border)", borderRadius: "var(--r-button)", background: "transparent",
              }}
            >
              <RotateCcw size={13} /> {t("ads.resetFilters")}
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
                <FilterField label={t("ads.filterCategory")}>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                    className="w-full text-[13px]"
                    style={selectStyle}
                  >
                    <option value="all">{t("ads.allCategories")}</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FilterField>
                <FilterField label={t("ads.filterPeriod")}>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters((f) => ({ ...f, dateRange: e.target.value as DateRange }))}
                    className="w-full text-[13px]"
                    style={selectStyle}
                  >
                    <option value="all">{t("ads.periodAll")}</option>
                    <option value="7d">{t("ads.period7d")}</option>
                    <option value="30d">{t("ads.period30d")}</option>
                    <option value="90d">{t("ads.period90d")}</option>
                  </select>
                </FilterField>
                <FilterField label={t("ads.filterViewsMin")}>
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
                <FilterField label={t("ads.filterSort")}>
                  <select
                    value={filters.sort}
                    onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as SortKey }))}
                    className="w-full text-[13px]"
                    style={selectStyle}
                  >
                    <option value="new">{t("ads.sortNew")}</option>
                    <option value="old">{t("ads.sortOld")}</option>
                    <option value="views">{t("ads.sortViews")}</option>
                    <option value="price">{t("ads.sortPrice")}</option>
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
              <span className="text-[14px] font-semibold" style={{ color: "var(--accent)" }}>{t("ads.selectedCount", { n: selected.size })}</span>
              <div className="flex items-center gap-[8px]">
                <button type="button" onClick={archiveSelected}
                  className="inline-flex items-center px-[14px] text-[13px] font-semibold"
                  style={{ background: "var(--background)", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--r-button)", height: 34 }}>
                  {t("ads.archiveSelected")}
                </button>
                <button type="button" onClick={deleteSelected}
                  className="inline-flex items-center px-[14px] text-[13px] font-semibold"
                  style={{ background: "var(--error)", color: "#fff", borderRadius: "var(--r-button)", height: 34 }}>
                  {t("ads.deleteSelected")}
                </button>
                <button type="button" onClick={clearSelection}
                  className="grid h-[34px] w-[34px] place-items-center"
                  style={{ background: "transparent", color: "var(--foreground-50)", borderRadius: "var(--r-pill)" }}
                  aria-label={t("ads.cancelSelection")}>
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
        aria-label={t("ads.createAd")}
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
      className="flex shrink-0 flex-col gap-[4px] px-[12px] py-[10px] sm:px-[14px] sm:py-[12px]"
      style={{
        minWidth: 132,
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
  const { t } = useTranslation();
  const config: Record<TabKey, { titleKey: string; descKey: string }> = {
    active:       { titleKey: "ads.emptyActiveTitle",      descKey: "ads.emptyActiveDesc" },
    moderation:   { titleKey: "ads.emptyModerationTitle",  descKey: "ads.emptyModerationDesc" },
    rejected:     { titleKey: "ads.emptyRejectedTitle",    descKey: "ads.emptyRejectedDesc" },
    unpublished:  { titleKey: "ads.emptyUnpublishedTitle", descKey: "ads.emptyUnpublishedDesc" },
    archived:     { titleKey: "ads.emptyArchivedTitle",    descKey: "ads.emptyArchivedDesc" },
    deleted:      { titleKey: "ads.emptyDeletedTitle",     descKey: "ads.emptyDeletedDesc" },
    draft:        { titleKey: "ads.emptyDraftTitle",       descKey: "ads.emptyDraftDesc" },
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
        <h3 className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)" }}>{t(c.titleKey)}</h3>
        <p className="mt-[6px] text-[14px]" style={{ color: "var(--foreground-70)" }}>{t(c.descKey)}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-[8px]">
        {dirty && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-[6px] px-[14px] text-[13px] font-semibold"
            style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--foreground-70)", borderRadius: "var(--r-button)", height: 38 }}
          >
            <RotateCcw size={13} /> {t("ads.resetFiltersBtn")}
          </button>
        )}
        {tab === "active" && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-[8px] px-[20px] text-[14px] font-semibold"
            style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-button)", boxShadow: "var(--shadow-button)", height: 42 }}
          >
            <Plus size={16} /> {t("ads.createAd")}
          </button>
        )}
      </div>
    </div>
  );
}
