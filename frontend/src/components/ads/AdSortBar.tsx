import { Search, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

export type SortKey = "new" | "cheap" | "expensive" | "popular";
export type ViewMode = "grid" | "list";

const SORT_KEYS: SortKey[] = ["new", "cheap", "expensive", "popular"];

const SORT_LABEL_KEY: Record<SortKey, string> = {
  new: "components.adsCatalog.sortNew",
  cheap: "components.adsCatalog.sortCheap",
  expensive: "components.adsCatalog.sortExpensive",
  popular: "components.adsCatalog.sortPopular",
};

interface Props {
  query: string;
  onQuery: (v: string) => void;
  sort: SortKey;
  onSort: (v: SortKey) => void;
  onOpenFilters: () => void;
  count: number;
  filterCount?: number;
  refreshing?: boolean;
}

export function AdSortBar({
  query,
  onQuery,
  sort,
  onSort,
  onOpenFilters,
  count,
  filterCount = 0,
  refreshing = false,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex items-center gap-[8px]">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2"
            style={{ color: "var(--foreground-50)" }}
          />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t("search.adsPlaceholder")}
            className="w-full text-[14px] outline-none transition-colors"
            style={{
              background: "var(--background-elevated)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-input)",
              height: 44,
              padding: "0 14px 0 40px",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>

        <button
          type="button"
          onClick={onOpenFilters}
          aria-label={t("components.adsCatalog.filters")}
          className="relative inline-flex w-[44px] shrink-0 items-center justify-center gap-[8px] px-0 text-[14px] font-medium sm:w-auto sm:px-[16px] xl:hidden"
          style={{
            background: "var(--background-elevated)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-button)",
            height: 44,
          }}
        >
          <SlidersHorizontal size={18} />
          <span className="hidden sm:inline">{t("components.adsCatalog.filters")}</span>
          {filterCount > 0 && (
            <span
              className="absolute -right-[6px] -top-[6px] grid min-w-[18px] place-items-center rounded-full px-[5px] text-[10px] font-bold sm:static sm:min-w-[20px] sm:px-[6px] sm:text-[11px]"
              style={{
                height: 18,
                background: "var(--accent)",
                color: "var(--accent-foreground)",
                boxShadow: "0 0 0 2px var(--background)",
              }}
            >
              {filterCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex items-center justify-between gap-[8px]">
        <div className="min-w-0 truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>
          {refreshing ? (
            <>{t("components.adsCatalog.refreshing")}</>
          ) : (
            <>
              {t("components.adsCatalog.found")}{" "}
              <span style={{ color: "var(--foreground)" }}>{count}</span> {pluralListings(count, t)}
            </>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as SortKey)}
          aria-label={t("components.adsCatalog.sortAria")}
          className="shrink-0 cursor-pointer text-[13px] font-medium outline-none"
          style={{
            background: "var(--background-elevated)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-button)",
            height: 36,
            padding: "0 10px",
          }}
        >
          {SORT_KEYS.map((k) => (
            <option key={k} value={k}>
              {t(SORT_LABEL_KEY[k])}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function pluralListings(n: number, t: (key: string) => string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return t("components.adsCatalog.listing_one");
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100))
    return t("components.adsCatalog.listing_few");
  return t("components.adsCatalog.listing_many");
}
