import { ChevronDown } from "lucide-react";

type Opt = string | { label: string; value: string };

/** Native <select> wrapped in UI-Kit chrome (border, radius, focus ring) with
 *  a custom chevron in place of the inconsistent browser default arrow. Keeps
 *  the native picker mechanics (and the native mobile wheel) — single source
 *  of truth for chromed selects across the app. */
export function NativeSelect({
  value,
  onChange,
  options,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`h-11 w-full cursor-pointer appearance-none rounded-[var(--r-input)] border border-[var(--border)] bg-[var(--background-input)] pl-3 pr-9 text-[14px] text-[var(--foreground)] shadow-sm outline-none transition-colors focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)] disabled:opacity-50 ${className ?? ""}`}
      >
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>{o}</option>
          ) : (
            <option key={o.value} value={o.value}>{o.label}</option>
          ),
        )}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2"
        style={{ color: "var(--foreground-50)" }}
      />
    </div>
  );
}
