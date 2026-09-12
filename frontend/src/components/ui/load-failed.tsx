import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * «Не удалось загрузить» с «Повторить».
 *
 * Отказ загрузки и пустой ответ — разные ответы, и выглядеть они обязаны
 * по-разному. В настройках это было перепутано в шести местах сразу: нули в
 * «Статистике», «Пока нет привязанных карт», «0 ₽» в кошельке, пустые «Мои
 * обращения», «Никто не заблокирован», исчезнувшая карта для выплат — всё это
 * показывалось, когда сервер не ответил вовсе (аудит 12.09).
 *
 * Текст один на все места: те же `errors.routeTitle` / `errors.routeDesc` /
 * `errors.retry`, что у `RouteErrorState` и в истории просмотров, — чтобы
 * отказ всюду читался одинаково.
 */
export function LoadFailed({
  icon = AlertTriangle,
  onRetry,
  variant = "compact",
}: {
  icon?: LucideIcon;
  onRetry: () => void;
  variant?: "compact" | "default";
}) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={icon}
      title={t("errors.routeTitle")}
      description={t("errors.routeDesc")}
      action={{ label: t("errors.retry"), onClick: onRetry }}
      variant={variant}
    />
  );
}
