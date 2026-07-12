import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Eye, Heart, ClipboardList, Loader2, LineChart } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import type { Ad } from "@/lib/mock";
import type { AdStatusKey } from "@/lib/store";
import { fetchMyListings } from "@/lib/api/listings";

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
  const [rows, setRows] = useState<{ ad: Ad; status: AdStatusKey }[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyListings()
      .then((r) => { if (alive) setRows(r); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  const stats = useMemo(() => {
    const list = rows ?? [];
    // Totals span ALL of the seller's listings (not just active) — a seller
    // wants their whole reach. Views/favorites come from each Ad.
    const views = list.reduce((s, x) => s + (x.ad.views ?? 0), 0);
    const favorites = list.reduce((s, x) => s + (x.ad.likes ?? 0), 0);
    const active = list.filter((x) => x.status === "active").length;
    const byStatus = new Map<AdStatusKey, number>();
    for (const { status } of list) byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    return { total: list.length, active, views, favorites, byStatus };
  }, [rows]);

  if (rows === null) {
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
