import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrendingUp, Eye, Heart, ClipboardList, Loader2, LineChart } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import type { AdStatusKey } from "@/lib/store";
import { mapListingStatus } from "@/lib/api/listings";
import { fetchMyStats } from "@/lib/api/seller-stats";

export const Route = createFileRoute("/settings/dashboard")({
  component: DashboardSection,
});

const STATUS_LABEL: Partial<Record<AdStatusKey, string>> = {
  active: "Активные",
  moderation: "На модерации",
  rejected: "С ошибками",
  unpublished: "Неопубликованные",
  archived: "Архив",
  draft: "Черновики",
};

function DashboardSection() {
  const [stats, setStats] = useState<{
    active: number;
    total: number;
    views: number;
    favorites: number;
    byStatus: Map<AdStatusKey, number>;
  } | null>(null);

  useEffect(() => {
    let alive = true;
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
      .catch(() => { if (alive) setStats({ active: 0, total: 0, views: 0, favorites: 0, byStatus: new Map() }); });
    return () => { alive = false; };
  }, []);

  if (stats === null) {
    return (
      <SettingsSectionShell title="Статистика">
        <div className="flex items-center gap-[8px] py-[24px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
          <Loader2 size={16} className="animate-spin" /> Загрузка…
        </div>
      </SettingsSectionShell>
    );
  }

  return (
    <SettingsSectionShell title="Статистика">
      <section className="grid grid-cols-2 gap-[10px] sm:grid-cols-4 sm:gap-[12px]">
        <Tile icon={<TrendingUp size={14} />} label="Активных" value={stats.active.toString()} accent />
        <Tile icon={<Eye size={14} />} label="Всего просмотров" value={stats.views.toLocaleString("ru")} />
        <Tile icon={<Heart size={14} />} label="В избранном" value={stats.favorites.toLocaleString("ru")} />
        <Tile icon={<ClipboardList size={14} />} label="Всего объявлений" value={stats.total.toString()} />
      </section>

      {stats.total > 0 && (
        <Card className="divide-y p-0" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
          {(Object.keys(STATUS_LABEL) as AdStatusKey[])
            .filter((k) => (stats.byStatus.get(k) ?? 0) > 0)
            .map((k) => (
              <div key={k} className="flex items-center justify-between px-[16px] py-[12px]" style={{ borderColor: "var(--border)" }}>
                <span className="text-[14px]" style={{ color: "var(--foreground-70)" }}>{STATUS_LABEL[k]}</span>
                <span className="text-[14px] font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>{stats.byStatus.get(k)}</span>
              </div>
            ))}
        </Card>
      )}

      {/* View dynamics — deferred (spec: "делать в последнюю очередь"). No
          per-day data is stored today (only a running views_count), so no
          honest chart can be drawn yet. Placeholder until the backend adds a
          daily-views series (documented in backend-endpoints-needed.md). */}
      <Card className="flex flex-col items-center gap-[8px] p-[24px] text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed", borderRadius: "var(--r-card)" }}>
        <LineChart size={24} style={{ color: "var(--foreground-30)" }} />
        <div className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Динамика просмотров</div>
        <p className="max-w-[360px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
          График просмотров по дням появится позже.
        </p>
      </Card>
    </SettingsSectionShell>
  );
}

function Tile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="flex flex-col gap-[4px] px-[12px] py-[10px] sm:px-[14px] sm:py-[12px]"
      style={{
        background: accent ? "var(--accent-soft)" : "var(--background-surface)",
        border: `1px solid ${accent ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--r-card-sm)",
      }}
    >
      <div className="flex items-center gap-[5px] text-[10.5px] font-semibold uppercase tracking-[0.04em]" style={{ color: accent ? "var(--accent)" : "var(--foreground-50)", fontFamily: "var(--font-mono)" }}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-display text-[18px] font-bold leading-none tabular-nums" style={{ color: accent ? "var(--accent)" : "var(--foreground)", letterSpacing: "-0.01em" }}>
        {value}
      </div>
    </div>
  );
}
