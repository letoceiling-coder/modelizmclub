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
      // Слой берётся из шкалы в styles.css: числовых z-index у липких панелей
      // в проекте нет — иначе следующая панель снова окажется выше или ниже
      // случайно.
      className="sticky top-0 z-[var(--z-sticky)] -mx-3 px-[8px] py-[2px] backdrop-blur-md sm:mx-0 sm:rounded-[var(--r-card)] sm:border sm:px-[12px] sm:py-[6px]"
      style={{
        background: "color-mix(in oklab, var(--background-elevated) 92%, transparent)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        ref={scrollRef}
        className="no-scrollbar flex gap-[6px] overflow-x-auto overscroll-x-contain py-[4px] sm:gap-[8px]"
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
                // 36 px на чип: нижняя граница требования к размеру контрола.
                // Палец получает 44 — невидимая ::after-коробка добирает по
                // 4px сверху и снизу, попадая в паддинг строки, а не за её
                // край: за краем прокрутка обрезала бы её (замерено — 33).
                'relative h-[36px] shrink-0 whitespace-nowrap rounded-[var(--r-pill)] border px-[12px] text-[13px] leading-none transition-all duration-200 after:absolute after:inset-x-0 after:-inset-y-[4px] after:content-[""] active:scale-[0.98] sm:px-[14px]',
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
