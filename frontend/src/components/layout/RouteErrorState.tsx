import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/**
 * Отказ загрузчика маршрута — без потери остального сайта.
 *
 * До 11.09 `errorComponent` был ровно у одного маршрута из 81 — у корневого.
 * Он ловит всё, и любой отказ данных в одном разделе заменял собой страницу
 * целиком: ни шапки, ни навигации, ни возможности уйти в соседний раздел.
 * Для отказа одного запроса это слишком: сайт цел, не приехал один экран.
 *
 * Здесь остаётся оболочка, а внутри — сообщение и «Повторить», которое
 * перезапускает загрузчик маршрута, а не перезагружает вкладку.
 */
export function RouteErrorState({ error, reset }: { error: unknown; reset: () => void }) {
  const { t } = useTranslation();

  useEffect(() => {
    reportLovableError(error, { boundary: "route_error_component" });
  }, [error]);

  return (
    <AppLayout>
      <div className="px-4 py-10">
        <EmptyState
          icon={AlertCircle}
          title={t("errors.routeTitle")}
          description={t("errors.routeDesc")}
          action={{ label: t("errors.retry"), onClick: reset }}
        />
      </div>
    </AppLayout>
  );
}
