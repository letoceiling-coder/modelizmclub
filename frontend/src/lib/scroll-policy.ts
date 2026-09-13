/**
 * Прокрутка при навигации: новый маршрут — наверх, «назад» — прежняя позиция.
 *
 * Обе половины делает роутер (scrollRestoration), но до 13.09 на десктопе не
 * работала ни одна по-настоящему. Там прокручивается не окно, а `<main>`
 * (AppLayout), и роутер не знал, что его надо сбрасывать. Хуже того: для
 * прокручиваемых элементов, которых нет в `scrollToTopSelectors`, роутер
 * переносит запомненную позицию со старой страницы на новую. Переход из
 * середины каналов в обзоры открывал обзоры с середины — замер 13.09: шесть
 * переходов из шестнадцати. Сработавшие десять — это страницы с другой
 * раскладкой, где React просто пересоздавал `<main>`.
 *
 * Отсюда две вещи:
 *
 * 1. `<main>` помечен `data-scroll-restoration-id` и указан в
 *    `SCROLL_TO_TOP_SELECTORS` — его сбрасывают наверх, а на «назад»
 *    восстанавливают по устойчивому селектору, а не по пути nth-child.
 *
 * 2. Сброс — только при смене пути. Внутри страницы адрес меняется постоянно:
 *    `?post=` открывает запись в ленте, `?tab=` переключает вкладку
 *    направления, `?chat=` — диалог. Роутер считает каждое такое изменение
 *    навигацией и сбросил бы прокрутку — лента прыгала бы наверх при каждом
 *    закрытии просмотрщика.
 */

import { getElementScrollRestorationEntry } from "@tanstack/router-core";
import type { AnyRouter } from "@tanstack/react-router";

export const APP_SCROLL_ID = "app-main";

export const SCROLL_TO_TOP_SELECTORS = [`[data-scroll-restoration-id="${APP_SCROLL_ID}"]`];

let lastPathname: string | null = null;

/**
 * Для `createRouter({ scrollRestoration })`. Роутер зовёт её один раз после
 * отрисовки каждой навигации; `false` значит «прокрутку не трогать».
 */
export function scrollOnPathChange({ location }: { location: { pathname: string } }): boolean {
  const pathname = normalize(location.pathname);
  const changed = pathname !== lastPathname;
  lastPathname = pathname;
  return changed;
}

function normalize(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/** Сколько ждать, пока страница дорастёт до восстановленной позиции. */
const HOLD_MS = 3000;

/**
 * «Назад» возвращает позицию и тогда, когда страница ещё не догрузилась.
 *
 * Роутер ставит запомненную позицию один раз, сразу после отрисовки. Список
 * в этот момент ещё без данных или короче прежнего, браузер урезает прокрутку
 * до текущей высоты, и человек оказывается выше, чем был: замер 13.09 —
 * «сообщество → назад» 349 вместо 794, «избранное → назад» на телефоне 0
 * вместо 1600.
 *
 * Здесь, если после смены пути позиция меньше запомненной, её дотягивают по
 * мере роста страницы: до достижения, до HOLD_MS или до первого жеста
 * человека — его собственную прокрутку не перебиваем.
 */
export function holdRestoredScroll(router: AnyRouter): () => void {
  if (typeof window === "undefined") return () => {};
  let stop: (() => void) | null = null;

  const unsubscribe = router.subscribe("onRendered", (event) => {
    stop?.();
    stop = null;
    if (
      event.fromLocation &&
      normalize(event.fromLocation.pathname) === normalize(event.toLocation.pathname)
    )
      return;

    // После обработчика роутера: он подписан раньше и уже выставил позицию.
    requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>(SCROLL_TO_TOP_SELECTORS[0]);
      const mainScrolls = Boolean(
        main && getComputedStyle(main).overflowY !== "visible" && innerWidth >= 1024,
      );
      const target: HTMLElement = mainScrolls && main ? main : document.documentElement;
      const entry = mainScrolls
        ? getElementScrollRestorationEntry(router, { id: APP_SCROLL_ID })
        : getElementScrollRestorationEntry(router, { getElement: () => window });
      const want = entry?.scrollY ?? 0;
      if (want <= 0 || target.scrollTop >= want - 2) return;

      const content = (mainScrolls ? main?.firstElementChild : document.body) as Element | null;
      const apply = () => {
        target.scrollTop = want;
        if (target.scrollTop >= want - 2) finish();
      };
      const observer = new ResizeObserver(apply);
      const timer = window.setTimeout(() => finish(), HOLD_MS);
      const onGesture = () => finish();
      const finish = () => {
        observer.disconnect();
        window.clearTimeout(timer);
        for (const type of ["wheel", "touchstart", "keydown", "pointerdown"] as const) {
          window.removeEventListener(type, onGesture, true);
        }
        stop = null;
      };
      for (const type of ["wheel", "touchstart", "keydown", "pointerdown"] as const) {
        window.addEventListener(type, onGesture, { capture: true, passive: true });
      }
      if (content) observer.observe(content);
      stop = finish;
      apply();
    });
  });

  return () => {
    stop?.();
    unsubscribe();
  };
}

/** Только для тестов. */
export function resetScrollPolicyForTests(): void {
  lastPathname = null;
}
