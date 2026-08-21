/**
 * Subscription plan display — loaded from GET /api/v1/plans (admin-managed).
 * PRICING_PLANS_FALLBACK is used only when the API is unreachable (demo/offline).
 */

import type { SubscriptionPlanApi } from "@/lib/api/payment";

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  periodDays: number;
  savings?: string;
  best?: boolean;
}

/** Slugs shown on /subscription and landing pricing (checkout-enabled). */
export const SUBSCRIPTION_CHECKOUT_SLUGS = ["month", "half", "year"] as const;

const PLAN_MONTHS: Record<string, number> = {
  month: 1,
  half: 6,
  year: 12,
};

export const PRICING_PLANS_FALLBACK: PricingPlan[] = markBestPlan([
  { id: "month", name: "Месяц", price: 99, period: "месяц", periodDays: 30 },
  { id: "half", name: "Полгода", price: 499, period: "6 месяцев", periodDays: 180 },
  { id: "year", name: "Год", price: 799, period: "12 месяцев", periodDays: 365 },
]);

/** Same benefits apply to every tier — only price/duration differ. */
export const PRICING_FEATURES: string[] = [
  "Доступ ко всем каналам и сообществам",
  "Размещение объявлений без ограничений",
  "Сообщения и звонки внутри платформы",
  "Публикации постов в ленте",
  "Голосовые сообщения с транскрибацией",
  "Поддержка приоритетом",
];

function periodLabel(slug: string, periodDays: number): string {
  if (slug === "month" || periodDays === 30) return "месяц";
  if (slug === "half" || periodDays === 180) return "6 месяцев";
  if (slug === "year" || periodDays >= 360) return "12 месяцев";
  return `${periodDays} дн.`;
}

function savingsVsMonthly(plan: Omit<PricingPlan, "best">, monthlyPrice: number): number {
  const months = PLAN_MONTHS[plan.id] ?? Math.max(1, Math.round(plan.periodDays / 30));
  return monthlyPrice * months - plan.price;
}

function markBestPlan(plans: Omit<PricingPlan, "best">[]): PricingPlan[] {
  const monthlyPrice = plans.find((p) => p.id === "month")?.price ?? 0;
  let bestId: string | null = null;
  let maxSavings = 0;

  for (const plan of plans) {
    const savings = savingsVsMonthly(plan, monthlyPrice);
    if (savings > maxSavings) {
      maxSavings = savings;
      bestId = plan.id;
    }
  }

  return plans.map((plan) => {
    const savingsAmount = savingsVsMonthly(plan, monthlyPrice);
    return {
      ...plan,
      best: plan.id === bestId && savingsAmount > 0,
      savings:
        savingsAmount > 0 && plan.id !== "month"
          ? `Выгода ${savingsAmount.toLocaleString("ru-RU")} ₽`
          : undefined,
    };
  });
}

export function mapApiPlansToPricingPlans(apiPlans: SubscriptionPlanApi[]): PricingPlan[] {
  const checkout = [...apiPlans].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.price_cents - b.price_cents,
  );

  if (checkout.length === 0) {
    return PRICING_PLANS_FALLBACK;
  }

  const mapped = checkout.map((p) => ({
    id: p.slug,
    name: p.name,
    price: Math.round(p.price_cents / 100),
    period: periodLabel(p.slug, p.period_days),
    periodDays: p.period_days,
  }));

  return markBestPlan(mapped);
}
