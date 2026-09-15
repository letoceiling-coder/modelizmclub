import { useEffect, useRef, type RefObject } from "react";

/**
 * Доступность для окон, собранных вручную (без Radix Dialog): фокус внутрь при
 * открытии, возврат фокуса при закрытии, Escape закрывает.
 *
 * Роль и подпись ставятся на саму панель (`role="dialog"`, `aria-modal`,
 * `aria-labelledby`) — хук их не рисует, он про поведение. До 15.09 у окон
 * «Новый пост», «Продвинуть объявление» и приглашения в групповой звонок не
 * было ни роли, ни фокуса: экранный диктор не узнавал, что открылось окно, а
 * клавиатура оставалась на странице под затемнением (ДФ-4).
 */
export function useDialogA11y(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  options: { escape?: boolean } = {},
): void {
  const escape = options.escape ?? true;
  // onClose часто приходит стрелкой и меняется на каждой отрисовке. В зависимостях
  // эффекта он перезапускал бы его: фокус уходил бы из поля ввода посреди набора.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    // Кадр спустя: панель может появиться анимацией или порталом.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (escape && e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [open, panelRef, escape]);
}
