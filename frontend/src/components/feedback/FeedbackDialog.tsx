import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { submitFeedback } from "@/lib/api/feedback";

export function FeedbackDialog() {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) {
      toast.error("Напишите сообщение");
      return;
    }
    setSending(true);
    try {
      await submitFeedback({
        subject: subject.trim() || undefined,
        message: text,
        page: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      toast.success("Спасибо! Ваше сообщение отправлено");
      setSubject("");
      setMessage("");
      setOpen(false);
    } catch {
      toast.error("Не удалось отправить. Попробуйте позже");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Обратная связь
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Книга жалоб и предложений</DialogTitle>
          <DialogDescription>
            Расскажите, что улучшить, или сообщите о проблеме — мы читаем каждое сообщение.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Тема (необязательно)"
            maxLength={120}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ваше сообщение…"
            rows={5}
            maxLength={4000}
            className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{message.length}/4000</span>
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
