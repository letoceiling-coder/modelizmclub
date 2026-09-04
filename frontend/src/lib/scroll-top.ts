/**
 * Повторный тап по активному разделу нижней навигации (VK/Авито): страница
 * уезжает наверх, а секция получает шанс обновиться.
 *
 * Событие намеренно «тонкое» — лента и другие разделы подписываются на него
 * сами (`window.addEventListener(SCROLL_TOP_EVENT, ...)`), поэтому навигация
 * не тянет зависимость от их кода.
 */
export const SCROLL_TOP_EVENT = "modelizm:scroll-top";

export interface ScrollTopDetail {
  /** Раздел из getActiveSection(): "feed" | "ads" | … */
  section: string;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Прокручивает документ наверх и уведомляет активный раздел. */
export function scrollSectionToTop(section: string): void {
  if (typeof window === "undefined") return;
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  window.scrollTo({ top: 0, behavior });
  window.dispatchEvent(new CustomEvent<ScrollTopDetail>(SCROLL_TOP_EVENT, { detail: { section } }));
}
