import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getViewHistory, type ViewHistoryItem } from "@/lib/view-history";
import { fetchViewHistory, clearViewHistoryRemote } from "@/lib/api/view-history-api";

export const Route = createFileRoute("/settings/history")({
  component: HistorySection,
});

function hrefFor(item: ViewHistoryItem): { to: string; params: Record<string, string> } {
  if (item.kind === "ad") return { to: "/ads/$id", params: { id: item.id } };
  if (item.kind === "review") return { to: "/reviews/$id", params: { id: item.id } };
  if (item.kind === "community") return { to: "/communities/$id", params: { id: item.id } };
  return { to: "/user/$id", params: { id: item.id } };
}

const KIND_LABEL: Record<ViewHistoryItem["kind"], string> = { ad: "Объявление", review: "Обзор", profile: "Профиль", community: "Сообщество" };

function HistorySection() {
  const [items, setItems] = useState<ViewHistoryItem[]>(getViewHistory);

  useEffect(() => {
    let alive = true;
    fetchViewHistory()
      .then((rows) => { if (alive) setItems(rows); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const clear = async () => {
    try {
      await clearViewHistoryRemote();
      setItems([]);
    } catch {
      setItems([]);
    }
  };

  return (
    <SettingsSectionShell title="История просмотров">
      {items.length === 0 ? (
        <EmptyState
          icon={History}
          title="Пока пусто"
          description="Просмотренные объявления и профили появятся здесь"
          variant="compact"
        />
      ) : (
        <>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={clear} className="rounded-[8px]">Очистить историю</Button>
          </div>
          <div className="flex flex-col gap-[8px]">
            {items.map((item) => {
              const h = hrefFor(item);
              return (
                <Link
                  key={`${item.kind}-${item.id}`}
                  to={h.to}
                  params={h.params}
                  className="flex items-center gap-[12px] rounded-[12px] border px-[14px] py-[12px] transition-colors hover:bg-[var(--background-surface)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  {item.thumb && <img src={item.thumb} alt="" className="h-[44px] w-[44px] shrink-0 rounded-[8px] object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>{item.title}</div>
                    <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{KIND_LABEL[item.kind]}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </SettingsSectionShell>
  );
}
