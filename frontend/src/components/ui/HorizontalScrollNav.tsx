import { forwardRef, useCallback, useRef, type ReactNode, type HTMLAttributes } from "react";
import { ScrollRowArrows } from "@/components/ui/ScrollRowArrows";
import { useRowEdges, useScrollRow } from "@/lib/ui/scroll-row";
import { cn } from "@/lib/utils";

type Props = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  /** Root element — `nav` for tab lists, `div` otherwise. */
  as?: "nav" | "div";
  /** Высота стрелок — под высоту ряда, чтобы зона нажатия совпадала. */
  высотаСтрелок?: number;
};

/**
 * Горизонтальная полоса: скрытая полоса прокрутки, родное смахивание пальцем,
 * колесо и перетаскивание мышью, стрелки по краям.
 *
 * ЗДЕСЬ БЫЛИ СВОИ КОЛЕСО И ПЕРЕТАСКИВАНИЕ — вторая реализация того, что
 * лежит в `lib/ui/scroll-row` с 16.09. Отличались они не только тем, что
 * порог перетаскивания был 4 вместо 5: своё колесо отменяло любое
 * вертикальное движение, то есть ряд, упёршийся в край, молча съедал
 * прокрутку страницы. В общей оснастке `wheelScrollTarget` на краю
 * возвращает null и отдаёт прокрутку странице.
 *
 * Стрелок не было вовсе. Замер 06.10, `/my-ads`: переполнение 431 px при
 * 360 и 113 px при 1280, полоса скрыта — то есть мышью «На модерации» и
 * «Архив» были достижимы только угадайкой с колесом.
 *
 * Вместе со своим перетаскиванием ушёл класс `is-dragging`: курсор
 * `grabbing` общая оснастка ставит стилем, а `pointer-events: none` на
 * детях во время тяги заменён её же подавлением щелчка после порога —
 * именно щелчок по вкладке в конце тяги и был настоящей бедой, а не
 * подсветка под курсором.
 */
export const HorizontalScrollNav = forwardRef<HTMLDivElement, Props>(function HorizontalScrollNav(
  { as: Tag = "nav", className, style, children, высотаСтрелок = 44, ...rest },
  forwardedRef,
) {
  const ref = useRef<HTMLDivElement>(null);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  useScrollRow(ref);
  const { края, листать, маска } = useRowEdges(ref);

  return (
    /* Обёртка — опора для стрелок: они стоят поверх краёв ряда. */
    <div className="relative w-full">
      <Tag
        ref={setRef as React.Ref<HTMLDivElement>}
        className={cn(
          /* `overflow-y-hidden`: при `overflow-x: auto` и `overflow-y:
             visible` CSS вычисляет вторую ось как `auto`, ряд становится
             вертикальным прокручиваемым узлом, и Chromium съедает первое
             колесо на его краю. Разбор — в `lib/ui/scroll-row`. */
          "drag-scroll-x no-scrollbar flex w-full gap-[2px] overflow-x-auto overflow-y-hidden overscroll-x-contain",
          className,
        )}
        style={{
          touchAction: "pan-x",
          WebkitOverflowScrolling: "touch",
          maskImage: маска,
          WebkitMaskImage: маска,
          ...style,
        }}
        {...rest}
      >
        {children}
      </Tag>
      <ScrollRowArrows края={края} листать={листать} высота={высотаСтрелок} />
    </div>
  );
});
