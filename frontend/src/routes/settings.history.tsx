import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { History } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { clearViewHistory, getViewHistory, type ViewHistoryItem } from "@/lib/view-history";
import { fetchViewHistory, clearViewHistoryRemote } from "@/lib/api/view-history-api";
import { reportActionFailure, reportReadFailure } from "@/lib/errors/handle";
import { toast } from "@/lib/toast";
import { askConfirm } from "@/lib/ui/ask";

export const Route = createFileRoute("/settings/history")({
  component: HistorySection,
});

function hrefFor(item: ViewHistoryItem): { to: string; params: Record<string, string> } {
  if (item.kind === "ad") return { to: "/ads/$id", params: { id: item.id } };
  if (item.kind === "review") return { to: "/reviews/$id", params: { id: item.id } };
  if (item.kind === "community") return { to: "/communities/$id", params: { id: item.id } };
  return { to: "/user/$id", params: { id: item.id } };
}

function HistorySection() {
  const { t } = useTranslation();
  const KIND_LABEL: Record<ViewHistoryItem["kind"], string> = {
    ad: t("pages.settings.historyKindAd"),
    review: t("pages.settings.historyKindReview"),
    profile: t("pages.settings.historyKindProfile"),
    community: t("pages.settings.historyKindCommunity"),
  };
  const [items, setItems] = useState<ViewHistoryItem[]>(getViewHistory);
  /*
   * Четыре состояния списка, как в избранном и сообществах: данные, отказ с
   * «Повторить», пусто, снова данные. Раньше отказ уходил в никуда, и «не
   * удалось загрузить» выглядело как «вы ничего не смотрели» — ответ, которого
   * сервер не давал.
   */
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchViewHistory()
      .then((rows) => {
        if (!alive) return;
        setItems(rows);
        setLoadFailed(false);
      })
      .catch((e) => {
        if (alive) setLoadFailed(true);
        reportReadFailure(e, "история просмотров");
      });
    return () => {
      alive = false;
    };
  }, [reloadTick]);

  /*
   * Очистка — действие сервера, и список пустеет только после его ответа.
   * До 12.09 `catch` очищал список так же, как `try`: страница показывала
   * пустую историю, хотя сервер ничего не удалил, и после перезагрузки всё
   * возвращалось.
   */
  const clear = async () => {
    if (
      !(await askConfirm({
        title: t("pages.settings.historyClearConfirm"),
        description: t("pages.settings.historyClearConfirmDesc"),
        confirmLabel: t("pages.settings.historyClear"),
        danger: true,
      }))
    )
      return;
    setClearing(true);
    try {
      await clearViewHistoryRemote();
      clearViewHistory();
      setItems([]);
      toast.success(t("pages.settings.historyClearedToast"));
    } catch (e) {
      reportActionFailure(e, t("pages.settings.historyClearFailed"));
    } finally {
      setClearing(false);
    }
  };

  return (
    <SettingsSectionShell title={t("pages.settings.historyTitle")}>
      {loadFailed && items.length === 0 ? (
        <EmptyState
          icon={History}
          title={t("errors.routeTitle")}
          description={t("errors.routeDesc")}
          action={{ label: t("errors.retry"), onClick: () => setReloadTick((n) => n + 1) }}
          variant="compact"
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title={t("pages.settings.historyEmpty")}
          description={t("pages.settings.historyEmptyDesc")}
          variant="compact"
        />
      ) : (
        <>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={clear}
              disabled={clearing}
              className="rounded-[8px]"
            >
              {t("pages.settings.historyClear")}
            </Button>
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
                  {item.thumb && (
                    <img
                      src={item.thumb}
                      width={44}
                      height={44}
                      loading="lazy"
                      decoding="async"
                      alt=""
                      className="h-[44px] w-[44px] shrink-0 rounded-[8px] object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[14px] font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {item.title}
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                      {KIND_LABEL[item.kind]}
                    </div>
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
