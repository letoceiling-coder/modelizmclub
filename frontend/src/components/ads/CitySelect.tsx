import { useEffect, useRef, useState } from "react";
import { MapPin, X, Loader2 } from "lucide-react";
import { searchCities, type City } from "@/lib/api/cities";

interface CitySelectProps {
  value: string;
  cityId?: number;
  onChange: (name: string, id?: number) => void;
  placeholder?: string;
}

export function CitySelect({ value, cityId, onChange, placeholder = "Любой город" }: CitySelectProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // sync external value reset (e.g. "Сбросить фильтры")
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleInput(v: string) {
    setQuery(v);
    onChange(v, undefined);
    setResults([]);
    setOpen(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!v.trim()) {
      return;
    }
    const reqId = ++requestIdRef.current;
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const cities = await searchCities(v);
        if (reqId !== requestIdRef.current) return;
        const q = v.trim().toLowerCase();
        const filtered = cities.filter(
          (c) => c.name.toLowerCase().includes(q) || (c.region?.toLowerCase().includes(q) ?? false),
        );
        const list = (filtered.length > 0 ? filtered : cities).slice(0, 8);
        setResults(list);
        setOpen(list.length > 0);
      } catch {
        if (reqId === requestIdRef.current) setResults([]);
      } finally {
        if (reqId === requestIdRef.current) setLoading(false);
      }
    }, 300);
  }

  function pick(city: City) {
    setQuery(city.name);
    onChange(city.name, city.id);
    setOpen(false);
    setResults([]);
  }

  function clear() {
    setQuery("");
    onChange("", undefined);
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div
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
          onFocus={() => { if (results.length > 0) setOpen(true); }}
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

      {open && results.length > 0 && (
        <div
          className="absolute left-0 right-0 top-[44px] z-50 max-h-[min(240px,40vh)] overflow-y-auto py-[4px]"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            boxShadow: "var(--shadow-modal)",
          }}
        >
          {results.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => pick(city)}
              className="flex w-full items-center gap-[8px] px-[12px] py-[9px] text-left text-[13px] transition-colors hover:bg-[color:var(--background-surface-hover)]"
              style={{ color: "var(--foreground)" }}
            >
              <MapPin size={12} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />
              <span className="flex-1">{city.name}</span>
              {city.region && (
                <span className="text-[11px]" style={{ color: "var(--foreground-50)" }}>{city.region}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
