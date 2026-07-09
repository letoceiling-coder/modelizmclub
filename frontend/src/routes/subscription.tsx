import { createFileRoute } from "@tanstack/react-router";
import type { Variants } from "framer-motion";
import { motion } from "framer-motion";
import { Check, Gift, Zap, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { InviteBlock } from "@/components/referral/InviteBlock";
import { PRICING_PLANS, PRICING_FEATURES, type PricingPlan } from "@/lib/config/pricing";
import { subscriptionEndDate, SUB_DAYS_LEFT } from "@/lib/subscription";

export const Route = createFileRoute("/subscription")({
  head: () => ({ meta: [{ title: "Подписка — МоДелизМ" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    await requireAuth(location);
  },
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

const PLANS = PRICING_PLANS;
const FEATURES = PRICING_FEATURES;

const FREE_LIMIT = 5;
const FREE_LEFT = 3;

// Demo subscription state. SUB_DAYS_LEFT is imported from lib/subscription
// (single source of truth shared with the sidebar end-date).
// On the real backend this comes from the user's active subscription record.
const SUB_TOTAL_DAYS = 365;
const SUB_PLAN_NAME = "Год";
function daysWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}

function payClick(planName: string) {
  toast("Оплата будет доступна после подключения эквайринга", {
    description: `Тариф: ${planName}`,
  });
}

function SubscriptionPage() {
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
          >
            ТАРИФЫ
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
            Подписка МоДелизМ
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
            Один набор возможностей — выбирайте срок. Все тарифы дают одинаковый доступ к платформе.
          </p>
        </motion.div>

        {/* Active subscription — the single place the countdown lives */}
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
                  Подписка «{SUB_PLAN_NAME}» активна
                </span>
                <span
                  className="inline-block"
                  style={{ fontSize: 11, fontWeight: 600, color: "var(--success)", background: "var(--success-soft)", padding: "2px 8px", borderRadius: "var(--r-tag)" }}
                >
                  активна
                </span>
              </div>
              <div className="mt-[4px]" style={{ fontSize: 13, color: "var(--foreground-50)" }}>
                Действует до {subscriptionEndDate()}
              </div>
            </div>
          </div>
          <div className="sm:text-right">
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--foreground)", lineHeight: 1 }}>
              {SUB_DAYS_LEFT} {daysWord(SUB_DAYS_LEFT)}
            </div>
            <div className="mt-[2px]" style={{ fontSize: 12, color: "var(--foreground-50)" }}>
              до окончания
            </div>
            <div className="mt-[8px] w-full sm:w-[160px]" style={{ height: 6, background: "var(--background-surface)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${(SUB_DAYS_LEFT / SUB_TOTAL_DAYS) * 100}%`,
                  background: "var(--accent)",
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* Free counter */}
        <div
          className="mt-[16px] flex items-center gap-[14px]"
          style={{
            background: "var(--accent-soft)",
            borderRadius: "var(--r-card)",
            padding: "16px 18px",
          }}
        >
          <Gift size={22} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <div className="flex-1">
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
              Бесплатные размещения: {FREE_LEFT} из {FREE_LIMIT}
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
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} />
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
                  Разовое размещение
                </h4>
                <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 4, maxWidth: 460 }}>
                  Одно объявление за 99 ₽ — без подписки и обязательств. Для тех, кому нужен разовый показ, а не постоянный доступ.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-[12px] sm:flex-col sm:items-end">
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--foreground)" }}>
                99 ₽
              </div>
              <button
                onClick={() =>
                  toast("Оплата будет доступна после подключения эквайринга", {
                    description: "Разовое размещение — 99 ₽",
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
                Разместить
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
            Что входит
          </h2>
          <p style={{ marginTop: 6, fontSize: 13, color: "var(--foreground-50)" }}>
            Набор возможностей одинаковый для всех тарифов — отличается только срок.
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
              <div>Возможность</div>
              <div className="text-center">Мес</div>
              <div className="text-center">6 мес</div>
              <div className="text-center">Год</div>
            </div>
            {FEATURES.map((f, i) => (
              <div
                key={f}
                className="grid items-center"
                style={{
                  gridTemplateColumns: "minmax(0,1fr) 56px 56px 56px",
                  padding: "14px 16px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  fontSize: 13,
                  color: "var(--foreground)",
                }}
              >
                <div>{f}</div>
                {[0, 1, 2].map((c) => (
                  <div key={c} className="flex justify-center">
                    <Check size={16} style={{ color: "var(--success)" }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <InviteBlock />
      </div>

    </AppLayout>
  );
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  const best = !!plan.best;
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
          Лучший выбор
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
        {plan.name}
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
      {plan.savings && (
        <span
          className="mt-[6px] inline-block"
          style={{
            width: "fit-content",
            background: "var(--success-soft)",
            color: "var(--success)",
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: "var(--r-tag)",
          }}
        >
          {plan.savings}
        </span>
      )}

      <div style={{ flex: 1 }} />

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => payClick(plan.name)}
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
      >
        Оплатить
      </motion.button>
    </motion.article>
  );
}
