import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { loadAnalyticsIfConsented } from "@/lib/cookie-consent";
import { isMetrikaLoaded, metrikaHit } from "@/lib/analytics/metrika";

/**
 * Единственное место, где живёт счётчик на странице.
 *
 * Делает две вещи, каждую из которых легко забыть по отдельности:
 *
 * **Грузит при повторном заходе.** Баннер зовёт `loadAnalyticsIfConsented`
 * только в момент выбора, а показывается он один раз в жизни. Без вызова на
 * монтировании счётчик работал бы ровно у тех, кто прямо сейчас нажал
 * «Принять», и ни у кого больше.
 *
 * **Считает переходы.** Приложение одностраничное: после первой загрузки
 * адрес меняет роутер, и Метрика об этом не узнаёт. Без `hit` на смену
 * адреса в отчётах остался бы один просмотр на всю сессию, а воронка
 * «каталог → карточка → сделка» не собралась бы вовсе.
 *
 * Первый просмотр шлёт сам счётчик при `init`, поэтому здесь пропускается:
 * на первом кадре `isMetrikaLoaded` ещё `false` — скрипт подключается в
 * простое браузера, то есть позже. Иначе первая страница считалась бы дважды.
 */
export function Analytics() {
  const href = useRouterState({ select: (s) => s.location.href });

  useEffect(() => {
    loadAnalyticsIfConsented();
  }, []);

  useEffect(() => {
    if (!isMetrikaLoaded()) return;
    metrikaHit(href);
  }, [href]);

  return null;
}
