import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  cancelEscrowDeal,
  confirmEscrowReceipt,
  escrowStatusLabel,
  fetchEscrowQuote,
  startEscrowCheckout,
  syncEscrowDeal,
  type EscrowDeal,
  type EscrowQuote,
} from "@/lib/api/escrow";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/client";

interface EscrowDealPanelProps {
  listingUuid: string;
  listingPriceRub: number;
  deal: EscrowDeal | null;
  onDealChange: (deal: EscrowDeal | null) => void;
  className?: string;
}

function rub(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString("ru-RU")} ₽`;
}

export function EscrowDealPanel({ listingUuid, listingPriceRub, deal, onDealChange, className }: EscrowDealPanelProps) {
  const [quote, setQuote] = useState<EscrowQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingQuote(true);
    fetchEscrowQuote(listingUuid, 0)
      .then((q) => active && setQuote(q))
      .catch(() => active && setQuote(null))
      .finally(() => active && setLoadingQuote(false));
    return () => {
      active = false;
    };
  }, [listingUuid]);

  const handleBuy = async () => {
    setBusy(true);
    try {
      const result = await startEscrowCheckout(listingUuid);
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      toast.error("Не получена ссылка на оплату");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Не удалось начать оплату";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    if (!deal) return;
    setBusy(true);
    try {
      const updated = await syncEscrowDeal(deal.uuid);
      onDealChange(updated);
      toast.success("Статус обновлён");
    } catch {
      toast.error("Не удалось обновить статус");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!deal) return;
    setBusy(true);
    try {
      const updated = await confirmEscrowReceipt(deal.uuid);
      onDealChange(updated);
      toast.success("Получение подтверждено");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Не удалось подтвердить";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!deal) return;
    setBusy(true);
    try {
      const updated = await cancelEscrowDeal(deal.uuid, "Отмена пользователем");
      onDealChange(updated.status === "cancelled" || updated.status === "reversed" ? null : updated);
      toast.success("Сделка отменена");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Не удалось отменить";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (deal) {
    return (
      <Alert variant="info" className={className}>
        <ShieldCheck size={16} />
        <AlertTitle>Безопасная сделка</AlertTitle>
        <AlertDescription className="flex flex-col gap-[10px]">
          <span>
            Статус: <strong>{escrowStatusLabel(deal.status)}</strong>
            {deal.platform_fee_cents > 0 ? ` · комиссия ${rub(deal.platform_fee_cents)}` : ""}
          </span>
          {deal.status === "pending_payment" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleSync()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              Проверить оплату
            </Button>
          )}
          {deal.can_confirm_receipt && (
            <Button size="sm" disabled={busy} onClick={() => void handleConfirm()}>
              Подтвердить получение
            </Button>
          )}
          {deal.can_cancel && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleCancel()}>
              Отменить сделку
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div
      className={className}
      style={{
        padding: "12px",
        background: "var(--background-surface)",
        borderRadius: "var(--r-card-sm)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-start gap-[8px] text-[12px]" style={{ color: "var(--foreground-70)" }}>
        <ShieldCheck size={14} className="shrink-0 mt-[1px]" />
        <div className="flex-1 min-w-0">
          <p className="font-medium" style={{ color: "var(--foreground)" }}>
            Безопасная сделка
          </p>
          {!loadingQuote && quote && (
            <p className="mt-[4px]">
              К оплате {rub(quote.total_cents)}
              {quote.platform_fee_cents > 0 ? ` (комиссия ${rub(quote.platform_fee_cents)})` : ""}
            </p>
          )}
          {!loadingQuote && !quote && (
            <p className="mt-[4px]">Оплата через платформу с защитой покупателя.</p>
          )}
        </div>
      </div>
      <Button
        size="lg"
        className="w-full mt-[10px] rounded-[var(--r-button)]"
        disabled={busy || loadingQuote}
        loading={busy}
        onClick={() => void handleBuy()}
      >
        Купить безопасно · {listingPriceRub.toLocaleString("ru-RU")} ₽
      </Button>
    </div>
  );
}
