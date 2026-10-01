import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedbackForm } from "@/components/feedback/FeedbackDialog";
import { useAdminAccess, type AdminAccess } from "@/lib/admin-access";

/**
 * Администратору направления, которому направлений не назначили.
 *
 * Право на разделы даёт роль, а не список направлений: `content`, `ads` и
 * `moderation` открыты администратору направления по рангу
 * (`App\Support\AdminAccess`). Поэтому он входит в админку, а внутри
 * `CategoryScope` подставляет в запросы пустую выборку — и все три
 * раздела показывают пустые списки.
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
 * в каждом из них пусто по одной и той же причине.
 */
/**
 * Кому объяснять: только администратору направления и только пока
 * направлений ноль.
 *
 * Владельцу и модератору объяснять нечего — у них нет ограничения по
 * направлениям вовсе. Пока карта прав не приехала (`null`), молчим:
 * плашка, мигнувшая и исчезнувшая, хуже отсутствующей.
 */
export function shouldExplainEmptyDirections(access: AdminAccess | null): boolean {
  return access !== null && access.role === "category_admin" && access.categories.length === 0;
}

export function EmptyDirectionsNotice() {
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
          <strong style={{ fontSize: "14px" }}>Вам не назначены направления</strong>
          <span style={{ fontSize: "13px", color: "var(--foreground-70)" }}>
            Поэтому записи и объявления в ваших разделах пусты — это не поломка. Назначить
            направления может только Владелец.
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[var(--r-pill)] px-4 py-2 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          Написать владельцу
        </button>
        {/* Ответ придёт сюда — иначе «написал и тишина». */}
        <Link
          to="/settings/feedback"
          className="text-sm underline"
          style={{ color: "var(--foreground-70)" }}
        >
          Мои обращения
        </Link>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Обращение к владельцу</DialogTitle>
            <DialogDescription>
              Напишите, какие направления вам нужны. Ответ придёт в «Мои обращения».
            </DialogDescription>
          </DialogHeader>
          <FeedbackForm onSent={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
