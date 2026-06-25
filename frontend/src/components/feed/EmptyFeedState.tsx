import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyFeedState({ icon: Icon = Inbox, title, description, ctaLabel, onCta }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-[16px] border border-dashed px-[24px] py-[56px] text-center"
      style={{
        background: "var(--background-elevated)",
        borderColor: "var(--border-strong)",
      }}
    >
      <div
        className="mb-[16px] grid h-[64px] w-[64px] place-items-center rounded-full"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Icon className="h-[28px] w-[28px]" />
      </div>
      <h3
        className="text-[18px] font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
      >
        {title}
      </h3>
      {description && (
        <p className="mt-[6px] max-w-[360px] text-[14px]" style={{ color: "var(--foreground-70)" }}>
          {description}
        </p>
      )}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="mt-[20px] rounded-[12px] px-[20px] py-[10px] text-[14px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)", color: "#fff", boxShadow: "var(--shadow-button)" }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
