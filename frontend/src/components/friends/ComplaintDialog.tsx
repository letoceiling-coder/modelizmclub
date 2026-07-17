import { useState } from "react";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { submitFeedback } from "@/lib/api/feedback";
import { COMPLAINT_REASON_TO_API, submitReport, type ReportType } from "@/lib/api/reports";
import { ApiError } from "@/lib/api/client";
import type { User } from "@/lib/mock";

const REASONS = ["Спам", "Оскорбления", "Мошенничество", "Нежелательный контент", "Другое"] as const;

export function ComplaintDialog({
  target,
  onClose,
  page = "/friends",
  subjectSuffix = "",
  contextNote,
  report,
}: {
  target: User | null;
  onClose: () => void;
  /** Page URL stored with the feedback entry (for admin context). */
  page?: string;
  /** Extra detail appended to the subject, e.g. "(сообщение в чате)". */
  subjectSuffix?: string;
  /** Optional context appended to the message body (e.g. reported message text). */
  contextNote?: string;
  /** When set, submit a moderation report (POST /reports) instead of feedback. */
  report?: { type: ReportType; targetId: string };
}) {
  const [reason, setReason] = useState<(typeof REASONS)[number]>(REASONS[0]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const reset = () => {
    setReason(REASONS[0]);
    setMessage("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setSending(true);
    try {
      const description = [
        message.trim() || "(без комментария)",
        contextNote ? `\n\n---\n${contextNote}` : "",
      ].join("");

      if (report) {
        const apiReason = COMPLAINT_REASON_TO_API[reason];
        if (!apiReason) throw new Error("unknown reason");
        await submitReport({
          type: report.type,
          targetId: report.targetId,
          reason: apiReason,
          description,
        });
        toast.success("Жалоба отправлена на модерацию");
      } else {
        await submitFeedback({
          subject: `Жалоба на пользователя «${target.name}»${subjectSuffix}: ${reason}`,
          message: description,
          page,
        });
        toast.success("Спасибо! Обращение принято к рассмотрению");
      }
      reset();
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.errors
            ? Object.values(err.errors)[0]?.[0] ?? err.message
            : err.message
          : "Не удалось отправить обращение. Попробуйте позже";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{report ? "Пожаловаться" : "Книга замечаний и предложений"}</DialogTitle>
          <DialogDescription>
            {target ? `Жалоба на пользователя «${target.name}» — выберите причину и опишите ситуацию.` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Опишите ситуацию подробнее (необязательно)…"
            rows={4}
            maxLength={4000}
            className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={sending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: "var(--accent)" }}
            >
              {sending ? "Отправка…" : "Отправить"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
