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
import type { User } from "@/lib/mock";

const REASONS = ["Спам", "Оскорбления", "Мошенничество", "Нежелательный контент", "Другое"] as const;

/** Reports a friend/recommended user into the same "Книга жалоб и
 *  предложений" pipeline as the general feedback form (src/lib/api/feedback.ts,
 *  reviewed by admins/moderators under Обращения in /admin) — encodes the
 *  reason + target into `subject` since Feedback has no dedicated reason
 *  column, avoiding a backend/migration change for a field the admin UI
 *  already renders as free text. */
export function ComplaintDialog({ target, onClose }: { target: User | null; onClose: () => void }) {
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
      await submitFeedback({
        subject: `Жалоба на пользователя «${target.name}»: ${reason}`,
        message: message.trim() || "(без комментария)",
        page: "/friends",
      });
      toast.success("Спасибо! Обращение принято к рассмотрению");
      reset();
      onClose();
    } catch {
      toast.error("Не удалось отправить обращение. Попробуйте позже");
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
          <DialogTitle>Книга замечаний и предложений</DialogTitle>
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
