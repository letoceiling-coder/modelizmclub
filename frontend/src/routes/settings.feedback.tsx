import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessagesSquare } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format/date";
import { fetchMyFeedback, type MyFeedbackItem } from "@/lib/api/feedback";

/**
 * «Мои обращения» — обращения человека и ответы на них.
 *
 * Раздел появился вместе с ответом: до него обращение уходило в одну
 * сторону, а метка «решено» была видна только сотрудникам. Уведомление
 * сообщает, что ответ есть, но целиком его не показывает — в списке
 * уведомлений текст обрезан двумя строками, а ответ на жалобу в две строки
 * не помещается. Сюда уведомление и ведёт.
 */
export const Route = createFileRoute("/settings/feedback")({
  component: MyFeedbackSection,
});

function statusVariant(status: string): "published" | "moderation" | "draft" {
  if (status === "resolved") return "published";
  if (status === "read") return "moderation";
  return "draft";
}

function MyFeedbackSection() {
  const { t } = useTranslation();
  const [items, setItems] = useState<MyFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchMyFeedback()
      .then((rows) => alive && setItems(rows))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SettingsSectionShell title={t("pages.settings.feedbackTitle")}>
      {loading ? null : items.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={t("pages.settings.feedbackEmpty")}
          description={t("pages.settings.feedbackEmptyDesc")}
          variant="compact"
        />
      ) : (
        <div className="flex flex-col gap-[10px]">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-[12px] border px-[14px] py-[12px]"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-[8px]">
                <span className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {item.subject || t("pages.settings.feedbackNoSubject")}
                </span>
                <div className="flex items-center gap-[8px]">
                  <Badge variant={statusVariant(item.status)}>
                    {t(`pages.settings.feedbackStatus.${item.status}`, {
                      defaultValue: item.status,
                    })}
                  </Badge>
                  <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                    {item.createdAt ? formatDate(item.createdAt, "absolute") : ""}
                  </span>
                </div>
              </div>
              <p
                className="mt-[8px] whitespace-pre-wrap text-[13px]"
                style={{ color: "var(--foreground-70)" }}
              >
                {item.message}
              </p>
              {item.reply ? (
                <div
                  className="mt-[10px] rounded-[10px] px-[12px] py-[10px]"
                  style={{
                    background: "var(--background-surface)",
                    borderLeft: "3px solid var(--accent)",
                  }}
                >
                  <div
                    className="text-[11px] font-semibold"
                    style={{ color: "var(--foreground-50)" }}
                  >
                    {t("pages.settings.feedbackReplyLabel")}
                    {item.repliedAt ? ` · ${formatDate(item.repliedAt, "absolute")}` : ""}
                  </div>
                  <p
                    className="mt-[4px] whitespace-pre-wrap text-[13px]"
                    style={{ color: "var(--foreground)" }}
                  >
                    {item.reply}
                  </p>
                </div>
              ) : (
                <p className="mt-[8px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                  {t("pages.settings.feedbackAwaitingReply")}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </SettingsSectionShell>
  );
}
