import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, RotateCcw, AlertCircle, RefreshCw, Megaphone } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchListings, type CatalogParams } from "@/lib/api/listings";
import { type FiltersState, DEFAULT_FILTERS, AdFiltersDesktop, AdFiltersSheet } from "@/components/ads/AdFilters";
import { AdSortBar, type SortKey } from "@/components/ads/AdSortBar";
import { CategoryChips } from "@/components/ads/CategoryChips";
import { ListingCard } from "@/components/ads/ListingCard";
import { AdCardSkeleton } from "@/components/ads/AdCardSkeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { getToken } from "@/lib/api/client";
import type { Ad } from "@/lib/mock";

export const Route = createFileRoute("/ads/")({
  head: () => ({
    meta: [
      { title: "Объявления — МоДелизМ" },
      { name: "description", content: "Каталог объявлений: RC авто, самолёты, квадрокоптеры, корабли. Купить и продать модели и запчасти." },
    ],
  }),
  component: CatalogPage,
});

type LoadState = "idle" | "loading" | "ok" | "error";

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
  const isAuthed = !!getToken();

  const [ads, setAds] = useState<Ad[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const params = buildParams(q, filters, sort);
      const result = await fetchListings(params);
      setAds(result);
      setLoadState("ok");
    } catch {
      setLoadState("error");
    }
  }, [q, filters, sort]);

  useEffect(() => {
    void load();
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
    <AppLayout rightColumn={false}>
      <div className="space-y-[16px] pb-[24px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-[12px]">
          <div>
            <h1
              className="font-display text-[22px] font-bold leading-tight"
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

        {/* Main layout: desktop filters sidebar + content */}
        <div className="flex gap-[20px]">
          {/* Desktop filters */}
          <AdFiltersDesktop
            value={filters}
            onChange={setFilters}
            onReset={resetFilters}
          />

          {/* Content column */}
          <div className="min-w-0 flex-1 space-y-[12px]">
            {/* Sort bar */}
            <AdSortBar
              query={q}
              onQuery={setQ}
              sort={sort}
              onSort={setSort}
              onOpenFilters={() => setSheetOpen(true)}
              count={ads.length}
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
              <div className="grid gap-[10px] sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
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
              <div className="grid gap-[10px] sm:grid-cols-2">
                {ads.map((ad) => (
                  <ListingCard key={ad.id} ad={ad} />
                ))}
              </div>
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
