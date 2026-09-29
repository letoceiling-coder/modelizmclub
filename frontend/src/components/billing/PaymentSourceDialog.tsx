import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CreditCard, Gift, Wallet as WalletIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchWalletBalance } from "@/lib/api/wallet";
import { fetchBonusPoints } from "@/lib/api/bonus-points";
import { словоБаллы } from "@/lib/format/plural";
import type { PayWith } from "@/lib/api/payment";

/**
 * Lets the user pick where a paid action is charged from — the internal wallet
 * balance or an external card/acquiring checkout. Shows the current balance and
 * offers a wallet top-up when the balance cannot cover `amountRub`.
 */
export function PaymentSourceDialog({
  open,
  onOpenChange,
  amountRub,
  onSelect,
  onTopUp,
  allowPoints = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amountRub: number;
  onSelect: (source: PayWith) => void;
  onTopUp?: () => void;
  /**
   * Можно ли платить баллами за это. Подписку — нельзя, и решает это не
   * окно: оно только не показывает способ там, где его не предлагают.
   * Цена в баллах приходит с сервера, а не считается из рублёвой.
   */
  allowPoints?: boolean;
}) {
  const { t } = useTranslation();
  const [balanceKopecks, setBalanceKopecks] = useState<number | null>(null);
  const [points, setPoints] = useState<{ balance: number; price: number } | null>(null);
  const [source, setSource] = useState<PayWith>("gateway");

  useEffect(() => {
    if (!open) return;
    setSource("gateway");
    setBalanceKopecks(null);
    setPoints(null);
    fetchWalletBalance()
      .then((b) => setBalanceKopecks(b.balance_kopecks))
      .catch(() => setBalanceKopecks(0));

    if (!allowPoints) return;
    fetchBonusPoints()
      .then((p) =>
        setPoints({
          balance: p.balance,
          price: p.enabled ? p.listing_placement_points : 0,
        }),
      )
      // Молчим и не показываем способ: предложить оплату баллами и не
      // знать цену — хуже, чем не предлагать.
      .catch(() => setPoints({ balance: 0, price: 0 }));
  }, [open, allowPoints]);

  const pointsOffered = allowPoints && points !== null && points.price > 0;
  const pointsCover = pointsOffered && points.balance >= points.price;
  const pointsShort = pointsOffered ? Math.max(0, points.price - points.balance) : 0;

  const balanceKnown = balanceKopecks !== null;
  const walletCovers = balanceKnown && balanceKopecks >= Math.round(amountRub * 100);
  const balanceRub = (balanceKopecks ?? 0) / 100;

  const option = (
    value: PayWith,
    icon: React.ReactNode,
    label: string,
    hint?: string,
    disabled?: boolean,
  ) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setSource(value)}
      className="flex w-full items-center gap-[12px] rounded-[var(--r-card)] border p-[14px] text-left transition-colors disabled:opacity-50"
      style={{
        borderColor: source === value ? "var(--accent)" : "var(--border)",
        background: source === value ? "var(--accent-soft)" : "transparent",
      }}
    >
      <span
        className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full"
        style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
          {label}
        </span>
        {hint && (
          <span
            className="block text-[12px]"
            style={{ color: disabled ? "var(--danger)" : "var(--foreground-50)" }}
          >
            {hint}
          </span>
        )}
      </span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[400px]"
        style={{ background: "var(--background)", borderColor: "var(--border)" }}
      >
        <DialogHeader>
          <DialogTitle>{t("pages.subscription.payChooseTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-[10px]">
          {option(
            "wallet",
            <WalletIcon size={18} />,
            t("pages.subscription.payWithWallet"),
            walletCovers
              ? t("pages.subscription.payWalletBalance", {
                  balance: balanceRub.toLocaleString("ru-RU"),
                })
              : balanceKnown
                ? t("pages.subscription.payInsufficientBalance")
                : undefined,
            balanceKnown && !walletCovers,
          )}
          {pointsOffered &&
            option(
              "points",
              <Gift size={18} />,
              `Бонусными баллами — ${points.price} ${словоБаллы(points.price)}`,
              pointsCover
                ? `На счету ${points.balance} ${словоБаллы(points.balance)}`
                : // Не «недостаточно», а сколько именно не хватает: иначе
                  // человек идёт искать остаток в другое место.
                  `Не хватает ${pointsShort} ${словоБаллы(pointsShort)} — на счету ${points.balance}`,
              !pointsCover,
            )}
          {option("gateway", <CreditCard size={18} />, t("pages.subscription.payWithCard"))}
        </div>
        <DialogFooter className="flex-col gap-[8px] sm:flex-col">
          {balanceKnown && !walletCovers && onTopUp && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                onTopUp();
              }}
            >
              {t("pages.subscription.payWalletTopup")}
            </Button>
          )}
          <Button
            onClick={() => {
              onOpenChange(false);
              onSelect(source);
            }}
            className="w-full"
          >
            {t("pages.subscription.payContinue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
