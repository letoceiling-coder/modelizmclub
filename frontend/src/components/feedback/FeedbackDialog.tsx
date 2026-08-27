import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Icon as SlotIcon } from "@/components/ui/Icon";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { submitFeedback } from "@/lib/api/feedback";
import { getToken } from "@/lib/api/client";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";

const OTHER_DIRECTION = "Другое";
const OPEN_AFTER_LOGIN_KEY = "mc_open_feedback";

export function FeedbackForm({ onSent }: { onSent?: () => void }) {
  const [direction, setDirection] = useState("");
  const [message, setMessage] = useState("");
  const [consentPd, setConsentPd] = useState(false);
  const [sending, setSending] = useState(false);
  const categories = usePostCategories();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) {
      toast.error("Напишите сообщение");
      return;
    }
    if (!consentPd) {
      toast.error("Необходимо согласие на обработку персональных данных");
      return;
    }
    if (!getToken()) {
      toast.error("Войдите в аккаунт, чтобы отправить обращение");
      return;
    }
    setSending(true);
    try {
      await submitFeedback({
        subject: direction || undefined,
        message: text,
        page: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      toast.success("Спасибо! Ваше сообщение отправлено");
      setDirection("");
      setMessage("");
      setConsentPd(false);
      onSent?.();
    } catch (err) {
      toast.error(formatApiErrorMessage(err, "Не удалось отправить. Попробуйте позже"));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <select
        value={direction}
        onChange={(e) => setDirection(e.target.value)}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">Направление (необязательно)</option>
        {categories.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
        <option value={OTHER_DIRECTION}>{OTHER_DIRECTION}</option>
      </select>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ваше сообщение…"
        rows={5}
        maxLength={4000}
        className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
      />
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={consentPd}
          onChange={(e) => setConsentPd(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Согласен(на) на обработку персональных данных (
          <Link to="/legal/consent" className="text-primary underline">
            Согласие на обработку ПД
          </Link>
          )
        </span>
      </label>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{message.length}/4000</span>
        <button
          type="submit"
          disabled={sending || !consentPd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: "var(--accent)" }}
        >
          {sending ? "Отправка…" : "Отправить"}
        </button>
      </div>
    </form>
  );
}

export function FeedbackDialog() {
  const { isGuest, requireLogin } = useGuestAccess();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isGuest || typeof window === "undefined") return;
    if (sessionStorage.getItem(OPEN_AFTER_LOGIN_KEY) !== "1") return;
    sessionStorage.removeItem(OPEN_AFTER_LOGIN_KEY);
    setOpen(true);
  }, [isGuest]);

  function requestOpen() {
    if (isGuest && typeof window !== "undefined") {
      sessionStorage.setItem(OPEN_AFTER_LOGIN_KEY, "1");
    }
    requireLogin(() => setOpen(true));
  }

  return (
    <>
      <button
        type="button"
        onClick={requestOpen}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
      >
        <SlotIcon slot="nav.feedback" className="h-4 w-4" size={16} inheritColor />
        Обратная связь
      </button>
      <Dialog
        open={open && !isGuest}
        onOpenChange={setOpen}
      >
        <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Книга замечаний и предложений</DialogTitle>
          <DialogDescription>
            Расскажите, что улучшить, или сообщите о проблеме — мы читаем каждое сообщение.
          </DialogDescription>
        </DialogHeader>
        <FeedbackForm onSent={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
    </>
  );
}
