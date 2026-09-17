import type { ReactNode } from "react";
import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";

/**
 * Стрелка «назад» на странице — туда, откуда человек пришёл.
 *
 * До 18.09 у направления она была ссылкой на `/feed`: пришёл из сообществ —
 * стрелка уводила в ленту и клала её в историю новым шагом, а браузерное
 * «назад» после этого возвращало на направление, а не в сообщества.
 *
 * Если в приложении есть куда вернуться, возвращаемся шагом истории: роутер
 * восстанавливает и прежнюю позицию прокрутки (lib/scroll-policy.ts). Если
 * страницу открыли по прямой ссылке, истории нет — ведём на уровень выше.
 * Разметка при этом одна и та же — обычная ссылка на запасной адрес, — и
 * сервер с браузером первого кадра не расходятся.
 */
export function HistoryBackLink({
  fallback,
  params,
  ariaLabel,
  className,
  children,
}: {
  fallback: string;
  params?: Record<string, string>;
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  return (
    <Link
      to={fallback as never}
      params={params as never}
      aria-label={ariaLabel}
      className={className}
      onClick={(e) => {
        if (!canGoBack) return;
        e.preventDefault();
        router.history.back();
      }}
    >
      {children}
    </Link>
  );
}
