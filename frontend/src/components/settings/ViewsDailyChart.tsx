import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LineChart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadFailed } from "@/components/ui/load-failed";
import { fetchViewsDaily, type ViewsDailyPoint } from "@/lib/api/seller-stats";
import { reportReadFailure } from "@/lib/errors/handle";

/** Высота поля графика. Одна и та же у заглушки, отказа и самих данных —
 *  иначе блок менял бы высоту после загрузки и уносил вниз всё под собой. */
const PLOT_H = 96;

function buildPath(points: ViewsDailyPoint[], width: number, height: number): string {
  const max = Math.max(1, ...points.map((p) => p.count));
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  return points
    .map((p, i) => {
      const x = i * step;
      const y = height - (p.count / max) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Динамика просмотров за 30 дней.
 *
 * До 12.09 на этом месте стояло «появится позже», хотя сервер отдавал данные
 * (`GET /users/me/stats/views-daily`) и клиентская функция была написана —
 * её просто никто не вызывал. Рисуем своим `svg`: графической библиотеки в
 * проекте нет, а заводить её ради одной ломаной незачем.
 */
export function ViewsDailyChart() {
  const { t } = useTranslation();
  const [points, setPoints] = useState<ViewsDailyPoint[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoadFailed(false);
    fetchViewsDaily("30d")
      .then((rows) => {
        if (alive) setPoints(rows);
      })
      .catch((e) => {
        if (alive) setLoadFailed(true);
        reportReadFailure(e, "динамика просмотров");
      });
    return () => {
      alive = false;
    };
  }, [reloadTick]);

  const total = (points ?? []).reduce((sum, p) => sum + p.count, 0);
  const peak = Math.max(0, ...(points ?? []).map((p) => p.count));

  return (
    <Card
      className="p-[24px]"
      style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-[8px]">
        <div className="flex items-center gap-[8px]">
          <LineChart size={18} style={{ color: "var(--foreground-50)" }} />
          <span className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
            {t("pages.settings.dashboardDynamics")}
          </span>
        </div>
        <span className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.settings.dashboardDynamicsRange")}
        </span>
      </div>

      <div className="mt-[16px]" style={{ height: PLOT_H }}>
        {loadFailed ? (
          <LoadFailed icon={LineChart} onRetry={() => setReloadTick((n) => n + 1)} />
        ) : points === null ? (
          <Skeleton className="h-full w-full rounded-[8px]" />
        ) : total === 0 ? (
          <div
            className="flex h-full items-center justify-center text-center text-[13px]"
            style={{ color: "var(--foreground-50)" }}
          >
            {t("pages.settings.dashboardDynamicsEmpty")}
          </div>
        ) : (
          <svg
            viewBox={`0 0 300 ${PLOT_H}`}
            preserveAspectRatio="none"
            className="h-full w-full"
            role="img"
            aria-label={t("pages.settings.dashboardDynamicsAria", { total, peak })}
          >
            <path
              d={`${buildPath(points, 300, PLOT_H)} L300,${PLOT_H} L0,${PLOT_H} Z`}
              fill="var(--accent-soft)"
            />
            <path
              d={buildPath(points, 300, PLOT_H)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>

      {points !== null && total > 0 && (
        <div className="mt-[12px] flex flex-wrap gap-[24px] text-[13px]">
          <span style={{ color: "var(--foreground-70)" }}>
            {t("pages.settings.dashboardDynamicsTotal", { count: total })}
          </span>
          <span style={{ color: "var(--foreground-70)" }}>
            {t("pages.settings.dashboardDynamicsPeak", { count: peak })}
          </span>
        </div>
      )}
    </Card>
  );
}
