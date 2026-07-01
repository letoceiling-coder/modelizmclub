import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

/**
 * UI Kit 2.0 chip-style checkbox. Active state uses the blue accent; the
 * control is a ≥44px tap target and shows a visible focus ring.
 */
export function Checkbox({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex min-h-[44px] items-center gap-[8px] rounded-[var(--r-tag)] border px-[14px] py-[8px] text-[13px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        checked
          ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--background-elevated)] text-[var(--foreground-70)] hover:border-[var(--border-strong)]",
      )}
    >
      <span
        className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] border-[1.5px] text-white transition-colors"
        style={{
          background: checked ? "var(--accent)" : "transparent",
          borderColor: checked ? "var(--accent)" : "var(--border-strong)",
        }}
      >
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}
