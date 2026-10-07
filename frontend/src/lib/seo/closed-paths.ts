/**
 * Адреса, закрытые от индексации. Промпт 2 шаг 2: «закрытые страницы
 * помечены как неиндексируемые».
 *
 * robots.txt просит поисковик не ходить сюда, но это просьба о обходе, а не
 * о выдаче: адрес, на который ведёт ссылка со стороны, в выдачу попасть
 * может — без содержимого, одним заголовком. Метка на самой странице
 * говорит другое: «нашёл — не показывай». Поэтому нужны оба, и список у них
 * должен быть один.
 *
 * Замер 07.10 на боевой сборке: `/settings`, `/messenger`, `/admin`
 * отвечали 200 и не содержали `meta robots` вовсе.
 *
 * Список сверяется с `public/robots.txt` сторожем: разойтись они не должны,
 * иначе одна из двух защит молча перестаёт работать. Поэтому записи здесь —
 * те же строки, что в `Disallow`, а не их пересказ.
 */
export const CLOSED_PATH_PREFIXES: readonly string[] = [
  "/admin",
  "/settings",
  "/profile",
  "/messenger",
  "/notifications",
  "/friends",
  "/favorites",
  "/my-ads",
  "/ads/new",
  "/communities/new",
  "/channels/new",
  "/reviews/upload",
  "/deals",
  "/safe-deal",
  "/safe-deals",
  "/wallet",
  "/balance",
  "/subscription",
  "/pay/",
  "/login",
  "/register",
  "/recover",
  "/reset-password",
  "/verify-email",
  "/auth",
  "/oauth/",
  "/onboarding",
  "/diag",
  "/r/",
];

/**
 * Закрыт ли адрес. Сравнение по началу пути: `/settings/security` закрыт
 * вместе с `/settings`, а `/adsense` открыт, хотя начинается на `/ads`, —
 * поэтому после совпадения требуется конец строки или `/`.
 */
export function isClosedPath(pathname: string): boolean {
  const путь = pathname.replace(/\/+$/, "") || "/";
  return CLOSED_PATH_PREFIXES.some((p) => {
    const без = p.replace(/\/+$/, "");
    return путь === без || путь.startsWith(`${без}/`);
  });
}
