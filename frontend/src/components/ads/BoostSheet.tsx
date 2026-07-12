import { useState } from "react";
import { X, Zap, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { isDemoMode } from "@/lib/demo-mode";
import { BOOST_PACKAGES } from "@/lib/config/boost";
import { createListingBoostPayment, confirmStubPayment } from "@/lib/api/payment";

/**
 * Boost (продвижение) picker for one listing. Pick a package → checkout via
 * the same acquiring as the subscription (Stage 1). Demo hosts have no
 * billing backend → honest "будет доступно" message, no fake purchase.
 */
export function BoostSheet({
  open,
  onClose,
  listingId,
  listingTitle,
}: {
  open: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
}) {
  const [selected, setSelected] = useState(BOOST_PACKAGES[1]?.id ?? BOOST_PACKAGES[0].id);
  const [paying, setPaying] = useState(false);

  if (!open) return null;

  const pay = async () => {
    if (isDemoMode()) {
      toast("Продвижение будет доступно после подключения эквайринга");
      return;
    }
    setPaying(true);
    try {
      const checkout = await createListingBoostPayment(listingId, selected);
      if (checkout.checkout_url) {
        window.location.href = checkout.checkout_url;
        return;
      }
      await confirmStubPayment(checkout.payment_uuid);
      toast.success("Продвижение активировано (тестовый режим)");
      onClose();
    } catch {
      toast.error("Не удалось оформить продвижение");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-t-[20px] p-[20px] sm:rounded-[16px]"
        style={{ background: "var(--background-elevated)", border: "1px solid var(--border)" }}
      >
        <div className="mb-[14px] flex items-start justify-between gap-[12px]">
          <div className="flex items-center gap-[10px]">
            <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Zap size={18} />
            </span>
            <div>
              <div className="text-[16px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
                Продвинуть объявление
              </div>
              <div className="mt-[1px] line-clamp-1 text-[12.5px]" style={{ color: "var(--foreground-50)" }}>{listingTitle}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full" style={{ color: "var(--foreground-50)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-[8px]" role="radiogroup" aria-label="Срок продвижения">
          {BOOST_PACKAGES.map((p) => {
            const active = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(p.id)}
                className="flex items-center justify-between rounded-[var(--r-card-sm)] border px-[14px] py-[12px] text-left transition-colors"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "var(--accent-soft)" : "var(--background-surface)",
                }}
              >
                <span className="text-[14px] font-medium" style={{ color: active ? "var(--accent)" : "var(--foreground)" }}>
                  Продвижение на {p.label}
                </span>
                <span className="text-[15px] font-bold" style={{ fontFamily: "var(--font-display)", color: active ? "var(--accent)" : "var(--foreground)" }}>
                  {p.price} ₽
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={pay}
          disabled={paying}
          className="mt-[16px] inline-flex h-[48px] w-full items-center justify-center gap-[8px] rounded-[var(--r-pill)] text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          {paying && <Loader2 size={16} className="animate-spin" />}
          Оплатить
        </button>
      </div>
    </div>
  );
}
