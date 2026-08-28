import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cancelMySubscription } from "@/lib/api/payment";
import { formatSubscriptionEndDate, invalidateMySubscription, useMySubscription } from "@/lib/subscription";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { ROUTES } from "@/lib/routes";
import { toast } from "@/lib/toast";

/** «Подписка» card on the own profile: status, end date, cancel + manage. */
export function SubscriptionBlock() {
  const { sub, loading } = useMySubscription();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (loading) return null;

  const endsAt = formatSubscriptionEndDate(sub);
  const active = sub?.is_active === true;
  const cancelled = active && sub?.auto_renew === false;

  const statusLabel = !active ? "Неактивна" : cancelled ? "Активна до конца периода" : "Активна";
  const statusColor = !active ? "var(--foreground-50)" : cancelled ? "var(--warning)" : "var(--success)";

  const cancel = async () => {
    setCancelling(true);
    try {
      await cancelMySubscription();
      invalidateMySubscription();
      setConfirmOpen(false);
      toast.success(
        endsAt ? `Подписка отменена, действует до ${endsAt}` : "Подписка отменена",
      );
    } catch (err) {
      toast.error(formatApiErrorMessage(err, "Не удалось отменить подписку"));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div
      className="rounded-[var(--r-card)] border p-[16px]"
      style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <div className="min-w-0">
          <div className="flex items-center gap-[8px]">
            <Crown size={16} style={{ color: "var(--accent)" }} />
            <span className="font-display text-[15px] font-bold" style={{ color: "var(--foreground)" }}>
              Подписка
            </span>
          </div>
          <div className="mt-[6px] text-[13px]" style={{ color: statusColor, fontWeight: 600 }}>
            {statusLabel}
          </div>
          {active && endsAt && (
            <div className="mt-[2px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {cancelled ? `Не продлится после ${endsAt}` : `Действует до ${endsAt}`}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-[8px]">
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.subscription}>Управлять подпиской</Link>
          </Button>
          {active && !cancelled && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
              Отменить подписку
            </Button>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отменить подписку?</DialogTitle>
            <DialogDescription>
              {endsAt
                ? `Подписка будет действовать до ${endsAt}, после чего не продлится.`
                : "Подписка не будет продлеваться автоматически."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={cancelling}>
              Оставить
            </Button>
            <Button onClick={cancel} disabled={cancelling}>
              {cancelling && <Loader2 size={14} className="animate-spin" />} Отменить подписку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
