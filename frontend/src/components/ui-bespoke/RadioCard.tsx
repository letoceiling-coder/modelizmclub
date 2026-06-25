import type { LucideIcon } from "lucide-react";

interface Props {
  selected: boolean;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  accentVar?: string;
}

export function RadioCard({ selected, onClick, icon: Icon, title, description, accentVar = "var(--accent)" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-[14px] p-[16px] text-left transition-all"
      style={{
        background: selected ? "var(--accent-soft)" : "var(--background-elevated)",
        border: `2px solid ${selected ? accentVar : "var(--border)"}`,
        borderRadius: "var(--r-card-sm)",
        boxShadow: selected ? "var(--shadow-card-hover)" : "var(--shadow-card)",
      }}
    >
      <div
        className="grid h-[40px] w-[40px] shrink-0 place-items-center"
        style={{
          background: selected ? accentVar : "var(--background-surface)",
          color: selected ? "#fff" : "var(--foreground-70)",
          borderRadius: "var(--r-card-sm)",
          transition: "background 200ms, color 200ms",
        }}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{title}</div>
        <div className="mt-[2px] text-[12px]" style={{ color: "var(--foreground-70)" }}>{description}</div>
      </div>
      <div
        className="mt-[2px] grid h-[18px] w-[18px] place-items-center"
        style={{
          border: `2px solid ${selected ? accentVar : "var(--border-strong)"}`,
          borderRadius: "var(--r-pill)",
        }}
      >
        {selected && <div className="h-[8px] w-[8px]" style={{ background: accentVar, borderRadius: "var(--r-pill)" }} />}
      </div>
    </button>
  );
}
