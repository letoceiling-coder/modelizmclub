import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { FEED_FILTER_ACTIONS } from "@/lib/feed-guest-access/registry";

export type FeedFilter = "all" | "following" | "categories" | "saved";

interface Props {
  value: FeedFilter;
  onChange: (v: FeedFilter) => void;
}

const items: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "following", label: "Подписки" },
  { id: "categories", label: "Направления" },
  { id: "saved", label: "Сохранённое" },
];

export function FeedFilterTabs({ value, onChange }: Props) {
  const { guardAction } = useGuestAccess();

  return (
    <div
      className="sticky top-0 z-20 -mx-3 border-y px-[10px] py-[7px] backdrop-blur lg:mx-0 lg:rounded-[14px] lg:border"
      style={{
        background: "color-mix(in oklab, var(--background) 88%, transparent)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center gap-[6px] sm:gap-[10px]">
        {items.map((it) => {
          const active = value === it.id;
          return (
            <button
              key={it.id}
              onClick={() => guardAction(FEED_FILTER_ACTIONS[it.id], () => onChange(it.id))}
              className="flex-1 whitespace-nowrap rounded-[10px] px-[8px] py-[11px] text-center text-[14px] transition-colors hover:bg-[var(--background-surface)] sm:flex-none sm:px-[18px]"
              style={{
                color: active ? "var(--accent)" : "var(--foreground-70)",
                fontWeight: active ? 600 : 500,
                background: active ? "var(--accent-soft)" : "transparent",
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
