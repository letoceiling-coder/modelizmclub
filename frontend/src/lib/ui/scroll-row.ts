import { useEffect, type RefObject } from "react";

/**
 * Горизонтальный ряд, который прокручивается всем, чем человек пытается.
 *
 * Разбор 16.09: у ряда вкладок мессенджера был только нативный overflow-x.
 * Пальцем по телефону он ехал, а колесо мыши и перетаскивание давали ноль —
 * на всех пяти ширинах видно две вкладки из шести, остальные недоступны без
 * тачпада. Замер: wheel deltaY 300 → scrollLeft 0, drag 200 px → 0.
 *
 * Свайп пальцем остаётся нативным, здесь — колесо и мышь.
 */

/** С какого смещения нажатие становится перетаскиванием, а не кликом. */
export const DRAG_THRESHOLD_PX = 5;

/**
 * Куда уехать от вертикального колеса. null — ряд тут ни при чём: колесо
 * уже горизонтальное (тачпад, Shift) или ряд упёрся в край, и прокрутку
 * нужно отдать странице, а не глотать.
 */
export function wheelScrollTarget(
  deltaX: number,
  deltaY: number,
  scrollLeft: number,
  maxScroll: number,
): number | null {
  if (maxScroll <= 0) return null;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return null;
  const next = Math.min(maxScroll, Math.max(0, scrollLeft + deltaY));
  if (Math.abs(next - scrollLeft) < 0.5) return null;
  return next;
}

export function useScrollRow(ref: RefObject<HTMLElement | null>, deps: readonly unknown[] = []) {
  useEffect(() => {
    const row = ref.current;
    if (!row) return;

    const onWheel = (e: WheelEvent) => {
      // Строки, а не пиксели (Firefox с колесом): одна строка ≈ 16 px.
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? row.clientWidth : 1;
      const target = wheelScrollTarget(
        e.deltaX * scale,
        e.deltaY * scale,
        row.scrollLeft,
        row.scrollWidth - row.clientWidth,
      );
      if (target === null) return;
      e.preventDefault();
      row.scrollLeft = target;
    };

    let pointerId: number | null = null;
    let startX = 0;
    let startScroll = 0;
    let dragged = false;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (row.scrollWidth <= row.clientWidth) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startScroll = row.scrollLeft;
      dragged = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      if (!dragged) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        dragged = true;
        // Захват только после порога: иначе клик по вкладке достаётся ряду.
        try {
          row.setPointerCapture(e.pointerId);
        } catch {
          /* указатель уже отпущен */
        }
        row.style.cursor = "grabbing";
      }
      row.scrollLeft = startScroll - dx;
    };
    const endDrag = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      pointerId = null;
      row.style.cursor = "";
      try {
        row.releasePointerCapture(e.pointerId);
      } catch {
        /* не был захвачен */
      }
    };
    // Отпускание после перетаскивания не должно переключать вкладку.
    const onClickCapture = (e: MouseEvent) => {
      if (!dragged) return;
      dragged = false;
      e.preventDefault();
      e.stopPropagation();
    };
    // Браузер сам тащит кнопки и ссылки как картинки — это перебивает ряд.
    const onDragStart = (e: DragEvent) => e.preventDefault();

    row.addEventListener("wheel", onWheel, { passive: false });
    row.addEventListener("pointerdown", onPointerDown);
    row.addEventListener("pointermove", onPointerMove);
    row.addEventListener("pointerup", endDrag);
    row.addEventListener("pointercancel", endDrag);
    row.addEventListener("click", onClickCapture, true);
    row.addEventListener("dragstart", onDragStart);
    return () => {
      row.removeEventListener("wheel", onWheel);
      row.removeEventListener("pointerdown", onPointerDown);
      row.removeEventListener("pointermove", onPointerMove);
      row.removeEventListener("pointerup", endDrag);
      row.removeEventListener("pointercancel", endDrag);
      row.removeEventListener("click", onClickCapture, true);
      row.removeEventListener("dragstart", onDragStart);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...deps]);
}
