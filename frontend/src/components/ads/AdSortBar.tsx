import { useTranslation } from "@/lib/i18n";
import { Search, SlidersHorizontal, LayoutGrid, List } from "lucide-react";

export type SortKey = "new" | "cheap" | "expensive" | "popular";
export type ViewMode = "grid" | "list";

const SORT_KEYS: Record<SortKey, string> = {
  new: "ads.sortNew",
  cheap: "ads.sortCheap",
  expensive: "ads.sortExpensive",
  popular: "ads.sortPopular",
};

interface Props {
  query: string;
  onQuery: (v: string) => void;
  sort: SortKey;
  onSort: (v: SortKey) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  onOpenFilters: () => void;
  count: number;
}

export function AdSortBar({ query, onQuery, sort, onSort, view, onView, onOpenFilters, count }: Props) {
  const { t } = useTranslation();
  const plural = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return t("ads.adOne");
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return t("ads.adFew");
    return t("ads.adMany");
  };
  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex flex-col gap-[10px] sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2"
            style={{ color: "var(--foreground-50)" }}
          />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t("ads.searchAdsPlaceholder")}
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
          className="inline-flex items-center justify-center gap-[8px] px-[16px] text-[14px] font-medium lg:hidden"
          style={{
            background: "var(--background-elevated)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-button)",
            height: 44,
          }}
        >
          <SlidersHorizontal size={16} />{t("ads.filtersTitle")}</button>

        <div className="flex items-center gap-[8px]">
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as SortKey)}
            className="cursor-pointer text-[13px] font-medium outline-none"
            style={{
              background: "var(--background-elevated)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-button)",
              height: 44,
              padding: "0 14px",
            }}
          >
            {(Object.keys(SORT_KEYS) as SortKey[]).map((k) => (
              <option key={k} value={k}>{t(SORT_KEYS[k])}</option>
            ))}
          </select>

          <div
            className="hidden items-center sm:inline-flex"
            style={{
              background: "var(--background-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-button)",
              height: 44,
              padding: 4,
            }}
          >
            {(["grid", "list"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onView(m)}
                aria-label={m === "grid" ? t("ads.gridView") : t("ads.listView")}
                className="grid h-[34px] w-[40px] place-items-center transition-colors"
                style={{
                  background: view === m ? "var(--accent)" : "transparent",
                  color: view === m ? "#fff" : "var(--foreground-70)",
                  borderRadius: "calc(var(--r-button) - 4px)",
                }}
              >
                {m === "grid" ? <LayoutGrid size={14} /> : <List size={14} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
        {t("ads.foundCount")} <span style={{ color: "var(--foreground)" }}>{count}</span> {plural(count)}
      </div>
    </div>
  );
}

