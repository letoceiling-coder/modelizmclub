import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownLeft, ArrowUpRight, Loader2, Plus, Wallet as WalletIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { paymentFailureCopy, syncPayment } from "@/lib/api/payment";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { isDemoMode } from "@/lib/demo-mode";
import { notifyBillingChanged } from "@/lib/billing-events";
import { formatDate } from "@/lib/format/date";

type WalletSearch = { payment?: "success" | "failed"; uuid?: string; reason?: string };

export const Route = createFileRoute("/settings/wallet")({
  validateSearch: (s: Record<string, unknown>): WalletSearch => ({
    payment: s.payment === "success" || s.payment === "failed" ? s.payment : undefined,
    uuid: typeof s.uuid === "string" ? s.uuid : undefined,
    reason: typeof s.reason === "string" ? s.reason : undefined,
  }),
  component: WalletSection,
});

function formatRub(kopecks: number): string {
  return (kopecks / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

const WALLET_KIND_KEYS: Record<string, string> = {
  topup: "pages.settings.walletKindTopup",
  subscription: "pages.settings.walletKindSubscription",
  listing_placement: "pages.settings.walletKindListingPlacement",
  safe_deal_hold: "pages.settings.walletKindSafeDealHold",
  safe_deal_release: "pages.settings.walletKindSafeDealRelease",
  safe_deal_commission: "pages.settings.walletKindSafeDealCommission",
  safe_deal_refund: "pages.settings.walletKindSafeDealRefund",
  safe_deal_payout: "pages.settings.walletKindSafeDealPayout",
  referral_bonus: "pages.settings.walletKindReferralBonus",
  promo_bonus: "pages.settings.walletKindPromoBonus",
  withdrawal: "pages.settings.walletKindWithdrawal",
  withdrawal_refund: "pages.settings.walletKindWithdrawalRefund",
};

function walletKindLabel(t: (key: string) => string, kind: string, fallback: string): string {
  const key = WALLET_KIND_KEYS[kind];
  return key ? t(key) : fallback;
}

function walletStatusMeta(status: WalletTransaction["status"]): {
  labelKey: string;
  variant: "published" | "moderation" | "error";
} {
  if (status === "pending") return { labelKey: "pages.settings.walletStatusPending", variant: "moderation" };
  if (status === "failed") return { labelKey: "pages.settings.walletStatusFailed", variant: "error" };
  return { labelKey: "pages.settings.walletStatusCompleted", variant: "published" };
}

function WalletSection() {
  const { t } = useTranslation();
  const demo = isDemoMode();
  const navigate = useNavigate();
  const { payment, uuid, reason } = Route.useSearch();
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
    const onBilling = () => load();
    window.addEventListener("modelizm:billing-changed", onBilling);
    const onFocus = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("modelizm:billing-changed", onBilling);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  useEffect(() => {
    if (demo || !payment) return;
    let alive = true;
    const finish = () => {
      if (!alive) return;
      void navigate({ to: "/settings/wallet", search: {}, replace: true });
    };
    if (payment === "failed") {
      toast.error(
        reason === "insufficient_funds"
          ? t("pages.settings.walletTopupFailedNoFunds")
          : reason === "declined"
            ? t("pages.settings.walletTopupFailedBadCard")
            : t("pages.settings.walletTopupFailed"),
      );
      finish();
      return () => { alive = false; };
    }
    if (!uuid) {
      toast.success(t("pages.settings.walletTopupSuccess"));
      notifyBillingChanged();
      load();
      finish();
      return () => { alive = false; };
    }
    void syncPayment(uuid)
      .then((res) => {
        if (!alive) return;
        if (res.status === "paid") {
          toast.success(t("pages.settings.walletTopupSuccess"));
          notifyBillingChanged();
        } else {
          toast.error(t("pages.settings.walletTopupFailed"));
        }
        load();
      })
      .catch(() => {
        if (alive) toast.error(t("pages.settings.walletError"));
      })
      .finally(finish);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, payment, uuid, reason]);

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
        {operations.map((op) => {
          const status = walletStatusMeta(op.status);
          const service = walletKindLabel(t, op.kind, op.service || op.title);
          return (
            <div key={op.id} className="flex items-start gap-[12px] px-[16px] py-[14px]" style={{ borderColor: "var(--border)" }}>
              <span className="grid h-[36px] w-[36px] place-items-center rounded-full" style={{ background: "var(--background-surface)", color: op.type === "in" ? "var(--success)" : "var(--foreground-50)" }}>
                {op.type === "in" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>{op.title}</div>
                <div className="mt-[4px] flex flex-wrap items-center gap-[6px]">
                  <Badge variant={op.type === "in" ? "published" : "draft"} withIcon={false}>
                    {op.type === "in" ? t("pages.settings.walletDirectionIn") : t("pages.settings.walletDirectionOut")}
                  </Badge>
                  <Badge variant="info" withIcon={false}>{service}</Badge>
                  <Badge variant={status.variant} withIcon={false}>{t(status.labelKey)}</Badge>
                </div>
                <div className="mt-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                  {formatDate(op.date, "absolute")}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[14px] font-semibold" style={{ color: op.type === "in" ? "var(--success)" : "var(--foreground)" }}>
                  {op.type === "in" ? "+" : "−"}{op.amount.toLocaleString("ru-RU")} ₽
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      <TopupDialog open={topupOpen} onOpenChange={setTopupOpen} />
      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} onDone={load} />
    </SettingsSectionShell>
  );
}

function TopupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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
      if (!checkout.checkout_url) {
        toast.error(t("pages.settings.walletTopupVtbMissing"));
        return;
      }
      window.location.href = checkout.checkout_url;
    } catch (err) {
      toast.error(formatApiErrorMessage(err, t("pages.settings.walletError")));
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
          <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {t("pages.settings.walletTopupVtbHint")}
          </p>
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
