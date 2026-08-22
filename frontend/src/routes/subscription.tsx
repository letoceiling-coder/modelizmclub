import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Variants } from "framer-motion";
import { motion } from "framer-motion";
import { Zap, CalendarClock } from "lucide-react";
import { toast } from "@/lib/toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { InviteBlock } from "@/components/referral/InviteBlock";
import { ROUTES } from "@/lib/routes";
import { PlanTermSelector } from "@/components/subscription/PlanTermSelector";
import { useMySubscription, formatSubscriptionEndDate, invalidateMySubscription } from "@/lib/subscription";
import { usePublicPlacementPricing } from "@/lib/api/placement-pricing";
import { isAuthenticated } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/demo-mode";
import { VerificationBanner } from "@/components/auth/VerificationBanner";
import { requireVerifiedForAction } from "@/lib/auth/verification";
import { PaymentSourceDialog } from "@/components/billing/PaymentSourceDialog";
import {
  createSubscriptionPayment,
  createListingPlacementPayment,
  fetchMySubscription,
  paymentFailureCopy,
  type PayWith,
} from "@/lib/api/payment";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/subscription")({
  head: () => ({ meta: [{ title: i18n.t("pages.subscription.metaTitle") }] }),
  component: SubscriptionPage,
});

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function daysWord(n: number): string {
  const days = Math.max(0, Math.floor(n));
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return i18n.t("pages.subscription.day");
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return i18n.t("pages.subscription.days2");
  return i18n.t("pages.subscription.days5");
}

function requireAuthForCheckout(navigate: ReturnType<typeof useNavigate>): boolean {
  if (isAuthenticated() || isDemoMode()) return true;
  toast.info(i18n.t("pages.subscription.loginRequired"));
  navigate({ to: "/login", search: { redirect: "/subscription" } });
  return false;
}

async function startSubscriptionCheckout(plan: { id: string; name: string }, source: PayWith) {
  try {
    const checkout = await createSubscriptionPayment(plan.id, source);
    if (checkout.checkout_url) {
      window.location.href = checkout.checkout_url;
      return;
    }
    // Wallet payments come back already "paid".
    invalidateMySubscription();
    const sub = await fetchMySubscription();
    if (source === "wallet") {
      toast.success(i18n.t("pages.subscription.payWalletPaid"));
    } else {
      toast.success(
        sub?.is_active ? i18n.t("pages.subscription.testActivated") : i18n.t("pages.subscription.testConfirmed"),
      );
    }
  } catch {
    toast.error(i18n.t("pages.subscription.payCreateFailed"));
  }
}

async function startPlacementCheckout(source: PayWith) {
  try {
    const checkout = await createListingPlacementPayment({ payWith: source });
    if (checkout.checkout_url) {
      window.location.href = checkout.checkout_url;
      return;
    }
    toast.success(source === "wallet" ? i18n.t("pages.subscription.payWalletPaid") : i18n.t("pages.subscription.oneTimePaid"));
  } catch {
    toast.error(i18n.t("pages.subscription.payCreateFailed"));
  }
}

type PendingCheckout =
  | { kind: "subscription"; plan: { id: string; name: string }; amount: number }
  | { kind: "placement"; amount: number };

function SubscriptionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sub } = useMySubscription();
  const { registeredRub: placementPrice, paymentEnabled } = usePublicPlacementPricing();
  const [pending, setPending] = useState<PendingCheckout | null>(null);

  const openSubscribe = async (plan: { id: string; name: string; priceRub: number }) => {
    if (!requireAuthForCheckout(navigate)) return;
    if (!(await requireVerifiedForAction(navigate))) return;
    if (isDemoMode()) {
      toast(t("pages.subscription.paySoon"), { description: t("pages.subscription.paySoonPlan", { name: plan.name }) });
      return;
    }
    setPending({ kind: "subscription", plan: { id: plan.id, name: plan.name }, amount: plan.priceRub });
  };

  const openPlacement = async () => {
    if (!requireAuthForCheckout(navigate)) return;
    if (!(await requireVerifiedForAction(navigate))) return;
    if (isDemoMode()) {
      toast(t("pages.subscription.paySoon"), { description: t("pages.subscription.paySoonDesc", { price: placementPrice }) });
      return;
    }
    setPending({ kind: "placement", amount: placementPrice });
  };

  const runCheckout = (source: PayWith) => {
    if (!pending) return;
    const job = pending;
    setPending(null);
    if (job.kind === "subscription") void startSubscriptionCheckout(job.plan, source);
    else void startPlacementCheckout(source);
  };

  const daysLeft = Math.max(0, Math.floor(Number(sub?.days_left ?? 0)));
  const totalDays = sub?.plan?.period_days ?? 365;
  const planName = sub?.plan?.name ?? t("pages.subscription.defaultPlanName");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("payment");
    if (!p) return;
    if (p === "success") {
      invalidateMySubscription();
      toast.success(t("pages.subscription.paySuccess"));
    } else if (p === "failed") {
      toast.error(paymentFailureCopy(params.get("reason") ?? undefined, t));
    }
    params.delete("payment");
    params.delete("reason");
    params.delete("uuid");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
  }, [t]);

  useEffect(() => {
    const scrollIfNeeded = () => {
      if (window.location.hash.replace("#", "") !== ROUTES.subscriptionInviteHash) return;
      window.requestAnimationFrame(() => {
        document.getElementById(ROUTES.subscriptionInviteHash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    scrollIfNeeded();
    window.addEventListener("hashchange", scrollIfNeeded);
    return () => window.removeEventListener("hashchange", scrollIfNeeded);
  }, []);

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto w-full max-w-[960px] px-[4px] sm:px-0">
        <VerificationBanner />
        <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
          <span
            className="inline-block uppercase"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 2,
              color: "var(--foreground-50)",
              padding: "4px 12px",
              background: "var(--accent-soft)",
              borderRadius: "var(--r-tag)",
            }}
          >
            {t("pages.subscription.eyebrow")}
          </span>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "var(--fs-h2)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "var(--foreground)",
              marginTop: 16,
            }}
          >
            {t("pages.subscription.title")}
          </h1>
          <p
            style={{
              fontSize: "var(--fs-body-lg)",
              lineHeight: 1.6,
              color: "var(--foreground-70)",
              maxWidth: 600,
              marginTop: 12,
            }}
          >
            {t("pages.subscription.subtitle")}
          </p>
        </motion.div>

        {sub?.is_active && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="mt-[24px] flex flex-col gap-[14px] sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            padding: "18px 20px",
          }}
        >
          <div className="flex items-start gap-[14px]">
            <div
              className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              <CalendarClock size={22} />
            </div>
            <div>
              <div className="flex items-center gap-[8px]">
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
                  {t("pages.subscription.activePlan", { name: planName })}
                </span>
                <span
                  className="inline-block"
                  style={{ fontSize: 11, fontWeight: 600, color: "var(--success)", background: "var(--success-soft)", padding: "2px 8px", borderRadius: "var(--r-tag)" }}
                >
                  {t("pages.subscription.active")}
                </span>
              </div>
              <div className="mt-[4px]" style={{ fontSize: 13, color: "var(--foreground-50)" }}>
                {t("pages.subscription.validUntil", { date: formatSubscriptionEndDate(sub) })}
              </div>
            </div>
          </div>
          <div className="sm:text-right">
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--foreground)", lineHeight: 1 }}>
              {daysLeft} {daysWord(daysLeft)}
            </div>
            <div className="mt-[2px]" style={{ fontSize: 12, color: "var(--foreground-50)" }}>
              {t("pages.subscription.daysLeft")}
            </div>
            <div className="mt-[8px] w-full sm:w-[160px]" style={{ height: 6, background: "var(--background-surface)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(0, (daysLeft / totalDays) * 100))}%`,
                  background: "var(--accent)",
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        </motion.div>
        )}

        <div className="mx-auto mt-[24px] max-w-[420px] md:max-w-[960px]">
          <PlanTermSelector
            renderCta={(plan) => (
              <button
                type="button"
                onClick={() => {
                  if (plan.price <= 0) return;
                  void openSubscribe({ id: plan.id, name: plan.name, priceRub: plan.price });
                }}
                disabled={plan.price <= 0}
                className="inline-flex h-[48px] w-full items-center justify-center rounded-[var(--r-pill)] text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                {plan.price <= 0 ? t("pages.subscription.freePlan") : t("pages.subscription.subscribe")}
              </button>
            )}
          />
        </div>

        {paymentEnabled && (
        <div className="mt-[32px]">
          <div
            className="flex flex-col gap-[16px] sm:flex-row sm:items-center sm:justify-between"
            style={{
              background: "var(--background-elevated)",
              border: "1px dashed var(--border)",
              borderRadius: "var(--r-card-lg)",
              padding: 20,
            }}
          >
            <div className="flex items-start gap-[12px]">
              <div
                className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <Zap size={18} />
              </div>
              <div>
                <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--foreground)" }}>
                  {t("pages.subscription.oneTimeTitle")}
                </h4>
                <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 4, maxWidth: 460 }}>
                  {t("pages.subscription.oneTimeDesc", { price: placementPrice })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-[12px] sm:flex-col sm:items-end">
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--foreground)" }}>
                {placementPrice} ₽
              </div>
              <button
                onClick={() => void openPlacement()}
                className="transition-colors"
                style={{
                  height: 40,
                  padding: "0 20px",
                  background: "var(--accent)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  borderRadius: "var(--r-button)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
              >
                {t("pages.subscription.oneTimeCta")}
              </button>
            </div>
          </div>
        </div>
        )}

        <InviteBlock />
      </div>

      <PaymentSourceDialog
        open={pending !== null}
        onOpenChange={(v) => { if (!v) setPending(null); }}
        amountRub={pending?.amount ?? 0}
        onSelect={runCheckout}
        onTopUp={() => {
          setPending(null);
          void navigate({ to: "/settings/wallet" });
        }}
      />
    </AppLayout>
  );
}
