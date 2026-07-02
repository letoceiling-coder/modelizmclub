import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  selected: boolean;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

/**
 * UI Kit 2.0 selectable card. Active state is always the blue accent
 * (#627FFF) — never commercial-orange. Keyboard-focusable with a visible ring;
 * min height comfortably above the 44px tap target.
 */
export function RadioCard({ selected, onClick, icon: Icon, title, description, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group flex min-h-[64px] w-full items-start gap-[14px] rounded-[var(--r-card-sm)] border-2 p-[16px] text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        selected
          ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-card-hover)]"
          : "border-[var(--border)] bg-[var(--background-elevated)] shadow-[var(--shadow-card)] hover:border-[var(--border-strong)]",
        className,
      )}
    >
      <div
        className={cn(
          "grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[var(--r-card-sm)] transition-colors",
          selected ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-[var(--background-surface)] text-[var(--foreground-70)]",
        )}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{title}</div>
        <div className="mt-[2px] text-[12px]" style={{ color: "var(--foreground-70)" }}>{description}</div>
      </div>
      <div
        className={cn(
          "mt-[2px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors",
          selected ? "border-[var(--accent)]" : "border-[var(--border-strong)]",
        )}
      >
        {selected && <div className="h-[8px] w-[8px] rounded-full bg-[var(--accent)]" />}
      </div>
    </button>
  );
}
