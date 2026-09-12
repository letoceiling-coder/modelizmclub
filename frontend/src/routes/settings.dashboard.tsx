import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TrendingUp, Eye, Heart, ClipboardList, Loader2, LineChart } from "lucide-react";
import { LoadFailed } from "@/components/ui/load-failed";
import { ViewsDailyChart } from "@/components/settings/ViewsDailyChart";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import type { AdStatusKey } from "@/lib/store";
import { mapListingStatus } from "@/lib/api/listings";
import { fetchMyStats } from "@/lib/api/seller-stats";

export const Route = createFileRoute("/settings/dashboard")({
  component: DashboardSection,
});

function DashboardSection() {
  const { t } = useTranslation();
  const STATUS_LABEL: Partial<Record<AdStatusKey, string>> = {
    active: t("pages.settings.statusActive"),
    moderation: t("pages.settings.statusModeration"),
    rejected: t("pages.settings.statusRejected"),
    unpublished: t("pages.settings.statusUnpublished"),
    archived: t("pages.settings.statusArchived"),
    draft: t("pages.settings.statusDraft"),
  };

  const [stats, setStats] = useState<{
    active: number;
    total: number;
    views: number;
    favorites: number;
    byStatus: Map<AdStatusKey, number>;
  } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoadFailed(false);
    fetchMyStats()
      .then((s) => {
        if (!alive) return;
        const byStatus = new Map<AdStatusKey, number>();
        for (const [raw, cnt] of Object.entries(s.by_status ?? {})) {
          byStatus.set(mapListingStatus(raw), cnt);
        }
        setStats({
          active: s.active,
          total: s.total,
          views: s.views_total,
          favorites: s.favorites_total,
          byStatus,
        });
      })
      .catch(() => {
        // Нули — это ответ сервера «ничего нет», а не «сервер не ответил».
        // Раньше отказ подставлял нули, и отличить одно от другого было нельзя.
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [reloadTick]);

  if (loadFailed) {
    return (
      <SettingsSectionShell title={t("pages.settings.dashboardTitle")}>
        <LoadFailed icon={LineChart} onRetry={() => setReloadTick((n) => n + 1)} />
      </SettingsSectionShell>
    );
  }

  if (stats === null) {
    return (
      <SettingsSectionShell title={t("pages.settings.dashboardTitle")}>
        <div
          className="flex items-center gap-[8px] py-[24px] text-[14px]"
          style={{ color: "var(--foreground-50)" }}
        >
          <Loader2 size={16} className="animate-spin" /> {t("pages.settings.loading")}
        </div>
      </SettingsSectionShell>
    );
  }

  return (
    <SettingsSectionShell title={t("pages.settings.dashboardTitle")}>
      <section className="grid grid-cols-2 gap-[10px] sm:grid-cols-4 sm:gap-[12px]">
        <Tile
          icon={<TrendingUp size={14} />}
          label={t("pages.settings.dashboardActive")}
          value={stats.active.toString()}
          accent
        />
        <Tile
          icon={<Eye size={14} />}
          label={t("pages.settings.dashboardViews")}
          value={stats.views.toLocaleString("ru")}
        />
        <Tile
          icon={<Heart size={14} />}
          label={t("pages.settings.dashboardFavorites")}
          value={stats.favorites.toLocaleString("ru")}
        />
        <Tile
          icon={<ClipboardList size={14} />}
          label={t("pages.settings.dashboardTotal")}
          value={stats.total.toString()}
        />
      </section>

      {stats.total > 0 && (
        <Card
          className="divide-y p-0"
          style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
        >
          {(Object.keys(STATUS_LABEL) as AdStatusKey[])
            .filter((k) => (stats.byStatus.get(k) ?? 0) > 0)
            .map((k) => (
              <div
                key={k}
                className="flex items-center justify-between px-[16px] py-[12px]"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="text-[14px]" style={{ color: "var(--foreground-70)" }}>
                  {STATUS_LABEL[k]}
                </span>
                <span
                  className="text-[14px] font-semibold tabular-nums"
                  style={{ color: "var(--foreground)" }}
                >
                  {stats.byStatus.get(k)}
                </span>
              </div>
            ))}
        </Card>
      )}

      <ViewsDailyChart />
    </SettingsSectionShell>
  );
}

function Tile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-[4px] px-[12px] py-[10px] sm:px-[14px] sm:py-[12px]"
      style={{
        background: accent ? "var(--accent-soft)" : "var(--background-surface)",
        border: `1px solid ${accent ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--r-card-sm)",
      }}
    >
      <div
        className="flex items-center gap-[5px] text-[10.5px] font-semibold uppercase tracking-[0.04em]"
        style={{
          color: accent ? "var(--accent)" : "var(--foreground-50)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {icon}
        <span>{label}</span>
      </div>
      <div
        className="font-display text-[18px] font-bold leading-none tabular-nums"
        style={{ color: accent ? "var(--accent)" : "var(--foreground)", letterSpacing: "-0.01em" }}
      >
        {value}
      </div>
    </div>
  );
}
