import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DealsPageSkeleton } from "@/components/boot/PageSkeletons";

/*
 * Слой над списком сделок и карточкой сделки.
 *
 * До 08.09 здесь же рисовался список — и `<Outlet />` не было вовсе.
 * `/deals/$uuid` объявлен дочерним маршрутом (точка в имени файла даёт
 * вложенность), поэтому по ссылке на сделку открывался список: карточка
 * не имела куда отрисоваться. Проверить это по коду было нельзя, только
 * по адресу — ссылка вела на страницу, которая выглядела рабочей.
 *
 * Список переехал в deals.index.tsx, здесь остались страж и вывод
 * потомка. Страж один на оба маршрута: карточка сделки собственного
 * beforeLoad не имеет и держится на родительском.
 */
export const Route = createFileRoute("/deals")({
  /*
   * Денежный экран требует подтверждённого телефона — ровно ту же ступень,
   * что и маршруты биллинга на сервере.
   *
   * Без стража страница показывала неподтверждённому пустой список сделок,
   * хотя `GET /safe-deals` отвечал 403. Отказ был невидим, а ноль —
   * выдуман: сервер не сказал «ноль», он отказался отвечать. Замер прода
   * 07.09 после закрытия группы Billing.
   *
   * Уровень берётся из карты доступа, как у /messenger: `route.deals`
   * объявлен там `auth`, а `levelFromAccessTier` переводит его в `verified`.
   * Карта не меняется — она наконец применяется.
   */
  beforeLoad: async ({ location }) => {
    const [{ routeGuard, levelFromAccessTier }, { loadFeedGuestAccess, resolveMinTier }] =
      await Promise.all([import("@/lib/gate"), import("@/lib/feed-guest-access/store")]);
    await loadFeedGuestAccess();
    await routeGuard(levelFromAccessTier(resolveMinTier("route.deals")), location);
  },
  component: Outlet,
  pendingComponent: DealsPageSkeleton,
});
