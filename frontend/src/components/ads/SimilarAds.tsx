import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import type { Ad } from "@/lib/mock";
import { MapPin, Tag } from "lucide-react";

/** Scroll the nearest vertical scroll container (e.g. AppLayout <main>) or the window. */
function scrollVerticalFromWheel(origin: HTMLElement, deltaY: number): void {
  let node: HTMLElement | null = origin.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay")
      && node.scrollHeight > node.clientHeight + 1
    ) {
      node.scrollTop += deltaY;
      return;
    }
    node = node.parentElement;
  }
  window.scrollBy({ top: deltaY, behavior: "auto" });
}

/** Prevent overflow-x-auto from hijacking vertical mouse wheel over the row. */
function useVerticalWheelPassthrough<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey) return;
      if (el.scrollWidth <= el.clientWidth + 1) return;

      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      if (absY <= absX) return;

      e.preventDefault();
      scrollVerticalFromWheel(el, e.deltaY);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return ref;
}

/** Single source of truth for how many cards this row always shows — the
 *  caller (ads.$id.tsx) fetches/tiers up to this many real ads, and this
 *  component backfills whatever's left with placeholder cards so the row
 *  is never short a few slots. */
export const SIMILAR_ADS_SLOTS = 12;

export function SimilarAds({ items }: { items: Ad[] }) {
  const placeholderCount = Math.max(0, SIMILAR_ADS_SLOTS - items.length);
  const scrollerRef = useVerticalWheelPassthrough<HTMLDivElement>();

  return (
    <section className="space-y-[16px]">
      <h2 className="font-display text-[22px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
        Похожие объявления
      </h2>
      <div
        ref={scrollerRef}
        className="-mx-[16px] flex snap-x snap-mandatory gap-[12px] overflow-x-auto px-[16px] pb-[8px] sm:mx-0 sm:px-0"
        style={{ scrollbarWidth: "thin", overscrollBehaviorX: "contain" }}
      >
        {items.map((a) => (
          <Link
            key={a.id}
            to="/ads/$id"
            params={{ id: a.id }}
            className="group flex flex-col overflow-hidden snap-start transition-shadow"
            style={{
              flex: "0 0 220px",
              background: "var(--background-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-card)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="overflow-hidden" style={{ aspectRatio: "4 / 3", background: "var(--background-surface)" }}>
              <img
                src={a.image}
                alt={a.title}
                width={440}
                height={330}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-col gap-[6px] p-[12px]">
              <h3 className="text-[13px] font-medium leading-[1.3]" style={{ color: "var(--foreground)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {a.title}
              </h3>
              <div className="font-display text-[16px] font-bold" style={{ color: "var(--foreground)" }}>
                {a.price.toLocaleString("ru")} ₽
              </div>
              <div className="inline-flex items-center gap-[4px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
                <MapPin size={11} /> {a.city}
              </div>
            </div>
          </Link>
        ))}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <SimilarAdPlaceholder key={`similar-placeholder-${i}`} />
        ))}
      </div>
    </section>
  );
}

/** Backfill card for an empty slot in the row — keeps it always exactly
 *  SIMILAR_ADS_SLOTS wide (no short/ragged row) when there simply isn't
 *  enough matching (or even total) inventory yet. Non-interactive. */
function SimilarAdPlaceholder() {
  return (
    <div
      aria-hidden
      className="flex shrink-0 snap-start flex-col overflow-hidden"
      style={{
        flex: "0 0 220px",
        background: "var(--background-elevated)",
        border: "1px dashed var(--border)",
        borderRadius: "var(--r-card)",
      }}
    >
      <div className="grid place-items-center" style={{ aspectRatio: "4 / 3", background: "var(--background-surface)" }}>
        <Tag size={22} style={{ color: "var(--foreground-30)" }} />
      </div>
      <div className="flex flex-col gap-[6px] p-[12px]">
        <span className="text-[13px] font-medium" style={{ color: "var(--foreground-50)" }}>Скоро появятся</span>
      </div>
    </div>
  );
}
