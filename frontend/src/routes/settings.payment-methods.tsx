import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  mir: "МИР",
  maestro: "Maestro",
  unionpay: "UnionPay",
};
function brandLabel(b: string): string {
  return BRAND_LABEL[b.toLowerCase()] ?? (b ? b.charAt(0).toUpperCase() + b.slice(1) : "Карта");
}

function PaymentMethodsSection() {
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

  // Real backend only: load saved cards + surface the binding-return outcome.
  // Demo hosts (neeklo/local) have no billing backend — no fetch, honest note.
  useEffect(() => {
    if (demo) return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get("card");
    if (r === "added") toast.success("Карта привязана");
    else if (r === "failed") toast.error("Не удалось привязать карту");
    if (r) {
      params.delete("card");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  const addCard = async () => {
    setAdding(true);
    try {
      const { binding_url } = await addPaymentMethodBinding();
      window.location.href = binding_url; // provider card-entry page
    } catch {
      toast.error("Не удалось начать привязку карты");
      setAdding(false);
    }
  };

  const removeCard = async (id: string) => {
    setConfirmingId(null);
    try {
      await deletePaymentMethod(id);
      setCards((cs) => cs.filter((c) => c.id !== id));
      toast.success("Карта удалена");
    } catch {
      toast.error("Не удалось удалить карту");
    }
  };

  return (
    <SettingsSectionShell title="Способы оплаты">
      <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
        Карты для оплаты подписки и платных размещений. Номер карты не хранится у
        нас — карта привязывается через защищённый шлюз банка, мы храним только
        токен и последние 4 цифры для отображения.
      </p>

      {demo ? (
        <Card
          className="p-[20px]"
          style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)", background: "var(--background-surface)" }}
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
                Привязка карт будет доступна после подключения эквайринга
              </div>
              <p className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
                В демо-режиме платёжный шлюз не подключён.
              </p>
            </div>
          </div>
        </Card>
      ) : loading ? (
        <div className="flex items-center gap-[8px] py-[24px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
          <Loader2 size={16} className="animate-spin" /> Загрузка…
        </div>
      ) : (
        <>
          {cards.length === 0 ? (
            <Card
              className="p-[20px] text-center"
              style={{ borderColor: "var(--border)", borderStyle: "dashed", borderRadius: "var(--r-card)" }}
            >
              <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>
                Пока нет привязанных карт.
              </p>
            </Card>
          ) : (
            <Card className="divide-y p-0" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
              {cards.map((c) => (
                <div key={c.id} className="flex items-center gap-[12px] px-[16px] py-[14px]" style={{ borderColor: "var(--border)" }}>
                  <span
                    className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[8px]"
                    style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}
                  >
                    <CreditCard size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
                      {brandLabel(c.brand)} •••• {c.last4}
                    </div>
                    {c.is_default && (
                      <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>Основная</div>
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
                        Удалить
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        style={{ color: "var(--foreground-50)" }}
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(c.id)}
                      className="shrink-0 text-[13px]"
                      style={{ color: "var(--foreground-50)" }}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              ))}
            </Card>
          )}

          <Button onClick={addCard} disabled={adding} className="gap-[8px]">
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Добавить карту
          </Button>
        </>
      )}
    </SettingsSectionShell>
  );
}
