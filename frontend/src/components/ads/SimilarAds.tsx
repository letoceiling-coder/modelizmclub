import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Ad } from "@/lib/mock";
import { ChevronLeft, ChevronRight, MapPin, Tag } from "lucide-react";
import { HorizontalScrollNav } from "@/components/ui/HorizontalScrollNav";
import { derivedSrcSet, variantUrl } from "@/lib/media/variants";

const CARD_WIDTH = 220;
const CARD_GAP = 12;

/** Сколько похожих объявлений имеет смысл искать: страница набирает до
 *  этого числа, расширяя поиск по ступеням. Ряд показывает столько,
 *  сколько нашлось, — добивки пустыми карточками здесь больше нет. */
export const SIMILAR_ADS_SLOTS = 12;

export function SimilarAds({ items }: { items: Ad[] }) {
  /*
   * Ряд показывает столько объявлений, сколько нашлось, и ничего больше.
   *
   * Здесь ряд добивался пустыми карточками до двенадцати, чтобы не выходить
   * короче полки. На деле похожих почти всегда меньше: у этого объявления
   * их пять, и рядом рисовалось семь пунктирных плашек «Скоро появятся» —
   * больше половины ряда, не сообщающей ничего. А когда похожих нет вовсе,
   * раздел состоял из заголовка и двенадцати плашек.
   *
   * Горизонтальная полка не обязана быть полной: она прокручивается ровно
   * настолько, сколько в ней есть. Похожих нет — раздела нет.
   */
  const hasReal = items.length > 0;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(maxScroll > 4 && el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollEdges();
    el.addEventListener("scroll", updateScrollEdges, { passive: true });
    const ro = new ResizeObserver(updateScrollEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollEdges);
      ro.disconnect();
    };
  }, [updateScrollEdges, items.length]);

  const scrollByCards = (direction: -1 | 1) => {
    scrollerRef.current?.scrollBy({
      left: direction * (CARD_WIDTH + CARD_GAP) * 2,
      behavior: "smooth",
    });
  };

  if (!hasReal) return null;

  return (
    <section className="space-y-[16px]">
      <h2
        className="font-display text-[22px] font-bold"
        style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
      >
        Похожие объявления
      </h2>
      <div className="relative">
        {canScrollLeft && <ScrollArrow direction="left" onClick={() => scrollByCards(-1)} />}
        {canScrollRight && <ScrollArrow direction="right" onClick={() => scrollByCards(1)} />}
        <HorizontalScrollNav
          ref={scrollerRef}
          as="div"
          className="-mx-[16px] snap-x snap-mandatory gap-[12px] px-[16px] sm:mx-0 sm:px-0"
          style={{ overscrollBehaviorX: "contain" }}
        >
          {items.map((a) => (
            <Link
              key={a.id}
              to="/ads/$id"
              params={{ id: a.id }}
              className="group flex shrink-0 snap-start flex-col overflow-hidden transition-shadow"
              style={{
                width: `${CARD_WIDTH}px`,
                background: "var(--background-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-card)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                className="overflow-hidden"
                style={{ aspectRatio: "4 / 3", background: "var(--background-surface)" }}
              >
                <img
                  /* Карточка 440×330 — вариант `card`, а не исходник. */
                  src={variantUrl(a.image, "card")}
                  srcSet={derivedSrcSet(a.image, ["thumb", "card"])}
                  sizes="(max-width: 640px) 45vw, 220px"
                  decoding="async"
                  alt={a.title}
                  width={440}
                  height={330}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-col gap-[6px] p-[12px]">
                <h3
                  className="text-[13px] font-medium leading-[1.3]"
                  style={{
                    color: "var(--foreground)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {a.title}
                </h3>
                <div
                  className="font-display text-[16px] font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  {a.price.toLocaleString("ru")} ₽
                </div>
                <div
                  className="inline-flex items-center gap-[4px] text-[11px]"
                  style={{ color: "var(--foreground-50)" }}
                >
                  <MapPin size={11} /> {a.city}
                </div>
              </div>
            </Link>
          ))}
        </HorizontalScrollNav>
      </div>
    </section>
  );
}

function ScrollArrow({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={direction === "left" ? "Прокрутить влево" : "Прокрутить вправо"}
      onClick={onClick}
      className="absolute top-1/2 z-[2] hidden h-[36px] w-[36px] -translate-y-1/2 place-items-center rounded-full border shadow-[var(--shadow-card)] transition-opacity hover:opacity-90 sm:grid"
      style={{
        [direction]: "-6px",
        background: "var(--background-elevated)",
        borderColor: "var(--border)",
        color: "var(--foreground-70)",
      }}
    >
      <Icon size={18} />
    </button>
  );
}
