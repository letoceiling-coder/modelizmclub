/**
 * Subscription plan display — loaded from GET /api/v1/plans (admin-managed).
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
  features?: string[];
}

/** Public API stores either a list of copy strings or capability flags like `{posts: "unlimited"}`. */
export function normalizePlanFeatures(features: unknown): string[] {
  if (!Array.isArray(features)) return [];
  return features.map((item) => String(item ?? "").trim()).filter(Boolean);
}

const PLAN_MONTHS: Record<string, number> = {
  month: 1,
  half: 6,
  year: 12,
};

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
    return [];
  }

  const mapped = checkout.map((p) => ({
    id: p.slug,
    name: p.name,
    price: Math.round(p.price_cents / 100),
    period: periodLabel(p.slug, p.period_days),
    periodDays: p.period_days,
    features: normalizePlanFeatures(p.features),
  }));

  return markBestPlan(mapped);
}
