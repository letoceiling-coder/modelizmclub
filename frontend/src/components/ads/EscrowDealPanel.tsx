import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Loader2, Package, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  cancelEscrowDeal,
  confirmEscrowReceipt,
  escrowStatusLabel,
  fetchEscrowQuote,
  markEscrowShipped,
  openEscrowDispute,
  shipmentStatusLabel,
  startEscrowCheckout,
  syncEscrowDeal,
  type EscrowDeal,
  type EscrowQuote,
} from "@/lib/api/escrow";
import { confirmShipment } from "@/lib/api/shipments";
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
  const [deliveryMode, setDeliveryMode] = useState<"pickup" | "delivery">("pickup");
  const [deliveryRub, setDeliveryRub] = useState("0");
  const [tracking, setTracking] = useState("");

  const deliveryCents = deliveryMode === "delivery" ? Math.max(0, Math.round(Number(deliveryRub.replace(/\s/g, "").replace(",", ".")) * 100) || 0) : 0;

  useEffect(() => {
    let active = true;
    setLoadingQuote(true);
    fetchEscrowQuote(listingUuid, deliveryCents)
      .then((q) => active && setQuote(q))
      .catch(() => active && setQuote(null))
      .finally(() => active && setLoadingQuote(false));
    return () => {
      active = false;
    };
  }, [listingUuid, deliveryCents]);

  const handleBuy = async () => {
    setBusy(true);
    try {
      const result = await startEscrowCheckout(listingUuid, { deliveryAmountCents: deliveryCents });
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      toast.error("Не получена ссылка на оплату");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.errors?.listing?.[0] ?? err.errors?.delivery_amount_cents?.[0] ?? err.message
          : "Не удалось начать оплату";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    if (!deal) return;
    setBusy(true);
    try {
      onDealChange(await syncEscrowDeal(deal.uuid));
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
      onDealChange(await confirmEscrowReceipt(deal.uuid));
      toast.success("Получение подтверждено");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось подтвердить");
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
      toast.error(err instanceof ApiError ? err.message : "Не удалось отменить");
    } finally {
      setBusy(false);
    }
  };

  const handleMarkShipped = async () => {
    if (!deal) return;
    setBusy(true);
    try {
      onDealChange(await markEscrowShipped(deal.uuid, tracking.trim() || undefined));
      toast.success("Отправка отмечена");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось отметить отправку");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCarrier = async () => {
    if (!deal?.shipment) return;
    setBusy(true);
    try {
      await confirmShipment(deal.shipment.uuid);
      onDealChange(await syncEscrowDeal(deal.uuid));
      toast.success("Заказ передан в доставку");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Ошибка подтверждения доставки");
    } finally {
      setBusy(false);
    }
  };

  const handleDispute = async () => {
    if (!deal) return;
    const reason = window.prompt("Опишите проблему (минимум 10 символов):");
    if (!reason || reason.trim().length < 10) return;
    setBusy(true);
    try {
      onDealChange(await openEscrowDispute(deal.uuid, reason.trim()));
      toast.success("Спор открыт");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось открыть спор");
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
            {deal.dispute_status === "open" ? " · спор открыт" : ""}
            {deal.platform_fee_cents > 0 ? ` · комиссия ${rub(deal.platform_fee_cents)}` : ""}
          </span>
          {deal.shipment && (
            <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--foreground-70)" }}>
              <Package size={12} />
              {shipmentStatusLabel(deal.shipment.status)}
              {deal.shipment.tracking_number ? ` · ${deal.shipment.tracking_number}` : ""}
            </span>
          )}
          <Link to="/settings/escrow-deals" className="inline-flex items-center gap-1 text-[12px] underline w-fit" style={{ color: "var(--accent)" }}>
            Все мои сделки <ExternalLink size={11} />
          </Link>
          {deal.status === "pending_payment" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleSync()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              Проверить оплату
            </Button>
          )}
          {deal.can_mark_shipped && (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Трек-номер (необязательно)"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                className="rounded-[8px] border px-2 py-1 text-[13px] w-full"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              />
              <Button size="sm" disabled={busy} onClick={() => void handleMarkShipped()}>
                Отметить отправку
              </Button>
            </div>
          )}
          {deal.can_confirm_shipment && deal.shipment && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleConfirmCarrier()}>
              Подтвердить в СДЭК/Яндекс
            </Button>
          )}
          {deal.can_confirm_receipt && (
            <Button size="sm" disabled={busy} onClick={() => void handleConfirm()}>
              Подтвердить получение
            </Button>
          )}
          {deal.can_open_dispute && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleDispute()}>
              Открыть спор
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
          <Link to="/info/$slug" params={{ slug: "escrow-rules" }} className="mt-[4px] inline-block underline text-[11px]" style={{ color: "var(--accent)" }}>
            Правила безопасной сделки
          </Link>
        </div>
      </div>

      <div className="mt-[10px] flex gap-2">
        <Button size="sm" variant={deliveryMode === "pickup" ? "default" : "outline"} onClick={() => setDeliveryMode("pickup")}>
          Самовывоз
        </Button>
        <Button size="sm" variant={deliveryMode === "delivery" ? "default" : "outline"} onClick={() => setDeliveryMode("delivery")}>
          С доставкой
        </Button>
      </div>
      {deliveryMode === "delivery" && (
        <input
          type="text"
          inputMode="decimal"
          placeholder="Стоимость доставки, ₽"
          value={deliveryRub}
          onChange={(e) => setDeliveryRub(e.target.value)}
          className="mt-[8px] w-full rounded-[8px] border px-3 py-2 text-[14px]"
          style={{ borderColor: "var(--border)", background: "var(--background)" }}
        />
      )}

      {!loadingQuote && quote?.checkout_block_reason && (
        <Alert variant="destructive" className="mt-[10px]">
          <AlertTitle>Оплата недоступна</AlertTitle>
          <AlertDescription>{quote.checkout_block_reason}</AlertDescription>
        </Alert>
      )}

      <Button
        size="lg"
        className="w-full mt-[10px] rounded-[var(--r-button)]"
        disabled={busy || loadingQuote || quote?.can_checkout === false}
        loading={busy}
        onClick={() => void handleBuy()}
      >
        Купить безопасно · {quote ? rub(quote.total_cents) : `${listingPriceRub.toLocaleString("ru-RU")} ₽`}
      </Button>
    </div>
  );
}
