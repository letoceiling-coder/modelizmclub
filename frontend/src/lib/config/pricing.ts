/**
 * Single source of truth for subscription pricing — used by both the
 * landing page (`routes/index.tsx` → PricingSection) and `/subscription`.
 * Previously each had its own hardcoded numbers that had drifted apart
 * (landing showed 990 ₽/year, /subscription showed 799 ₽/year, and the tier
 * sets didn't match either). Numbers below are the /subscription set —
 * confirmed as the source of truth by the client (2026-07-09).
 *
 * Note: this content is plain Russian (no i18n), matching how /subscription
 * has always been — it was never wrapped in `t()`. The landing's pricing
 * section previously had ru/en/zh translations for plan copy; unifying onto
 * this shared, Russian-only source means the landing pricing cards are no
 * longer translated on en/zh. Flagged for follow-up if translation is wanted.
 */

export interface PricingPlan {
  id: "month" | "half" | "year";
  name: string;
  price: number;
  period: string;
  savings?: string;
  best?: boolean;
}

const PLAN_MONTHS: Record<PricingPlan["id"], number> = {
  month: 1,
  half: 6,
  year: 12,
};

function savingsVsMonthly(plan: Omit<PricingPlan, "best">, monthlyPrice: number): number {
  return monthlyPrice * PLAN_MONTHS[plan.id] - plan.price;
}

/** Marks the tier with the largest savings vs paying month-by-month. */
function markBestPlan(plans: Omit<PricingPlan, "best">[]): PricingPlan[] {
  const monthlyPrice = plans.find((p) => p.id === "month")?.price ?? 0;
  let bestId: PricingPlan["id"] | null = null;
  let maxSavings = 0;

  for (const plan of plans) {
    const savings = savingsVsMonthly(plan, monthlyPrice);
    if (savings > maxSavings) {
      maxSavings = savings;
      bestId = plan.id;
    }
  }

  return plans.map((plan) => ({
    ...plan,
    best: plan.id === bestId && maxSavings > 0,
  }));
}

export const PRICING_PLANS: PricingPlan[] = markBestPlan([
  { id: "month", name: "Месяц", price: 99, period: "месяц" },
  { id: "half", name: "Полгода", price: 499, period: "6 месяцев", savings: "Выгода 95 ₽" },
  { id: "year", name: "Год", price: 799, period: "12 месяцев", savings: "Выгода 389 ₽" },
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
