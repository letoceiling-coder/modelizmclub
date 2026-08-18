import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownLeft, ArrowUpRight, Loader2, Plus, Wallet as WalletIcon } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { mockWalletBalance, mockWalletOperations } from "@/lib/mock";
import {
  fetchWalletBalance,
  fetchWalletTransactions,
  topupWallet,
  withdrawFromWallet,
  isInsufficientFunds,
  type WalletTransaction,
  type WithdrawMethod,
} from "@/lib/api/wallet";
import { confirmStubPayment } from "@/lib/api/payment";
import { isDemoMode } from "@/lib/demo-mode";

export const Route = createFileRoute("/settings/wallet")({
  component: WalletSection,
});

function formatRub(kopecks: number): string {
  return (kopecks / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function WalletSection() {
  const { t } = useTranslation();
  const demo = isDemoMode();
  const [balanceKopecks, setBalanceKopecks] = useState(demo ? mockWalletBalance * 100 : 0);
  const [heldKopecks, setHeldKopecks] = useState(0);
  const [operations, setOperations] = useState<WalletTransaction[]>(demo ? mockWalletOperations : []);
  const [topupOpen, setTopupOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const load = () => {
    Promise.all([fetchWalletBalance(), fetchWalletTransactions()])
      .then(([b, ops]) => {
        setBalanceKopecks(b.balance_kopecks);
        setHeldKopecks(b.held_kopecks);
        setOperations(ops);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (demo) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  return (
    <SettingsSectionShell title={t("pages.settings.walletTitle")}>
      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)", background: "var(--background-surface)" }}>
        <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>{demo ? t("pages.settings.walletDemoBalance") : t("pages.settings.walletBalance")}</div>
        <div className="mt-[4px] font-display text-[32px] font-bold" style={{ color: "var(--foreground)" }}>
          {formatRub(balanceKopecks)} ₽
        </div>
        {heldKopecks > 0 && (
          <div className="mt-[6px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {t("pages.settings.walletHeld")}: {formatRub(heldKopecks)} ₽
          </div>
        )}

        <div className="mt-[16px] flex flex-wrap gap-[10px]">
          <Button onClick={() => setTopupOpen(true)} disabled={demo} className="gap-[8px]">
            <Plus size={16} /> {t("pages.settings.walletTopup")}
          </Button>
          <Button onClick={() => setWithdrawOpen(true)} disabled={demo} variant="outline" className="gap-[8px]">
            <ArrowUpRight size={16} /> {t("pages.settings.walletWithdraw")}
          </Button>
        </div>
        {demo && (
          <p className="mt-[10px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {t("pages.settings.walletActionsDemo")}
          </p>
        )}
      </Card>

      <h2 className="text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>{t("pages.settings.walletHistory")}</h2>
      <Card className="divide-y p-0" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        {operations.length === 0 && (
          <div className="px-[16px] py-[14px] text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("pages.settings.walletEmpty")}</div>
        )}
        {operations.map((op) => (
          <div key={op.id} className="flex items-center gap-[12px] px-[16px] py-[14px]" style={{ borderColor: "var(--border)" }}>
            <span className="grid h-[36px] w-[36px] place-items-center rounded-full" style={{ background: "var(--background-surface)", color: op.type === "in" ? "var(--success)" : "var(--foreground-50)" }}>
              {op.type === "in" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>{op.title}</div>
              <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                {new Date(op.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
            <div className="shrink-0 text-[14px] font-semibold" style={{ color: op.type === "in" ? "var(--success)" : "var(--foreground)" }}>
              {op.type === "in" ? "+" : "−"}{op.amount.toLocaleString("ru-RU")} ₽
            </div>
          </div>
        ))}
      </Card>

      <TopupDialog open={topupOpen} onOpenChange={setTopupOpen} onDone={load} />
      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} onDone={load} />
    </SettingsSectionShell>
  );
}

function TopupDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("500");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const rub = Math.round(Number(amount));
    if (!Number.isFinite(rub) || rub < 100) {
      toast.error(t("pages.settings.walletMinAmount"));
      return;
    }
    setBusy(true);
    try {
      const checkout = await topupWallet(rub);
      if (checkout.checkout_url) {
        window.location.href = checkout.checkout_url;
        return;
      }
      // Stub provider (test contour): no hosted page — confirm to credit the wallet.
      await confirmStubPayment(checkout.payment_uuid);
      toast.success(t("pages.settings.walletTopupSuccess"));
      onOpenChange(false);
      onDone();
    } catch {
      toast.error(t("pages.settings.walletError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-[8px]">
            <WalletIcon size={18} /> {t("pages.settings.walletTopupTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-[6px]">
          <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("pages.settings.walletAmount")}</label>
          <Input
            type="number"
            min={100}
            step={100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>{t("pages.settings.walletCancel")}</Button>
          <Button onClick={submit} disabled={busy} className="gap-[8px]">
            {busy && <Loader2 size={16} className="animate-spin" />} {t("pages.settings.walletTopupSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("500");
  const [method, setMethod] = useState<WithdrawMethod>("card");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const rub = Math.round(Number(amount));
    if (!Number.isFinite(rub) || rub < 100) {
      toast.error(t("pages.settings.walletMinAmount"));
      return;
    }
    if (!destination.trim()) {
      toast.error(t("pages.settings.walletError"));
      return;
    }
    setBusy(true);
    try {
      await withdrawFromWallet({ amount: rub, method, destination: destination.trim() });
      toast.success(t("pages.settings.walletWithdrawSuccess"));
      onOpenChange(false);
      setDestination("");
      onDone();
    } catch (err) {
      toast.error(isInsufficientFunds(err) ? t("pages.settings.walletInsufficient") : t("pages.settings.walletError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-[8px]">
            <ArrowUpRight size={18} /> {t("pages.settings.walletWithdrawTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-[14px]">
          <div className="space-y-[6px]">
            <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("pages.settings.walletAmount")}</label>
            <Input type="number" min={100} step={100} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
          </div>
          <div className="space-y-[6px]">
            <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("pages.settings.walletMethod")}</label>
            <NativeSelect
              value={method}
              onChange={(v) => setMethod(v as WithdrawMethod)}
              options={[
                { value: "card", label: t("pages.settings.walletMethodCard") },
                { value: "sbp", label: t("pages.settings.walletMethodSbp") },
                { value: "account", label: t("pages.settings.walletMethodAccount") },
              ]}
            />
          </div>
          <div className="space-y-[6px]">
            <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("pages.settings.walletDestination")}</label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={t("pages.settings.walletDestinationPlaceholder")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>{t("pages.settings.walletCancel")}</Button>
          <Button onClick={submit} disabled={busy} className="gap-[8px]">
            {busy && <Loader2 size={16} className="animate-spin" />} {t("pages.settings.walletWithdrawSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
