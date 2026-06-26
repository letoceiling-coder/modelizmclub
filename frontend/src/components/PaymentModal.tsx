import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { confirmStubPayment, createPayment } from "@/lib/api/payments";
import { getAuthToken } from "@/lib/api/auth";

export function PaymentModal({
  open,
  onOpenChange,
  title,
  amount,
  planSlug,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  amount: number;
  planSlug: string;
  onSuccess?: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const providerNote = t("payment.providerNote");

  const handlePay = async () => {
    if (!getAuthToken()) {
      toast.error(t("payment.loginRequired"));
      return;
    }

    setLoading(true);
    try {
      const checkout = await createPayment(planSlug, `plan-${planSlug}-${Date.now()}`);

      if (checkout.checkout_url) {
        onOpenChange(false);
        window.location.href = checkout.checkout_url;
        return;
      }

      if (checkout.provider === "stub") {
        await confirmStubPayment(checkout.payment_uuid);
        onOpenChange(false);
        toast.success(t("payment.success"));
        onSuccess?.();
        return;
      }

      toast.error(t("payment.noCheckoutUrl"));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("common.error");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onClick={() => !loading && onOpenChange(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-primary">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{t("payment.amountDue", { amount })}</p>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">{providerNote}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handlePay}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("payment.pay", { amount })}
          </button>
        </div>
      </div>
    </div>
  );
}
