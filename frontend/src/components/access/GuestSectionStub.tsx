import { LogIn } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { resolveMinTier } from "@/lib/feed-guest-access/store";
import { pageTitleKey } from "@/lib/layout/page-titles";

/** True when a guest opened a section that admins keep behind login. */
export function useGuestRouteBlocked(actionKey: string): boolean {
  const { isGuest, config } = useGuestAccess();
  return isGuest && resolveMinTier(actionKey, config) !== "guest";
}

/** Shown in place of a section a guest can't use yet. Opens the shared auth
 *  dialog instead of bouncing the visitor to /login. */
export function GuestSectionStub({
  icon,
  title,
  description,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  const { requireLogin } = useGuestAccess();

  /*
   * Уровень заголовка — у той же таблицы, что ставит скрытый `<h1>` в
   * `AppLayout`, а не своим решением. Два места, решающих про заголовок
   * одной страницы, ровно это и дали: /messenger, /profile и /reviews
   * получили по два `<h1>` — скрытый от оболочки и свой от заслона (замер
   * на стенде 04.10). Теперь ответ один: если оболочка уже дала заголовок,
   * заслон идёт вторым уровнем, иначе берёт первый.
   *
   * Где заслон и есть вся страница, а таблица молчит — /friends, /deals, —
   * его заголовок и есть заголовок страницы. До правки там верхним шёл
   * `h3`, то есть страница начиналась с третьего уровня.
   */
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const уровень = pageTitleKey(pathname) ? "h2" : "h1";

  return (
    // `section`, а не рамка по умолчанию: пунктирная рамка читается как поле
    // формы — будто сюда надо что-то ввести, — а не как «этот раздел пока
    // закрыт». Гость видит ровно то же оформление пустого раздела, что и
    // вошедший, отличается только предложение.
    <EmptyState
      icon={icon as never}
      title={title}
      description={description}
      variant="section"
      headingLevel={уровень}
    >
      <Button size="sm" onClick={() => requireLogin(() => {})}>
        <LogIn size={14} /> Войти
      </Button>
    </EmptyState>
  );
}
