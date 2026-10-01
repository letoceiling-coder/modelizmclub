import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedbackForm } from "@/components/feedback/FeedbackDialog";
import { shouldExplainEmptyDirections, useAdminAccess } from "@/lib/admin-access";

/**
 * Администратору направления, которому направлений не назначили.
 *
 * Право на разделы даёт роль, а не список направлений: `content`, `ads` и
 * `moderation` открыты администратору направления по рангу
 * (`App\Support\AdminAccess`). Поэтому он входит в админку, а внутри
 * `CategoryScope` подставляет в запросы пустую выборку — и разделы
 * показывают пустые списки.
 *
 * Отличить это от поломки снаружи нельзя: экран выглядит одинаково и
 * когда направлений нет, и когда сервер не ответил. Плашка «ограничено
 * направлениями: …» в очереди модерации показывалась ровно наоборот —
 * только когда направления есть. Найдено ревью 01.10.
 *
 * Право не меняем: ломать модель прав из-за пустого списка незачем.
 * Меняем молчание — экран говорит, почему пусто и к кому идти.
 *
 * Плашка живёт в оболочке, а не в разделе: роли открыты три раздела, и
 * в каждом пусто по одной и той же причине. И выше `ReducedMotionSwitch`,
 * а не внутри: внутри она перемонтировалась бы и анимировалась на каждом
 * переключении раздела, хотя ничего не менялось.
 *
 * Условие показа — `shouldExplainEmptyDirections` в `lib/admin-access`.
 */
export function EmptyDirectionsNotice() {
  const { t } = useTranslation();
  const access = useAdminAccess();
  const [open, setOpen] = useState(false);

  if (!shouldExplainEmptyDirections(access)) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-[var(--r-card)] p-4"
      style={{
        background: "var(--warning-soft)",
        border: "1px solid var(--border)",
        marginBottom: "16px",
      }}
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="h-5 w-5 shrink-0" style={{ color: "var(--warning)" }} />
        <div className="flex flex-col gap-1">
          <strong style={{ fontSize: "14px" }}>{t("pages.adminShell.noDirectionsTitle")}</strong>
          <span style={{ fontSize: "13px", color: "var(--foreground-70)" }}>
            {t("pages.adminShell.noDirectionsText")}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {/* min-h-11 — 44 px: на телефоне это основное действие плашки. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 rounded-[var(--r-pill)] px-4 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          {t("pages.adminShell.noDirectionsWrite")}
        </button>
        {/* Ответ придёт сюда — иначе «написал и тишина». */}
        <Link
          to="/settings/feedback"
          className="inline-flex min-h-11 items-center text-sm underline"
          style={{ color: "var(--foreground-70)" }}
        >
          {t("pages.adminShell.noDirectionsMine")}
        </Link>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("pages.adminShell.noDirectionsDialogTitle")}</DialogTitle>
            <DialogDescription>{t("pages.adminShell.noDirectionsDialogHint")}</DialogDescription>
          </DialogHeader>
          <FeedbackForm onSent={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
