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
  const drag = useRef({
    pending: false,
    dragging: false,
    suppressClick: false,
    startX: 0,
    scrollLeft: 0,
    pointerId: -1,
  });

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
      const state = drag.current;
      if (!state.pending && !state.dragging) return;
      state.pending = false;
      if (state.dragging) {
        state.dragging = false;
        el.classList.remove("is-dragging");
        if (state.pointerId >= 0) {
          try {
            el.releasePointerCapture(state.pointerId);
          } catch {
            /* already released */
          }
        }
        state.pointerId = -1;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (e.button !== 0) return;
      drag.current = {
        pending: true,
        dragging: false,
        suppressClick: false,
        startX: e.pageX,
        scrollLeft: el.scrollLeft,
        pointerId: e.pointerId,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const state = drag.current;
      if (!state.pending && !state.dragging) return;
      const dx = e.pageX - state.startX;
      if (!state.dragging && Math.abs(dx) > DRAG_THRESHOLD_PX) {
        state.dragging = true;
        state.suppressClick = true;
        el.setPointerCapture(e.pointerId);
        el.classList.add("is-dragging");
        state.pointerId = e.pointerId;
      }
      if (state.dragging) {
        el.scrollLeft = state.scrollLeft - dx;
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      if (drag.current.suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        drag.current.suppressClick = false;
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
