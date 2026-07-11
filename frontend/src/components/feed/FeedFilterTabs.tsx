export type FeedFilter = "all" | "following" | "categories" | "saved";

interface Props {
  value: FeedFilter;
  onChange: (v: FeedFilter) => void;
}

// Labels kept short so all four tabs fit a 360px viewport WITHOUT horizontal
// scroll: the strip is sticky (always under the finger while scrolling), and
// an overflowing strip pans sideways on diagonal gestures — the reported
// "feed drifts left-right" jank.
const items: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "following", label: "Подписки" },
  { id: "categories", label: "Направления" },
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
      <div className="flex justify-between sm:justify-start sm:gap-[4px]">
        {items.map((it) => {
          const active = value === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className="shrink-0 whitespace-nowrap px-[6px] py-[12px] text-[13.5px] transition-colors sm:px-[16px] sm:text-[14px]"
              style={{
                color: active ? "var(--accent)" : "var(--foreground-70)",
                fontWeight: active ? 600 : 500,
                // Static underline — no cross-strip flight animation.
                boxShadow: active ? "inset 0 -2px 0 var(--accent)" : "none",
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
