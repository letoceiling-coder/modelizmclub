import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, RotateCcw, AlertCircle, RefreshCw, Megaphone } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchListings, type CatalogParams } from "@/lib/api/listings";
import { type FiltersState, DEFAULT_FILTERS, AdFiltersSheet, AdFiltersPanel } from "@/components/ads/AdFilters";
import { AdSortBar, type SortKey } from "@/components/ads/AdSortBar";
import { CategoryChips } from "@/components/ads/CategoryChips";
import { CatalogBreadcrumb } from "@/components/ads/CatalogBreadcrumb";
import { CatalogCard } from "@/components/ads/CatalogCard";
import { AdCardSkeleton } from "@/components/ads/AdCardSkeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { getToken } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import type { Ad } from "@/lib/mock";

export const Route = createFileRoute("/ads/")({
  head: () => ({
    meta: [
      { title: "Объявления — МоДелизМ" },
      { name: "description", content: "Каталог объявлений: RC авто, самолёты, квадрокоптеры, корабли. Купить и продать модели и запчасти." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: CatalogPage,
});

type LoadState = "idle" | "loading" | "ok" | "error";

// Fetched in batches via per_page/page instead of all at once — keeps the
// initial catalog payload light (perf, especially on weak mobile networks).
const PAGE_SIZE = 24;

function countActiveFilters(f: FiltersState): number {
  let n = 0;
  if (f.category !== "Все") n++;
  if (f.city) n++;
  if (f.status !== "Все") n++;
  if (f.conditions.length) n++;
  if (f.priceMin > 0) n++;
  if (f.priceMax < 100000) n++;
  if (f.withPhotoOnly) n++;
  return n;
}

function buildParams(
  q: string,
  filters: FiltersState,
  sort: SortKey,
): CatalogParams {
  return {
    q: q || undefined,
    cityId: filters.cityId,
    cityName: filters.city || undefined,
    categoryName: filters.category !== "Все" ? filters.category : undefined,
    subcategoryName: filters.subcategory !== "Все" ? filters.subcategory : undefined,
    priceMin: filters.priceMin > 0 ? filters.priceMin : undefined,
    priceMax: filters.priceMax < 100000 ? filters.priceMax : undefined,
    conditions: filters.conditions.length ? filters.conditions : undefined,
    deliveries: filters.deliveries.length ? filters.deliveries : undefined,
    listingStatus: filters.status !== "Все" ? filters.status : undefined,
    withPhotoOnly: filters.withPhotoOnly || undefined,
    sort,
  };
}

function CatalogPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const isAuthed = !!getToken() || isDemoMode();

  const [ads, setAds] = useState<Ad[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState(search.q ?? "");

  useEffect(() => {
    setQ(search.q ?? "");
  }, [search.q]);
  const [sort, setSort] = useState<SortKey>("new");
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const params = buildParams(q, filters, sort);
      const result = await fetchListings({ ...params, perPage: PAGE_SIZE, page: 1 });
      setAds(result);
      setPage(1);
      setHasMore(result.length === PAGE_SIZE);
      setLoadState("ok");
    } catch {
      setLoadState("error");
    }
  }, [q, filters, sort]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const params = buildParams(q, filters, sort);
      const result = await fetchListings({ ...params, perPage: PAGE_SIZE, page: nextPage });
      setAds((prev) => [...prev, ...result]);
      setPage(nextPage);
      setHasMore(result.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, q, filters, sort]);

  // Debounced: `load` changes identity on every keystroke into text filters
  // (search query, city — CitySelect's own dropdown-suggestion debounce fires
  // separately and doesn't cover this). Without this, the whole grid
  // re-fetches and re-renders (loading skeleton flash) on every letter typed.
  // The very first load (mount) skips the debounce so the page doesn't sit
  // blank for 350ms before showing the loading skeleton.
  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      void load();
      return;
    }
    const timer = setTimeout(() => {
      void load();
    }, 350);
    return () => clearTimeout(timer);
  }, [load]);

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setQ("");
    setSort("new");
  }

  function handleCategoryChip(name: string) {
    setFilters((prev) => ({ ...prev, category: name, subcategory: "Все" }));
  }

  const hasAnyFilter = activeFilterCount > 0 || q;

  return (
    <AppLayout rightColumn={false} navCollapsed footer>
      <div className="space-y-[16px] pb-[24px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-[12px]">
          <div>
            <CatalogBreadcrumb
              category={filters.category}
              subcategory={filters.subcategory}
              onResetToRoot={() => setFilters((p) => ({ ...p, category: "Все", subcategory: "Все" }))}
              onResetToCategory={() => setFilters((p) => ({ ...p, subcategory: "Все" }))}
            />
            <h1
              className="mt-[4px] font-display text-[22px] font-bold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              Объявления
            </h1>
            <p className="mt-[1px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
              Покупайте и продавайте технику для моделизма
            </p>
          </div>
          {isAuthed ? (
            <Link
              to={ROUTES.adCreate}
              className="inline-flex shrink-0 items-center gap-[6px] text-[13px] font-semibold"
              style={{
                height: 38,
                padding: "0 14px",
                borderRadius: "var(--r-button)",
                background: "var(--accent)",
                color: "var(--accent-foreground)",
              }}
            >
              <Plus size={15} /> Разместить
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex shrink-0 items-center gap-[6px] text-[13px] font-semibold"
              style={{
                height: 38,
                padding: "0 14px",
                borderRadius: "var(--r-button)",
                background: "var(--accent)",
                color: "var(--accent-foreground)",
              }}
            >
              <Plus size={15} /> Разместить
            </Link>
          )}
        </div>

        {/* Category chips */}
        <CategoryChips
          value={filters.category}
          onChange={handleCategoryChip}
        />

        {/* Content — persistent filter panel (xl+) + grid; drawer on <xl */}
        <div className="flex gap-[20px]">
          <AdFiltersPanel value={filters} onChange={setFilters} onReset={resetFilters} />
          <div className="min-w-0 flex-1 space-y-[12px]">
            {/* Sort bar */}
            <AdSortBar
              query={q}
              onQuery={setQ}
              sort={sort}
              onSort={setSort}
              onOpenFilters={() => setSheetOpen(true)}
              count={ads.length}
              filterCount={activeFilterCount}
            />

            {/* Active filter tags */}
            {hasAnyFilter && (
              <div className="flex flex-wrap gap-[6px]">
                {q && (
                  <FilterTag label={`«${q}»`} onRemove={() => setQ("")} />
                )}
                {filters.category !== "Все" && (
                  <FilterTag
                    label={filters.category}
                    onRemove={() => setFilters((p) => ({ ...p, category: "Все", subcategory: "Все" }))}
                  />
                )}
                {filters.city && (
                  <FilterTag
                    label={filters.city}
                    onRemove={() => setFilters((p) => ({ ...p, city: "", cityId: undefined }))}
                  />
                )}
                {filters.status !== "Все" && (
                  <FilterTag
                    label={filters.status}
                    onRemove={() => setFilters((p) => ({ ...p, status: "Все" }))}
                  />
                )}
                {filters.conditions.map((c) => (
                  <FilterTag
                    key={c}
                    label={c}
                    onRemove={() =>
                      setFilters((p) => ({ ...p, conditions: p.conditions.filter((x) => x !== c) }))
                    }
                  />
                ))}
                {(activeFilterCount > 1 || (activeFilterCount === 1 && q)) && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-[4px] text-[11.5px] font-medium transition-colors"
                    style={{ color: "var(--accent)", padding: "0 4px" }}
                  >
                    <RotateCcw size={11} /> Сбросить всё
                  </button>
                )}
              </div>
            )}

            {/* States */}
            {loadState === "loading" && (
              <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <AdCardSkeleton key={i} />
                ))}
              </div>
            )}

            {loadState === "error" && (
              <div
                className="flex flex-col items-center gap-[12px] rounded-[var(--r-card)] border py-[48px] text-center"
                style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
              >
                <AlertCircle size={32} style={{ color: "var(--error)" }} />
                <p className="text-[14px]" style={{ color: "var(--foreground-70)" }}>
                  Не удалось загрузить объявления
                </p>
                <Button variant="outline" onClick={() => void load()}>
                  <RefreshCw size={14} className="mr-[6px]" /> Повторить
                </Button>
              </div>
            )}

            {loadState === "ok" && ads.length === 0 && (
              <EmptyState
                icon={Megaphone}
                title={hasAnyFilter ? "Ничего не найдено" : "Объявлений пока нет"}
                description={
                  hasAnyFilter
                    ? "Попробуйте изменить фильтры или поисковый запрос"
                    : "Станьте первым — разместите объявление"
                }
              >
                {hasAnyFilter ? (
                  <Button variant="outline" onClick={resetFilters}>
                    <RotateCcw size={14} className="mr-[6px]" /> Сбросить фильтры
                  </Button>
                ) : isAuthed ? (
                  <Button onClick={() => navigate({ to: ROUTES.adCreate })}>
                    <Plus size={14} className="mr-[6px]" /> Разместить объявление
                  </Button>
                ) : (
                  <Button onClick={() => navigate({ to: "/login" })}>
                    Войти и разместить
                  </Button>
                )}
              </EmptyState>
            )}

            {loadState === "ok" && ads.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  {ads.map((ad) => (
                    <CatalogCard key={ad.id} ad={ad} />
                  ))}
                </div>
                {hasMore && (
                  <div className="mt-[16px] flex justify-center">
                    <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                      {loadingMore ? (
                        <>
                          <RefreshCw size={14} className="mr-[6px] animate-spin" /> Загружаем…
                        </>
                      ) : (
                        "Показать ещё"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mobile filter sheet */}
        <AdFiltersSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          value={filters}
          onChange={setFilters}
          onReset={() => { resetFilters(); setSheetOpen(false); }}
        />
      </div>
    </AppLayout>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-[4px] text-[12px] font-medium"
      style={{
        height: 26,
        padding: "0 8px 0 10px",
        borderRadius: "var(--r-pill)",
        background: "var(--accent-soft)",
        color: "var(--accent)",
        border: "1px solid var(--border-accent)",
      }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Убрать фильтр ${label}`}
        className="grid place-items-center rounded-full transition-colors hover:bg-[color:var(--accent)]"
        style={{ width: 16, height: 16, color: "inherit" }}
      >
        <X size={10} />
      </button>
    </span>
  );
}
