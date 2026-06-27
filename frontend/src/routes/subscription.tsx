import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { Variants } from "framer-motion";
import { motion } from "framer-motion";
import { Check, Gift, Zap } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PaymentModal } from "@/components/PaymentModal";
import { syncPayment, fetchPlans } from "@/lib/api/payments";
import { getAuthToken } from "@/lib/api/auth";
import { ROUTE_SEARCH } from "@/lib/route-search";

export const Route = createFileRoute("/subscription")({
  validateSearch: (s: Record<string, unknown>) => ({
    payment: typeof s.payment === "string" ? s.payment : undefined,
    uuid: typeof s.uuid === "string" ? s.uuid : undefined,
    provider: typeof s.provider === "string" ? s.provider : undefined,
  }),
  head: () => ({ meta: [{ title: tStatic("subscription.metaTitle") }] }),
  component: SubscriptionPage,
});

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};
const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  best?: boolean;
}

function periodLabel(days: number): string {
  if (days >= 360) return tStatic("subscription.periodYear");
  if (days >= 150) return tStatic("subscription.periodHalf");
  return tStatic("subscription.periodMonth");
}

const FEATURE_KEYS = [
  "subscription.featureChannels",
  "subscription.featureAds",
  "subscription.featureMessages",
  "subscription.featurePosts",
  "subscription.featureVoice",
  "subscription.featureSupport",
] as const;

const FREE_LIMIT = 5;
const FREE_LEFT = 3;

type PayTarget = { planSlug: string; title: string; amount: number } | null;

function SubscriptionPage() {
  const { t } = useTranslation();
  const { payment, uuid } = Route.useSearch();
  const navigate = useNavigate();
  const [payTarget, setPayTarget] = useState<PayTarget>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    void fetchPlans()
      .then((items) => {
        const mapped = items.map((p, i) => ({
          id: p.slug,
          name: p.name,
          price: Math.round(p.price_cents / 100),
          period: periodLabel(p.period_days),
          best: items.length >= 3 ? i === 1 : i === 0,
        }));
        setPlans(mapped);
      })
      .catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    if (payment !== "success" || !uuid || !getAuthToken()) return;

    (async () => {
      try {
        const result = await syncPayment(uuid);
        if (result.status === "paid") {
          toast.success(t("payment.success"));
        } else {
          toast.message(t("payment.pendingTitle"), { description: t("payment.pendingDesc") });
        }
      } catch {
        toast.error(t("common.error"));
      } finally {
        navigate({ to: "/subscription", search: ROUTE_SEARCH.subscription, replace: true });
      }
    })();
  }, [payment, uuid, navigate, t]);

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto w-full max-w-[960px] px-[4px] sm:px-0">
        {/* Header */}
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
          >{t("subscription.badge")}</span>
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
          >{t("subscription.pageTitle")}</h1>
          <p
            style={{
              fontSize: "var(--fs-body-lg)",
              lineHeight: 1.6,
              color: "var(--foreground-70)",
              maxWidth: 600,
              marginTop: 12,
            }}
          >{t("subscription.subtitle")}</p>
        </motion.div>

        {/* Free counter */}
        <div
          className="mt-[24px] flex items-center gap-[14px]"
          style={{
            background: "var(--accent-soft)",
            borderRadius: "var(--r-card)",
            padding: "16px 18px",
          }}
        >
          <Gift size={22} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <div className="flex-1">
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
              {t("subscription.freePlacements", { left: FREE_LEFT, limit: FREE_LIMIT })}
            </div>
            <div className="mt-[8px]" style={{ height: 6, background: "var(--background-surface)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${(FREE_LEFT / FREE_LIMIT) * 100}%`,
                  background: "var(--accent)",
                  borderRadius: 3,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        </div>

        {/* Plans */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="mt-[24px] grid grid-cols-1 gap-[16px] md:grid-cols-3"
        >
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} onPay={setPayTarget} />
          ))}
        </motion.div>

        {/* One-time placement */}
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
                  {t("subscription.oneTimeTitle")}
                </h4>
                <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 4, maxWidth: 460 }}>
                  {t("subscription.oneTimeDesc")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-[12px] sm:flex-col sm:items-end">
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--foreground)" }}>
                99 ₽
              </div>
              <button
                onClick={() =>
                  toast(t("subscription.paymentSoon"), {
                    description: t("subscription.paymentOnceDesc"),
                  })
                }
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
                {t("subscription.oneTimeCta")}
              </button>
            </div>
          </div>
        </div>

        {/* Comparison */}
        <section className="mt-[40px]">
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--fs-h3)",
              color: "var(--foreground)",
            }}
          >
            {t("subscription.includedTitle")}
          </h2>
          <p style={{ marginTop: 6, fontSize: 13, color: "var(--foreground-50)" }}>
            {t("subscription.includedDesc")}
          </p>

          <div
            className="mt-[16px] overflow-hidden"
            style={{
              background: "var(--background-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-card)",
            }}
          >
            {/* Table head */}
            <div
              className="grid items-center text-[12px] uppercase"
              style={{
                gridTemplateColumns: "minmax(0,1fr) 56px 56px 56px",
                padding: "12px 16px",
                background: "var(--background-surface)",
                color: "var(--foreground-50)",
                letterSpacing: 1,
                fontFamily: "var(--font-mono)",
              }}
            >
              <div>{t("subscription.compareFeature")}</div>
              <div className="text-center">{t("subscription.compareMonth")}</div>
              <div className="text-center">{t("subscription.compareHalf")}</div>
              <div className="text-center">{t("subscription.compareYear")}</div>
            </div>
            {FEATURE_KEYS.map((key, i) => (
              <div
                key={key}
                className="grid items-center"
                style={{
                  gridTemplateColumns: "minmax(0,1fr) 56px 56px 56px",
                  padding: "14px 16px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  fontSize: 13,
                  color: "var(--foreground)",
                }}
              >
                <div>{t(key)}</div>
                {[0, 1, 2].map((c) => (
                  <div key={c} className="flex justify-center">
                    <Check size={16} style={{ color: "var(--success)" }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      {payTarget && (
        <PaymentModal
          open
          onOpenChange={(open) => { if (!open) setPayTarget(null); }}
          title={payTarget.title}
          amount={payTarget.amount}
          planSlug={payTarget.planSlug}
        />
      )}
    </AppLayout>
  );
}

function PlanCard({ plan, onPay }: { plan: Plan; onPay: (target: NonNullable<PayTarget>) => void }) {
  const { t } = useTranslation();
  const best = !!plan.best;
  const planName = plan.name;
  return (
    <motion.article
      variants={fadeInUp}
      className="relative flex flex-col"
      style={{
        background: best
          ? "linear-gradient(135deg, var(--accent-soft) 0%, var(--background-elevated) 60%)"
          : "var(--background-elevated)",
        border: best ? "2px solid var(--accent)" : "1px solid var(--border)",
        borderRadius: "var(--r-card)",
        padding: "24px 20px",
      }}
    >
      {best && (
        <span
          className="absolute uppercase"
          style={{
            top: 14,
            right: 14,
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: 1,
            padding: "4px 10px",
            borderRadius: "var(--r-tag)",
          }}
        >
          {t("subscription.bestChoice")}
        </span>
      )}
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 18,
          color: best ? "var(--accent)" : "var(--foreground)",
        }}
      >
        {planName}
      </h3>
      <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 36,
            color: best ? "var(--accent)" : "var(--foreground)",
          }}
        >
          {plan.price} ₽
        </span>
        <span style={{ fontSize: 13, color: "var(--foreground-50)" }}>/ {plan.period}</span>
      </div>

      <div style={{ flex: 1 }} />

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => onPay({ planSlug: plan.id, title: planName, amount: plan.price })}
        className="mt-[20px] w-full transition-colors"
        style={{
          height: 48,
          background: "var(--accent)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          borderRadius: "var(--r-button)",
          boxShadow: best ? "var(--shadow-glow-accent)" : "none",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
      >{t("subscription.pay")}</motion.button>
    </motion.article>
  );
}
