import { useState } from "react";
import { Check } from "lucide-react";
import { PRICING_PLANS, PRICING_FEATURES, type PricingPlan } from "@/lib/config/pricing";

interface PlanTermSelectorProps {
  /** CTA rendered under the price; receives the currently selected plan. */
  renderCta: (plan: PricingPlan) => React.ReactNode;
  className?: string;
}

const DEFAULT_TERM_ID: PricingPlan["id"] =
  PRICING_PLANS.find((p) => p.best)?.id ?? PRICING_PLANS[0].id;

/**
 * Shared tariff picker used by both `/subscription` and the landing
 * `PricingSection`. Tiers are feature-identical (only price/term differ), so
 * this shows a segmented term switcher + the selected term's price + ONE shared
 * feature list — no misleading all-checkmarks matrix, no horizontal scroll.
 */
export function PlanTermSelector({ renderCta, className }: PlanTermSelectorProps) {
  const [termId, setTermId] = useState<PricingPlan["id"]>(DEFAULT_TERM_ID);
  const selected = PRICING_PLANS.find((p) => p.id === termId) ?? PRICING_PLANS[0];

  return (
    <div className={className}>
      {/* Segmented term switcher — names only, 3-up, fits 360px */}
      <div
        role="radiogroup"
        aria-label="Срок подписки"
        className="grid grid-cols-3 gap-[4px] rounded-[var(--r-pill)] p-[4px]"
        style={{ background: "var(--background-surface)", border: "1px solid var(--border)" }}
      >
        {PRICING_PLANS.map((p) => {
          const active = p.id === termId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTermId(p.id)}
              className="relative flex min-h-[44px] items-center justify-center rounded-[var(--r-pill)] px-[6px] text-[14px] font-semibold transition-colors"
              style={{
                background: active ? "var(--accent)" : "transparent",
                color: active ? "var(--accent-foreground)" : "var(--foreground-70)",
              }}
            >
              {p.name}
              {p.best && (
                <span
                  className="absolute -top-[7px] right-[6px] rounded-full px-[6px] py-[1px] text-[9px] font-bold uppercase"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  aria-hidden
                >
                  ★
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected-term detail */}
      <div className="mt-[20px] text-center">
        <div className="flex items-baseline justify-center gap-[8px]">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 40, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
            {selected.price} ₽
          </span>
          <span className="text-[14px]" style={{ color: "var(--foreground-50)" }}>/ {selected.period}</span>
        </div>
        {/* Fixed-height row so switching terms (savings present/absent) doesn't shift the CTA */}
        <div className="mt-[8px] flex min-h-[24px] items-center justify-center">
          {selected.savings && (
            <span className="inline-flex rounded-full px-[10px] py-[3px] text-[12px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              {selected.savings}
            </span>
          )}
        </div>
        <div className="mt-[16px]">{renderCta(selected)}</div>
      </div>

      {/* Shared feature list — same for every term, shown once */}
      <ul className="mt-[24px] space-y-[10px]">
        {PRICING_FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-[10px] text-[14px]" style={{ color: "var(--foreground-70)" }}>
            <Check size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
