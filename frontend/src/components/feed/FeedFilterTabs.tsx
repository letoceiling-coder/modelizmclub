import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { FEED_FILTER_ACTIONS } from "@/lib/feed-guest-access/registry";
import { cn } from "@/lib/utils";

export type FeedFilter = "all" | "following" | "categories" | "saved" | "scheduled";

interface Props {
  value: FeedFilter;
  onChange: (v: FeedFilter) => void;
}

export function FeedFilterTabs({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { guardAction } = useGuestAccess();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const items: { id: FeedFilter; label: string }[] = [
    { id: "all", label: t("components.feedFilterTabs.all") },
    { id: "following", label: t("components.feedFilterTabs.following") },
    { id: "categories", label: t("components.feedFilterTabs.categories") },
    { id: "saved", label: t("components.feedFilterTabs.saved") },
    { id: "scheduled", label: t("components.feedFilterTabs.scheduled") },
  ];

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [value]);

  return (
    <div
      className="sticky top-0 z-20 -mx-3 px-[8px] py-[8px] backdrop-blur-md sm:px-[12px] sm:py-[10px] lg:mx-0 lg:rounded-[var(--r-card)] lg:border lg:px-[14px] lg:py-[12px]"
      style={{
        background: "color-mix(in oklab, var(--background-elevated) 92%, transparent)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        ref={scrollRef}
        className="no-scrollbar flex gap-[6px] overflow-x-auto overscroll-x-contain sm:gap-[8px]"
        role="tablist"
        aria-label={t("components.feedFilterTabs.ariaLabel")}
      >
        {items.map((it) => {
          const active = value === it.id;
          return (
            <button
              key={it.id}
              ref={active ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => guardAction(FEED_FILTER_ACTIONS[it.id], () => onChange(it.id))}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-[var(--r-pill)] border px-[12px] py-[8px] text-[13px] transition-all duration-200 active:scale-[0.98] sm:min-h-[40px] sm:px-[14px] sm:py-[9px] sm:text-[14px] lg:min-h-[42px] lg:px-[16px]",
                active
                  ? "font-semibold text-[var(--accent-foreground,#fff)]"
                  : "font-medium text-[var(--foreground-70)] hover:border-[color-mix(in_oklab,var(--border)_70%,var(--foreground)_30%)] hover:bg-[var(--background-surface-hover)]",
              )}
              style={{
                background: active ? "var(--accent)" : "var(--background-surface)",
                borderColor: active ? "var(--accent)" : "var(--border)",
                boxShadow: active ? "var(--shadow-button)" : undefined,
                minHeight: 36,
              }}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
