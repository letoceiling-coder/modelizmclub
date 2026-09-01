import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { suggestAddresses } from "@/lib/api/geo";

const RECENT_KEY = "modelizm:pickup-addresses";
const MAX_RECENT = 3;

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.trim().length >= 3).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function rememberPickupAddress(value: string): void {
  const label = value.trim();
  if (label.length < 3 || typeof window === "undefined") return;
  const next = [label, ...readRecent().filter((x) => x !== label)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  placeholder?: string;
}

export function PickupAddressField({ value, onChange, error, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const boxRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    window.clearTimeout(timerRef.current);
    const q = value.trim();
    if (q.length < 3) {
      setItems([]);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      void suggestAddresses(q)
        .then((rows) => setItems(rows.map((r) => r.label).filter((l) => l !== q)))
        .catch(() => setItems([]));
    }, 280);
    return () => window.clearTimeout(timerRef.current);
  }, [value]);

  const shownRecent = recent.filter((r) => r !== value.trim());
  const hasList = open && (shownRecent.length > 0 || items.length > 0);

  const pick = (label: string) => {
    onChange(label);
    rememberPickupAddress(label);
    setRecent(readRecent());
    setOpen(false);
  };

  return (
    <div className="relative" ref={boxRef}>
      <Input
        value={value}
        error={error}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setRecent(readRecent());
          setOpen(true);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {hasList && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-[240px] overflow-y-auto rounded-[var(--r-card)] border"
          style={{
            background: "var(--background-elevated)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-float)",
          }}
        >
          {shownRecent.length > 0 && (
            <div>
              <div className="px-[12px] pt-[8px] pb-[4px] text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-50)" }}>
                Недавние
              </div>
              {shownRecent.map((label) => (
                <button
                  key={`recent-${label}`}
                  type="button"
                  className="block w-full px-[12px] py-[8px] text-left text-[13px] hover:bg-[var(--background-surface)]"
                  style={{ color: "var(--foreground)" }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(label)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {items.length > 0 && (
            <div>
              {shownRecent.length > 0 && <div className="border-t" style={{ borderColor: "var(--border)" }} />}
              <div className="px-[12px] pt-[8px] pb-[4px] text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-50)" }}>
                Подсказки
              </div>
              {items.map((label) => (
                <button
                  key={label}
                  type="button"
                  className="block w-full px-[12px] py-[8px] text-left text-[13px] hover:bg-[var(--background-surface)]"
                  style={{ color: "var(--foreground)" }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(label)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
