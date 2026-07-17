import { useEffect, useRef, type ReactNode, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  /** Root element — `nav` for tab lists, `div` otherwise. */
  as?: "nav" | "div";
};

const DRAG_THRESHOLD_PX = 4;

/**
 * Horizontal strip: hidden scrollbar, native touch swipe, mouse drag + wheel on desktop.
 */
export function HorizontalScrollNav({ as: Tag = "nav", className, style, children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0, pointerId: -1 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const canScroll = () => el.scrollWidth > el.clientWidth + 1;

    const onWheel = (e: WheelEvent) => {
      if (!canScroll()) return;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = horizontal ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      if (!horizontal) e.preventDefault();
      el.scrollLeft += delta;
    };

    const endDrag = () => {
      if (!drag.current.active) return;
      drag.current.active = false;
      el.classList.remove("is-dragging");
      if (drag.current.pointerId >= 0) {
        try {
          el.releasePointerCapture(drag.current.pointerId);
        } catch {
          /* already released */
        }
      }
      drag.current.pointerId = -1;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (e.button !== 0) return;
      drag.current = {
        active: true,
        moved: false,
        startX: e.pageX,
        scrollLeft: el.scrollLeft,
        pointerId: e.pointerId,
      };
      el.setPointerCapture(e.pointerId);
      el.classList.add("is-dragging");
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const dx = e.pageX - drag.current.startX;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) drag.current.moved = true;
      el.scrollLeft = drag.current.scrollLeft - dx;
    };

    const onClickCapture = (e: MouseEvent) => {
      if (drag.current.moved) {
        e.preventDefault();
        e.stopPropagation();
        drag.current.moved = false;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      className={cn(
        "drag-scroll-x flex w-full gap-[2px] overflow-x-auto overscroll-x-contain no-scrollbar",
        className,
      )}
      style={{ touchAction: "pan-x", WebkitOverflowScrolling: "touch", ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
