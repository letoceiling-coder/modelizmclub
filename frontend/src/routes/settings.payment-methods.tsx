import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CreditCard, Plus, Loader2 } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { isDemoMode } from "@/lib/demo-mode";
import {
  fetchPaymentMethods,
  addPaymentMethodBinding,
  deletePaymentMethod,
  type PaymentMethod,
} from "@/lib/api/payment";

export const Route = createFileRoute("/settings/payment-methods")({
  component: PaymentMethodsSection,
});

function PaymentMethodsSection() {
  const { t } = useTranslation();
  const BRAND_LABEL: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    mir: t("pages.settings.cardBrandMir"),
    maestro: "Maestro",
    unionpay: "UnionPay",
  };
  const brandLabel = (b: string): string =>
    BRAND_LABEL[b.toLowerCase()] ??
    (b ? b.charAt(0).toUpperCase() + b.slice(1) : t("pages.settings.cardBrandDefault"));

  const demo = isDemoMode();
  const [cards, setCards] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [adding, setAdding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchPaymentMethods()
      .then(setCards)
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (demo) return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get("card");
    if (r === "added") toast.success(t("pages.settings.paymentAdded"));
    else if (r === "failed") toast.error(t("pages.settings.paymentAddFailed"));
    if (r) {
      params.delete("card");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, t]);

  const addCard = async () => {
    setAdding(true);
    try {
      const { binding_url } = await addPaymentMethodBinding();
      window.location.href = binding_url;
    } catch {
      toast.error(t("pages.settings.paymentBindFailed"));
      setAdding(false);
    }
  };

  const removeCard = async (id: string) => {
    setConfirmingId(null);
    try {
      await deletePaymentMethod(id);
      setCards((cs) => cs.filter((c) => c.id !== id));
      toast.success(t("pages.settings.paymentDeleted"));
    } catch {
      toast.error(t("pages.settings.paymentDeleteFailed"));
    }
  };

  return (
    <SettingsSectionShell title={t("pages.settings.paymentTitle")}>
      <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
        {t("pages.settings.paymentDesc")}
      </p>

      {demo ? (
        <Card
          className="p-[20px]"
          style={{
            borderColor: "var(--border)",
            borderRadius: "var(--r-card)",
            background: "var(--background-surface)",
          }}
        >
          <div className="flex items-start gap-[12px]">
            <span
              className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full"
              style={{ background: "var(--background-elevated)", color: "var(--foreground-50)" }}
            >
              <CreditCard size={20} />
            </span>
            <div>
              <div className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                {t("pages.settings.paymentSoon")}
              </div>
              <p className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
                {t("pages.settings.paymentDemo")}
              </p>
            </div>
          </div>
        </Card>
      ) : loading ? (
        <div
          className="flex items-center gap-[8px] py-[24px] text-[14px]"
          style={{ color: "var(--foreground-50)" }}
        >
          <Loader2 size={16} className="animate-spin" /> {t("pages.settings.loading")}
        </div>
      ) : (
        <>
          {cards.length === 0 ? (
            <Card
              className="p-[20px] text-center"
              style={{
                borderColor: "var(--border)",
                borderStyle: "dashed",
                borderRadius: "var(--r-card)",
              }}
            >
              <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>
                {t("pages.settings.paymentEmpty")}
              </p>
            </Card>
          ) : (
            <Card
              className="divide-y p-0"
              style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
            >
              {cards.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-[12px] px-[16px] py-[14px]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span
                    className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[8px]"
                    style={{
                      background: "var(--background-surface)",
                      color: "var(--foreground-70)",
                    }}
                  >
                    <CreditCard size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
                      {brandLabel(c.brand)} •••• {c.last4}
                    </div>
                    {c.is_default && (
                      <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                        {t("pages.settings.paymentPrimary")}
                      </div>
                    )}
                  </div>
                  {confirmingId === c.id ? (
                    <div className="flex shrink-0 items-center gap-[8px] text-[13px]">
                      <button
                        type="button"
                        onClick={() => removeCard(c.id)}
                        className="font-semibold"
                        style={{ color: "var(--error)" }}
                      >
                        {t("pages.settings.paymentDelete")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        style={{ color: "var(--foreground-50)" }}
                      >
                        {t("pages.settings.paymentCancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(c.id)}
                      className="shrink-0 text-[13px]"
                      style={{ color: "var(--foreground-50)" }}
                    >
                      {t("pages.settings.paymentDelete")}
                    </button>
                  )}
                </div>
              ))}
            </Card>
          )}

          <Button onClick={addCard} disabled={adding} className="gap-[8px]">
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {t("pages.settings.paymentAdd")}
          </Button>
        </>
      )}
    </SettingsSectionShell>
  );
}
