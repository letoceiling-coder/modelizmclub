import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fetchRecentPickupAddresses, suggestAddresses } from "@/lib/api/geo";

const RECENT_KEY = "modelizm:pickup-addresses";
const MAX_RECENT = 3;

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string" && x.trim().length >= 3)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function mergeRecent(...groups: string[][]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const raw of group) {
      const label = raw.trim();
      if (label.length < 3) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(label);
      if (out.length >= MAX_RECENT) return out;
    }
  }
  return out;
}

export function rememberPickupAddress(value: string): void {
  const label = value.trim();
  if (label.length < 3 || typeof window === "undefined") return;
  const next = mergeRecent([label], readRecent());
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  city?: string;
  error?: boolean;
  placeholder?: string;
}

export function PickupAddressField({ value, onChange, city, error, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>(0);
  const reqRef = useRef(0);

  const computePosition = useCallback(() => {
    const el = fieldRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = rect.bottom + 4;
    setPos({
      left: rect.left,
      top,
      width: rect.width,
      maxHeight: Math.max(160, Math.min(280, window.innerHeight - top - 12)),
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchRecentPickupAddresses().then((rows) => {
      if (cancelled) return;
      const next = mergeRecent(rows, readRecent());
      setRecent(next);
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (boxRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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

  useEffect(() => {
    window.clearTimeout(timerRef.current);
    const q = value.trim();
    if (q.length < 3) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = window.setTimeout(() => {
      const n = ++reqRef.current;
      void suggestAddresses(q, city)
        .then((rows) => {
          if (n !== reqRef.current) return;
          setItems(rows.map((r) => r.label));
        })
        .catch(() => {
          if (n !== reqRef.current) return;
          setItems([]);
        })
        .finally(() => {
          if (n === reqRef.current) setLoading(false);
        });
    }, 320);
    return () => window.clearTimeout(timerRef.current);
  }, [value, city]);

  const q = value.trim().toLowerCase();
  const shownRecent = recent.filter((r) => {
    if (r === value.trim()) return false;
    if (!q) return true;
    return r.toLowerCase().includes(q);
  });
  const shownItems = items.filter(
    (label) => !shownRecent.includes(label) && label !== value.trim(),
  );
  const options = [
    ...shownRecent.map((label) => ({ kind: "recent" as const, label })),
    ...shownItems.map((label) => ({ kind: "suggest" as const, label })),
  ];
  const hasList = open && (options.length > 0 || loading);

  const pick = (label: string) => {
    onChange(label);
    rememberPickupAddress(label);
    setRecent(mergeRecent([label], readRecent()));
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0 && options[active]) {
      e.preventDefault();
      pick(options[active].label);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <div ref={fieldRef}>
        <Input
          value={value}
          error={error}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={hasList}
          aria-autocomplete="list"
          onFocus={() => {
            setRecent(mergeRecent(readRecent(), recent));
            setOpen(true);
            computePosition();
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
            computePosition();
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {hasList &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            className="fixed z-[1000] overflow-y-auto overscroll-contain"
            style={{
              left: pos.left,
              top: pos.top,
              width: pos.width,
              maxHeight: pos.maxHeight,
              background: "var(--background-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-card)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            {shownRecent.length > 0 && (
              <div>
                <div
                  className="px-[12px] pt-[8px] pb-[4px] text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--foreground-50)" }}
                >
                  Недавние
                </div>
                {shownRecent.map((label) => {
                  const idx = options.findIndex((o) => o.kind === "recent" && o.label === label);
                  return (
                    <button
                      key={`recent-${label}`}
                      type="button"
                      role="option"
                      aria-selected={idx === active}
                      className="flex w-full items-center gap-[8px] px-[12px] py-[8px] text-left text-[13px] hover:bg-[var(--background-surface)]"
                      style={{
                        color: "var(--foreground)",
                        background: idx === active ? "var(--background-surface)" : undefined,
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(label)}
                    >
                      <MapPin
                        className="h-[14px] w-[14px] shrink-0"
                        style={{ color: "var(--foreground-50)" }}
                      />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {(shownItems.length > 0 || loading) && (
              <div>
                {shownRecent.length > 0 && (
                  <div className="border-t" style={{ borderColor: "var(--border)" }} />
                )}
                <div
                  className="px-[12px] pt-[8px] pb-[4px] text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--foreground-50)" }}
                >
                  Подсказки
                </div>
                {loading && shownItems.length === 0 && (
                  <div
                    className="px-[12px] py-[8px] text-[12px]"
                    style={{ color: "var(--foreground-50)" }}
                  >
                    Ищем адреса…
                  </div>
                )}
                {shownItems.map((label) => {
                  const idx = options.findIndex((o) => o.kind === "suggest" && o.label === label);
                  return (
                    <button
                      key={label}
                      type="button"
                      role="option"
                      aria-selected={idx === active}
                      className="flex w-full items-center gap-[8px] px-[12px] py-[8px] text-left text-[13px] hover:bg-[var(--background-surface)]"
                      style={{
                        color: "var(--foreground)",
                        background: idx === active ? "var(--background-surface)" : undefined,
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(label)}
                    >
                      <MapPin
                        className="h-[14px] w-[14px] shrink-0"
                        style={{ color: "var(--accent)" }}
                      />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
