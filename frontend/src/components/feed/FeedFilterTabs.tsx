import { motion } from "framer-motion";

export type FeedFilter = "all" | "following" | "categories" | "saved";

interface Props {
  value: FeedFilter;
  onChange: (v: FeedFilter) => void;
}

const items: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "following", label: "Подписки" },
  { id: "categories", label: "По категориям" },
  { id: "saved", label: "Сохранённое" },
];

export function FeedFilterTabs({ value, onChange }: Props) {
  return (
    <div
      className="sticky top-0 z-20 -mx-3 border-y px-[12px] backdrop-blur lg:mx-0 lg:rounded-[12px] lg:border"
      style={{
        background: "color-mix(in oklab, var(--background) 88%, transparent)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex gap-[4px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => {
          const active = value === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className="relative px-[16px] py-[12px] text-[14px] transition-colors"
              style={{
                color: active ? "var(--foreground)" : "var(--foreground-70)",
                fontWeight: active ? 600 : 500,
              }}
            >
              {it.label}
              {active && (
                <motion.span
                  layoutId="feed-filter-underline"
                  className="absolute inset-x-[8px] -bottom-[1px] h-[2px] rounded-full"
                  style={{ background: "var(--accent)" }}
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
