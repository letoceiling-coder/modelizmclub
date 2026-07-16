import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, X, Loader2, Check } from "lucide-react";
import { searchCities, type City } from "@/lib/api/cities";

interface CitySelectProps {
  value: string;
  cityId?: number;
  onChange: (name: string, id?: number) => void;
  placeholder?: string;
}

interface DropdownPos {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export function CitySelect({ value, cityId, onChange, placeholder = "Любой город" }: CitySelectProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const loadedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // sync external value reset (e.g. "Сбросить фильтры")
  useEffect(() => {
    setQuery(value);
    if (!value) loadedRef.current = false;
  }, [value]);

  const computePosition = useCallback(() => {
    const el = fieldRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const top = rect.bottom + gap;
    // Cap the dropdown so it stays within the viewport and scrolls internally
    // instead of pushing/clipping the surrounding filter panel.
    const maxHeight = Math.max(140, Math.min(320, window.innerHeight - top - 12));
    setPos({ left: rect.left, top, width: rect.width, maxHeight });
  }, []);

  const runSearch = useCallback(async (v: string) => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    try {
      const cities = await searchCities(v.trim() || undefined);
      if (reqId !== requestIdRef.current) return;
      setResults(cities);
      loadedRef.current = true;
    } catch {
      if (reqId === requestIdRef.current) setResults([]);
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, []);

  // Close on outside click (covers both the field and the portalled dropdown).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Keep the portalled dropdown glued to the field while it's open.
  useEffect(() => {
    if (!open) return;
    computePosition();
    const onScroll = () => computePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, computePosition]);

  function openDropdown() {
    setOpen(true);
    computePosition();
    if (!loadedRef.current && !loading) void runSearch(query);
  }

  function handleInput(v: string) {
    setQuery(v);
    onChange(v, undefined);
    setOpen(true);
    computePosition();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void runSearch(v), 300);
  }

  function pick(city: City) {
    setQuery(city.name);
    onChange(city.name, city.id);
    setOpen(false);
  }

  function clear() {
    setQuery("");
    onChange("", undefined);
    setResults([]);
    loadedRef.current = false;
    setOpen(false);
  }

  // Group results by region so long lists read like the reference design:
  // region header + its settlements, all inside one scrollable popup.
  const grouped = useMemo(() => {
    const map = new Map<string, City[]>();
    for (const c of results) {
      const key = c.region?.trim() || "Другие";
      const bucket = map.get(key);
      if (bucket) bucket.push(c);
      else map.set(key, [c]);
    }
    return Array.from(map.entries());
  }, [results]);

  return (
    <div ref={containerRef} className="relative">
      <div
        ref={fieldRef}
        className="flex items-center gap-[8px]"
        style={{
          background: "var(--background-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-input)",
          height: 40,
          padding: "0 10px",
        }}
      >
        <MapPin size={14} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[13px] outline-none"
          style={{ color: "var(--foreground)" }}
          onFocus={openDropdown}
        />
        {loading && <Loader2 size={14} className="animate-spin shrink-0" style={{ color: "var(--foreground-50)" }} />}
        {query && !loading && (
          <button type="button" onClick={clear} aria-label="Сбросить город"
            className="grid shrink-0 place-items-center"
            style={{ color: "var(--foreground-50)" }}>
            <X size={14} />
          </button>
        )}
      </div>

      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[1000] overflow-y-auto overscroll-contain py-[4px]"
          style={{
            left: pos.left,
            top: pos.top,
            width: pos.width,
            maxHeight: pos.maxHeight,
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            boxShadow: "var(--shadow-modal)",
            scrollbarWidth: "thin",
          }}
        >
          {loading && results.length === 0 && (
            <div className="flex items-center gap-[8px] px-[12px] py-[10px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
              <Loader2 size={13} className="animate-spin" /> Загрузка…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-[12px] py-[10px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
              Ничего не найдено
            </div>
          )}
          {grouped.map(([region, cities]) => (
            <div key={region}>
              <div
                className="sticky top-0 px-[12px] py-[5px] text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--foreground-50)", background: "var(--background-elevated)" }}
              >
                {region}
              </div>
              {cities.map((city) => {
                const selected = cityId != null ? city.id === cityId : city.name === value;
                return (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => pick(city)}
                    className="flex w-full items-center gap-[8px] px-[12px] py-[9px] text-left text-[13px] transition-colors hover:bg-[color:var(--background-surface-hover)]"
                    style={{ color: "var(--foreground)" }}
                  >
                    <MapPin size={12} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />
                    <span className="flex-1">{city.name}</span>
                    {selected && <Check size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
