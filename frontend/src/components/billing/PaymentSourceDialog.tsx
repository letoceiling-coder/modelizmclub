import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CreditCard, Wallet as WalletIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchWalletBalance } from "@/lib/api/wallet";
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amountRub: number;
  onSelect: (source: PayWith) => void;
  onTopUp?: () => void;
}) {
  const { t } = useTranslation();
  const [balanceKopecks, setBalanceKopecks] = useState<number | null>(null);
  const [source, setSource] = useState<PayWith>("gateway");

  useEffect(() => {
    if (!open) return;
    setSource("gateway");
    setBalanceKopecks(null);
    fetchWalletBalance()
      .then((b) => setBalanceKopecks(b.balance_kopecks))
      .catch(() => setBalanceKopecks(0));
  }, [open]);

  const balanceKnown = balanceKopecks !== null;
  const walletCovers = balanceKnown && balanceKopecks >= Math.round(amountRub * 100);
  const balanceRub = (balanceKopecks ?? 0) / 100;

  const option = (value: PayWith, icon: React.ReactNode, label: string, hint?: string, disabled?: boolean) => (
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
      <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full" style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium" style={{ color: "var(--foreground)" }}>{label}</span>
        {hint && <span className="block text-[12px]" style={{ color: disabled ? "var(--danger)" : "var(--foreground-50)" }}>{hint}</span>}
      </span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
        <DialogHeader>
          <DialogTitle>{t("pages.subscription.payChooseTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-[10px]">
          {option(
            "wallet",
            <WalletIcon size={18} />,
            t("pages.subscription.payWithWallet"),
            walletCovers
              ? t("pages.subscription.payWalletBalance", { balance: balanceRub.toLocaleString("ru-RU") })
              : balanceKnown
                ? t("pages.subscription.payInsufficientBalance")
                : undefined,
            balanceKnown && !walletCovers,
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
          <Button onClick={() => { onOpenChange(false); onSelect(source); }} className="w-full">
            {t("pages.subscription.payContinue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
