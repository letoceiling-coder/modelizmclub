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
  const items: { id: FeedFilter; label: string }[] = [
    { id: "all", label: t("components.feedFilterTabs.all") },
    { id: "following", label: t("components.feedFilterTabs.following") },
    { id: "categories", label: t("components.feedFilterTabs.categories") },
    { id: "saved", label: t("components.feedFilterTabs.saved") },
    { id: "scheduled", label: t("components.feedFilterTabs.scheduled") },
  ];

  return (
    <div
      className="sticky top-0 z-20 -mx-3 px-[12px] py-[12px] backdrop-blur-md sm:px-[14px] sm:py-[14px] lg:mx-0 lg:rounded-[var(--r-card)] lg:border lg:px-[18px] lg:py-[16px]"
      style={{
        background: "color-mix(in oklab, var(--background-elevated) 92%, transparent)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="grid grid-cols-2 gap-[8px] sm:grid-cols-3 lg:grid-cols-5 sm:gap-[10px] lg:gap-[12px]"
        role="tablist"
        aria-label={t("components.feedFilterTabs.ariaLabel")}
      >
        {items.map((it) => {
          const active = value === it.id;
          return (
            <button
              key={it.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => guardAction(FEED_FILTER_ACTIONS[it.id], () => onChange(it.id))}
              className={cn(
                "min-h-[44px] whitespace-nowrap rounded-[var(--r-pill)] border px-[14px] py-[11px] text-center text-[14px] transition-all duration-200 active:scale-[0.98] sm:min-h-[46px] sm:px-[16px] sm:py-[12px] sm:text-[15px] lg:min-h-[48px] lg:px-[18px]",
                active
                  ? "font-semibold text-[var(--accent-foreground,#fff)]"
                  : "font-medium text-[var(--foreground-70)] hover:border-[color-mix(in_oklab,var(--border)_70%,var(--foreground)_30%)] hover:bg-[var(--background-surface-hover)]",
              )}
              style={{
                background: active ? "var(--accent)" : "var(--background-surface)",
                borderColor: active ? "var(--accent)" : "var(--border)",
                boxShadow: active ? "var(--shadow-button)" : undefined,
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
