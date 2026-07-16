import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import type { Variants } from "framer-motion";
import { motion } from "framer-motion";
import { Gift, Zap, CalendarClock } from "lucide-react";
import { toast } from "@/lib/toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { InviteBlock } from "@/components/referral/InviteBlock";
import { PlanTermSelector } from "@/components/subscription/PlanTermSelector";
import { useMySubscription, formatSubscriptionEndDate, invalidateMySubscription } from "@/lib/subscription";
import { isAuthenticated } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/demo-mode";
import {
  createSubscriptionPayment,
  createListingPlacementPayment,
  confirmStubPayment,
  fetchMySubscription,
} from "@/lib/api/payment";

export const Route = createFileRoute("/subscription")({
  head: () => ({ meta: [{ title: "Подписка — МоДелизМ" }] }),
  component: SubscriptionPage,
});

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// Demo-only free-placements counter (no backend concept behind it) — shown
// only on demo hosts; production renders real subscription data instead.
const FREE_LIMIT = 5;
const FREE_LEFT = 3;

function daysWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}

/**
 * Start a real subscription checkout (Stage 1). Demo hosts (neeklo/local)
 * have no billing backend, so there we keep the honest "оплата будет
 * доступна" message rather than faking a payment. On the real backend:
 *   - vtb/yookassa → redirect to the provider's hosted page; it returns to
 *     /subscription?payment=success|failed (backend config return_url/fail_url).
 *   - stub (test contour w/o live acquiring) → no hosted page: confirm the
 *     stub payment directly and reflect the resulting subscription status.
 */
function requireAuthForCheckout(navigate: ReturnType<typeof useNavigate>): boolean {
  if (isAuthenticated() || isDemoMode()) return true;
  toast.info("Войдите, чтобы оформить подписку");
  navigate({ to: "/login", search: { redirect: "/subscription" } });
  return false;
}

async function startSubscriptionCheckout(
  plan: { id: string; name: string },
  navigate: ReturnType<typeof useNavigate>,
) {
  if (!requireAuthForCheckout(navigate)) return;
  if (isDemoMode()) {
    toast("Оплата будет доступна после подключения эквайринга", {
      description: `Тариф: ${plan.name}`,
    });
    return;
  }
  try {
    const checkout = await createSubscriptionPayment(plan.id);
    if (checkout.checkout_url) {
      window.location.href = checkout.checkout_url;
      return;
    }
    await confirmStubPayment(checkout.payment_uuid);
    invalidateMySubscription();
    const sub = await fetchMySubscription();
    toast.success(
      sub?.is_active ? "Подписка активирована (тестовый режим)" : "Платёж подтверждён (тестовый режим)",
    );
  } catch {
    toast.error("Не удалось создать платёж. Попробуйте позже.");
  }
}

/** One-time 99 ₽ listing placement — real checkout on the production backend. */
async function startPlacementCheckout(navigate: ReturnType<typeof useNavigate>) {
  if (!requireAuthForCheckout(navigate)) return;
  if (isDemoMode()) {
    toast("Оплата будет доступна после подключения эквайринга", {
      description: "Разовое размещение — 99 ₽",
    });
    return;
  }
  try {
    const checkout = await createListingPlacementPayment();
    if (checkout.checkout_url) {
      window.location.href = checkout.checkout_url;
      return;
    }
    await confirmStubPayment(checkout.payment_uuid);
    toast.success("Размещение оплачено (тестовый режим) — доступно при создании объявления");
  } catch {
    toast.error("Не удалось создать платёж. Попробуйте позже.");
  }
}

function SubscriptionPage() {
  const navigate = useNavigate();
  // Real subscription record (API) — demo hosts get the fixed demo state
  // from lib/subscription. Null = free tier: the countdown card is hidden.
  const { sub } = useMySubscription();
  const daysLeft = sub?.days_left ?? 0;
  const totalDays = sub?.plan?.period_days ?? 365;
  const planName = sub?.plan?.name ?? "Подписка";

  // Provider hosted-page return: config return_url/fail_url send the user
  // back to /subscription?payment=success|failed. Surface the outcome, then
  // strip the param so a refresh doesn't re-toast. Activation itself happens
  // server-side via the provider webhook, so "success" is phrased as
  // "activating", not a hard confirmation.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("payment");
    if (!p) return;
    if (p === "success") toast.success("Оплата прошла — подписка активируется");
    else if (p === "failed") toast.error("Оплата не завершена");
    params.delete("payment");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

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

        {/* Active subscription — the single place the countdown lives.
            Rendered only when there IS an active subscription (real API data;
            demo hosts always have the fixed demo state). */}
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
                  Подписка «{planName}» активна
                </span>
                <span
                  className="inline-block"
                  style={{ fontSize: 11, fontWeight: 600, color: "var(--success)", background: "var(--success-soft)", padding: "2px 8px", borderRadius: "var(--r-tag)" }}
                >
                  активна
                </span>
              </div>
              <div className="mt-[4px]" style={{ fontSize: 13, color: "var(--foreground-50)" }}>
                Действует до {formatSubscriptionEndDate(sub)}
              </div>
            </div>
          </div>
          <div className="sm:text-right">
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--foreground)", lineHeight: 1 }}>
              {daysLeft} {daysWord(daysLeft)}
            </div>
            <div className="mt-[2px]" style={{ fontSize: 12, color: "var(--foreground-50)" }}>
              до окончания
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

        {/* Free counter — demo-only illustration (no backend concept behind
            it); production hides it so no fake numbers are ever shown */}
        {isDemoMode() && (
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
        )}

        {/* Plans — one shared feature set. Mobile keeps the narrow single-card
            width (max-w-[420px]); desktop widens to fit PlanTermSelector's
            3-column open-cards layout (~230px card x3 + 16px gaps x2). */}
        <div className="mx-auto mt-[24px] max-w-[420px] md:max-w-[760px]">
          <PlanTermSelector
            renderCta={(plan) => (
              <button
                type="button"
                onClick={() => void startSubscriptionCheckout({ id: plan.id, name: plan.name }, navigate)}
                className="inline-flex h-[48px] w-full items-center justify-center rounded-[var(--r-pill)] text-[15px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                Оформить подписку
              </button>
            )}
          />
        </div>

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
                onClick={() => void startPlacementCheckout(navigate)}
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

        <InviteBlock />
      </div>

    </AppLayout>
  );
}

