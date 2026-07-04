import { Search, SlidersHorizontal } from "lucide-react";

export type SortKey = "new" | "cheap" | "expensive" | "popular";
export type ViewMode = "grid" | "list";

const SORT_LABEL: Record<SortKey, string> = {
  new: "Сначала новые",
  cheap: "Сначала дешевле",
  expensive: "Сначала дороже",
  popular: "Популярные",
};

interface Props {
  query: string;
  onQuery: (v: string) => void;
  sort: SortKey;
  onSort: (v: SortKey) => void;
  onOpenFilters: () => void;
  count: number;
  filterCount?: number;
}

export function AdSortBar({ query, onQuery, sort, onSort, onOpenFilters, count, filterCount = 0 }: Props) {
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
            placeholder="Поиск по объявлениям…"
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
          className="inline-flex items-center justify-center gap-[8px] px-[16px] text-[14px] font-medium"
          style={{
            background: "var(--background-elevated)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-button)",
            height: 44,
          }}
        >
          <SlidersHorizontal size={16} /> Фильтры
          {filterCount > 0 && (
            <span
              className="grid min-w-[20px] place-items-center rounded-full px-[6px] text-[11px] font-bold"
              style={{ height: 20, background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              {filterCount}
            </span>
          )}
        </button>

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
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORT_LABEL[k]}</option>
            ))}
          </select>

        </div>
      </div>

      <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
        Найдено: <span style={{ color: "var(--foreground)" }}>{count}</span> {plural(count)}
      </div>
    </div>
  );
}

function plural(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "объявление";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "объявления";
  return "объявлений";
}
