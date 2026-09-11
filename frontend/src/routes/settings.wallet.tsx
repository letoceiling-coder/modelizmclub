import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownLeft, ArrowUpRight, Loader2, Plus, Wallet as WalletIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { usePaymentAttempt } from "@/lib/payments/idempotency";
import {
  fetchWalletBalance,
  fetchWalletTransactions,
  topupWallet,
  withdrawFromWallet,
  isInsufficientFunds,
  type WalletTransaction,
  type WithdrawMethod,
} from "@/lib/api/wallet";
import {
  fetchMyPayments,
  paymentFailureCopy,
  syncPayment,
  type PaymentHistoryItem,
} from "@/lib/api/payment";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { isDemoMode } from "@/lib/demo-mode";
import { notifyBillingChanged } from "@/lib/billing-events";
import { formatDate } from "@/lib/format/date";
import { reportReadFailure } from "@/lib/errors/handle";

type WalletSearch = { payment?: "success" | "failed"; uuid?: string; reason?: string };

export const Route = createFileRoute("/settings/wallet")({
  /*
   * Денежный экран требует подтверждённого телефона — ровно ту же ступень,
   * что и маршруты биллинга на сервере.
   *
   * Без стража страница показывала неподтверждённому «Баланс 0 ₽»,
   * «Операций пока нет» и кнопки «Пополнить» и «Вывести», хотя `GET /wallet`
   * и `GET /wallet/transactions` отвечали 403. Отказ был невидим, а ноль —
   * выдуман: сервер не сказал «ноль», он отказался отвечать. Замер прода
   * 07.09 после закрытия группы Billing.
   *
   * Уровень берётся из карты доступа, как у /messenger: `route.settings`
   * объявлен там `auth`, а `levelFromAccessTier` переводит его в `verified`.
   * Карта не меняется — она наконец применяется.
   */
  beforeLoad: async ({ location }) => {
    const [{ routeGuard, levelFromAccessTier }, { loadFeedGuestAccess, resolveMinTier }] =
      await Promise.all([import("@/lib/gate"), import("@/lib/feed-guest-access/store")]);
    await loadFeedGuestAccess();
    await routeGuard(levelFromAccessTier(resolveMinTier("route.settings")), location);
  },
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

const PAYMENT_PURPOSE_KEYS: Record<string, string> = {
  subscription: "pages.settings.paymentsPurposeSubscription",
  listing: "pages.settings.paymentsPurposeListing",
  listing_boost: "pages.settings.paymentsPurposeListingBoost",
  escrow: "pages.settings.paymentsPurposeEscrow",
  topup: "pages.settings.paymentsPurposeTopup",
  other: "pages.settings.paymentsPurposeOther",
};

/**
 * Назначение платежа словами.
 *
 * Ключ приходит с бэкенда (`PaymentAccountingType`), перевод берётся здесь —
 * иначе экран говорил бы по-русски и в английской, и в китайской версии.
 * `type_label` с бэкенда остаётся запасным: он нужен, если появится
 * назначение, о котором фронт ещё не знает.
 */
function paymentPurpose(t: (key: string) => string, item: PaymentHistoryItem): string {
  const key = PAYMENT_PURPOSE_KEYS[item.type];
  const base = key ? t(key) : item.typeLabel;

  return item.planName ? `${base} — ${item.planName}` : base;
}

function paymentStatusMeta(status: string): {
  labelKey: string;
  variant: "published" | "moderation" | "error" | "draft";
} {
  if (status === "paid")
    return { labelKey: "pages.settings.paymentsStatusPaid", variant: "published" };
  if (status === "pending")
    return { labelKey: "pages.settings.paymentsStatusPending", variant: "moderation" };
  if (status === "cancelled")
    return { labelKey: "pages.settings.paymentsStatusCancelled", variant: "draft" };

  return { labelKey: "pages.settings.paymentsStatusFailed", variant: "error" };
}

function walletStatusMeta(status: WalletTransaction["status"]): {
  labelKey: string;
  variant: "published" | "moderation" | "error";
} {
  if (status === "pending")
    return { labelKey: "pages.settings.walletStatusPending", variant: "moderation" };
  if (status === "failed")
    return { labelKey: "pages.settings.walletStatusFailed", variant: "error" };
  return { labelKey: "pages.settings.walletStatusCompleted", variant: "published" };
}

function WalletSection() {
  const { t } = useTranslation();
  const demo = isDemoMode();
  const navigate = useNavigate();
  const { payment, uuid, reason } = Route.useSearch();
  // null — баланс ещё не пришёл. Раньше до ответа стояло «0 ₽», и когда
  // приходило настоящее число, знак рубля уезжал вправо (CLS 0,002–0,004 на
  // каждом переходе в баланс, замер 11.09).
  const [balanceKopecks, setBalanceKopecks] = useState<number | null>(null);
  const [heldKopecks, setHeldKopecks] = useState(0);
  const [operations, setOperations] = useState<WalletTransaction[]>([]);

  const [topupOpen, setTopupOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [historyTab, setHistoryTab] = useState<"wallet" | "payments">("wallet");

  const load = () => {
    Promise.all([fetchWalletBalance(), fetchWalletTransactions()])
      .then(([b, ops]) => {
        setBalanceKopecks(b.balance_kopecks);
        setHeldKopecks(b.held_kopecks);
        setOperations(ops);
      })
      .catch((e) => {
        setBalanceKopecks((v) => v ?? 0);
        reportReadFailure(e, "баланс кошелька");
      });

    /*
     * Платежи грузятся своим запросом, а не вместе с балансом.
     *
     * Список платежей нужен и тогда, когда кошелёк ответил отказом, и
     * наоборот: это разные права и разные таблицы. В одном `Promise.all`
     * отказ любого из трёх обнулял бы все три.
     */
    fetchMyPayments()
      .then(setPayments)
      .catch((e) => reportReadFailure(e, "история платежей"));
  };

  /*
   * Демо-режим отдельной ветки больше не требует.
   *
   * Раньше здесь стоял `if (demo) return`, а рядом жил второй эффект, который
   * тянул `lib/mock` и клал в состояние `WalletOperation[]` — тип демо-данных,
   * у которого нет ни `kind`, ни `service`, ни `status`. Экран же работает с
   * `WalletTransaction[]`, и присваивание не проходило проверку типов.
   *
   * Разбирать демо-данные экрану и не нужно: `fetchWalletBalance` и
   * `fetchWalletTransactions` сами возвращают демо-значения, уже приведённые к
   * типу API. Второй разбор был копией первого, только неверной.
   */
  useEffect(() => {
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
      return () => {
        alive = false;
      };
    }
    if (!uuid) {
      toast.success(t("pages.settings.walletTopupSuccess"));
      notifyBillingChanged();
      load();
      finish();
      return () => {
        alive = false;
      };
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
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, payment, uuid, reason]);

  return (
    <SettingsSectionShell title={t("pages.settings.walletTitle")}>
      <Card
        className="p-[20px]"
        style={{
          borderColor: "var(--border)",
          borderRadius: "var(--r-card)",
          background: "var(--background-surface)",
        }}
      >
        <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
          {demo ? t("pages.settings.walletDemoBalance") : t("pages.settings.walletBalance")}
        </div>
        <div
          className="mt-[4px] font-display text-[32px] font-bold"
          style={{ color: "var(--foreground)" }}
        >
          {/* Заглушка — внутри той же строки: высоту блока задаёт строка
              в 32 px, а не содержимое, и кнопки ниже не двигаются. */}
          {balanceKopecks === null ? (
            <Skeleton className="inline-block h-[0.8em] w-[4em] align-middle" />
          ) : (
            `${formatRub(balanceKopecks)} ₽`
          )}
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
          <Button
            onClick={() => setWithdrawOpen(true)}
            disabled={demo}
            variant="outline"
            className="gap-[8px]"
          >
            <ArrowUpRight size={16} /> {t("pages.settings.walletWithdraw")}
          </Button>
        </div>
        {demo && (
          <p className="mt-[10px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {t("pages.settings.walletActionsDemo")}
          </p>
        )}
      </Card>

      {/*
        Две истории рядом, а не одна общая.

        Кошелёк показывает движения баланса; платежи — что человек покупал и
        дошло ли это. Списки пересекаются лишь наполовину: карточное
        пополнение даёт и платёж, и проводку — в общем списке оно двоилось бы,
        а платёж, который не прошёл, в кошельке не появляется вовсе. Ради
        таких строк вкладка и заведена: у пользователя с двенадцатью
        неоплаченными подписками кошелёк показывает одно пополнение, и по нему
        никак не понять, что деньги ушли впустую.
      */}
      <div role="tablist" className="flex gap-1.5" aria-label={t("pages.settings.walletHistory")}>
        {(["wallet", "payments"] as const).map((key) => {
          const active = historyTab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setHistoryTab(key)}
              className="min-h-[44px] px-3.5 text-[13px] font-semibold transition-colors"
              style={{
                borderRadius: "var(--r-pill)",
                background: active ? "var(--accent-soft)" : "var(--background-surface)",
                color: active ? "var(--accent)" : "var(--foreground-50)",
                border: "1px solid var(--border)",
              }}
            >
              {key === "wallet"
                ? t("pages.settings.walletTabWallet")
                : t("pages.settings.walletTabPayments")}
            </button>
          );
        })}
      </div>

      <h2 className="text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>
        {historyTab === "wallet"
          ? t("pages.settings.walletHistory")
          : t("pages.settings.paymentsHistory")}
      </h2>

      {historyTab === "payments" && (
        <>
          <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {t("pages.settings.paymentsHint")}
          </p>
          <Card
            className="divide-y p-0"
            style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
          >
            {payments.length === 0 && (
              <div className="px-4 py-3.5 text-[13px]" style={{ color: "var(--foreground-50)" }}>
                {t("pages.settings.paymentsEmpty")}
              </div>
            )}
            {payments.map((item) => {
              const status = paymentStatusMeta(item.status);
              return (
                <div
                  key={item.uuid}
                  className="flex items-start gap-3 px-4 py-3.5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[14px] font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {paymentPurpose(t, item)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant={status.variant} withIcon={false}>
                        {t(status.labelKey)}
                      </Badge>
                      <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                        {formatDate(item.paidAt ?? item.date)}
                      </span>
                    </div>
                  </div>
                  <div
                    className="shrink-0 text-[14px] font-semibold tabular-nums"
                    style={{
                      color: item.status === "paid" ? "var(--foreground)" : "var(--foreground-50)",
                    }}
                  >
                    {formatRub(item.amount)} ₽
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}

      <Card
        className="divide-y p-0"
        hidden={historyTab !== "wallet"}
        style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
      >
        {operations.length === 0 && (
          <div
            className="px-[16px] py-[14px] text-[13px]"
            style={{ color: "var(--foreground-50)" }}
          >
            {t("pages.settings.walletEmpty")}
          </div>
        )}
        {operations.map((op) => {
          const status = walletStatusMeta(op.status);
          const service = walletKindLabel(t, op.kind, op.service || op.title);
          return (
            <div
              key={op.id}
              className="flex items-start gap-[12px] px-[16px] py-[14px]"
              style={{ borderColor: "var(--border)" }}
            >
              <span
                className="grid h-[36px] w-[36px] place-items-center rounded-full"
                style={{
                  background: "var(--background-surface)",
                  color: op.type === "in" ? "var(--success)" : "var(--foreground-50)",
                }}
              >
                {op.type === "in" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-[14px] font-medium"
                  style={{ color: "var(--foreground)" }}
                >
                  {op.title}
                </div>
                <div className="mt-[4px] flex flex-wrap items-center gap-[6px]">
                  <Badge variant={op.type === "in" ? "published" : "draft"} withIcon={false}>
                    {op.type === "in"
                      ? t("pages.settings.walletDirectionIn")
                      : t("pages.settings.walletDirectionOut")}
                  </Badge>
                  <Badge variant="info" withIcon={false}>
                    {service}
                  </Badge>
                  <Badge variant={status.variant} withIcon={false}>
                    {t(status.labelKey)}
                  </Badge>
                </div>
                <div className="mt-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                  {formatDate(op.date, "absolute")}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div
                  className="text-[14px] font-semibold"
                  style={{ color: op.type === "in" ? "var(--success)" : "var(--foreground)" }}
                >
                  {op.type === "in" ? "+" : "−"}
                  {op.amount.toLocaleString("ru-RU")} ₽
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

function TopupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("500");
  const [busy, setBusy] = useState(false);
  // Ключ попытки: один на сумму, пока пополнение не удалось довести до банка.
  const attempt = usePaymentAttempt();

  const submit = async () => {
    const rub = Math.round(Number(amount));
    if (!Number.isFinite(rub) || rub < 100) {
      toast.error(t("pages.settings.walletMinAmount"));
      return;
    }
    setBusy(true);
    try {
      const checkout = await topupWallet(rub, attempt.key(`topup:${rub}`));
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
      <DialogContent
        className="max-w-[400px]"
        style={{ background: "var(--background)", borderColor: "var(--border)" }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-[8px]">
            <WalletIcon size={18} /> {t("pages.settings.walletTopupTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-[6px]">
          <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
            {t("pages.settings.walletAmount")}
          </label>
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
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("pages.settings.walletCancel")}
          </Button>
          <Button onClick={submit} disabled={busy} className="gap-[8px]">
            {busy && <Loader2 size={16} className="animate-spin" />}{" "}
            {t("pages.settings.walletTopupSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
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
      toast.error(
        isInsufficientFunds(err)
          ? t("pages.settings.walletInsufficient")
          : t("pages.settings.walletError"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[400px]"
        style={{ background: "var(--background)", borderColor: "var(--border)" }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-[8px]">
            <ArrowUpRight size={18} /> {t("pages.settings.walletWithdrawTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-[14px]">
          <div className="space-y-[6px]">
            <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
              {t("pages.settings.walletAmount")}
            </label>
            <Input
              type="number"
              min={100}
              step={100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-[6px]">
            <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
              {t("pages.settings.walletMethod")}
            </label>
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
            <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
              {t("pages.settings.walletDestination")}
            </label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={t("pages.settings.walletDestinationPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("pages.settings.walletCancel")}
          </Button>
          <Button onClick={submit} disabled={busy} className="gap-[8px]">
            {busy && <Loader2 size={16} className="animate-spin" />}{" "}
            {t("pages.settings.walletWithdrawSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
