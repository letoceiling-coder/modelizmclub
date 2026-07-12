import { useState } from "react";
import { Check } from "lucide-react";
import { PRICING_PLANS, PRICING_FEATURES, type PricingPlan } from "@/lib/config/pricing";

interface PlanTermSelectorProps {
  /** CTA rendered under the price; receives the plan it belongs to. On
   *  mobile that's always the currently selected term; on desktop it's
   *  called once per plan since all three render open at once. */
  renderCta: (plan: PricingPlan) => React.ReactNode;
  className?: string;
}

const DEFAULT_TERM_ID: PricingPlan["id"] =
  PRICING_PLANS.find((p) => p.best)?.id ?? PRICING_PLANS[0].id;

/**
 * Shared tariff picker used by both `/subscription` and the landing
 * `PricingSection`.
 *
 * Mobile (<768px): unchanged — a segmented term switcher (Месяц/Полгода/Год)
 * showing one selected term's price + CTA at a time, swipe/tap between them.
 *
 * Desktop (≥768px): no switcher — all three plans render as open cards
 * side by side (per the brief: predictable comparison over a toggle that
 * hides two of three options). Tiers are feature-identical (only
 * price/term differ), so the feature checklist is shown once, shared,
 * below the cards — not duplicated per card.
 */
export function PlanTermSelector({ renderCta, className }: PlanTermSelectorProps) {
  const [termId, setTermId] = useState<PricingPlan["id"]>(DEFAULT_TERM_ID);
  const selected = PRICING_PLANS.find((p) => p.id === termId) ?? PRICING_PLANS[0];

  return (
    <div className={className}>
      {/* ===== Mobile: segmented switcher (untouched) ===== */}
      <div className="md:hidden">
        {/* Segmented term switcher — names only, 3-up, fits 360px.
            pt-[11px] reserves room above the pills for the "best plan" badge,
            which used to sit half-clipped on the button's own top edge and
            blend into the active (accent-filled) button — low contrast and
            visually merged with the fill. It now floats fully above its own
            button with an opaque background, legible regardless of which term
            is selected. */}
        <div
          role="radiogroup"
          aria-label="Срок подписки"
          className="grid grid-cols-3 gap-[4px] rounded-[var(--r-pill)] p-[4px] pt-[15px]"
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
                  <span className="absolute -top-[15px] left-1/2 z-10">
                    <BestBadge />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected-term detail */}
        <div className="mt-[20px] text-center">
          <div className="flex items-baseline justify-center gap-[8px]">
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 40, letterSpacing: "-0.025em", color: "var(--foreground)" }}>
              {selected.price} ₽
            </span>
            <span className="text-[14px]" style={{ color: "var(--foreground-50)" }}>/ {selected.period}</span>
          </div>
          {/* Fixed-height row so switching terms (savings present/absent) doesn't shift the CTA */}
          <div className="mt-[8px] flex min-h-[24px] items-center justify-center">
            {selected.savings && <SavingsBadge text={selected.savings} />}
          </div>
          <div className="mt-[16px]">{renderCta(selected)}</div>
        </div>

        <FeatureList className="mt-[24px]" />
      </div>

      {/* ===== Desktop: all three plans open at once, no switcher ===== */}
      <div className="hidden md:block">
        <div className="grid grid-cols-3 gap-[16px]">
          {PRICING_PLANS.map((p) => (
            <div
              key={p.id}
              className="relative flex flex-col items-center rounded-[var(--r-card)] border p-[24px] pt-[28px] text-center"
              style={{
                borderColor: p.best ? "var(--accent)" : "var(--border)",
                background: "var(--background-elevated)",
              }}
            >
              {p.best && (
                <div className="absolute -top-[13px] left-1/2">
                  <BestBadge />
                </div>
              )}
              <div className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</div>
              <div className="mt-[14px] flex items-baseline gap-[6px]">
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 34, letterSpacing: "-0.025em", color: "var(--foreground)" }}>
                  {p.price} ₽
                </span>
                <span className="text-[13px]" style={{ color: "var(--foreground-50)" }}>/ {p.period}</span>
              </div>
              <div className="mt-[8px] flex min-h-[24px] items-center justify-center">
                {p.savings && <SavingsBadge text={p.savings} />}
              </div>
              <div className="mt-[16px] w-full">{renderCta(p)}</div>
            </div>
          ))}
        </div>

        <FeatureList className="mt-[28px] max-w-[420px]" center />
      </div>
    </div>
  );
}

/** "★ Выгодно" pill — same sticker-style tilt in both layouts (one design
 *  element, two render paths, not a second micro-accent). Purely
 *  presentational: the caller wraps it in whatever `absolute -top-… left-1/2`
 *  container fits its own layout, so this only owns the tilt/shadow, not
 *  its position. translateX(-50%) here centers the badge on that wrapper's
 *  left edge; rotate(-3deg) is the deliberate accent. */
function BestBadge() {
  return (
    <span
      className="z-10 block whitespace-nowrap rounded-full px-[8px] py-[2px] text-[9px] font-bold uppercase tracking-wide"
      style={{
        background: "var(--accent)",
        color: "var(--accent-foreground)",
        boxShadow: "0 0 0 3px var(--background)",
        transform: "translateX(-50%) rotate(-3deg)",
      }}
      aria-hidden
    >
      ★ Выгодно
    </span>
  );
}

function SavingsBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex rounded-full px-[10px] py-[3px] text-[12px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
      {text}
    </span>
  );
}

function FeatureList({ className, center }: { className?: string; center?: boolean }) {
  return (
    <ul className={`space-y-[10px] ${center ? "mx-auto" : ""} ${className ?? ""}`}>
      {PRICING_FEATURES.map((f) => (
        <li key={f} className="flex items-start gap-[10px] text-[14px]" style={{ color: "var(--foreground-70)" }}>
          <Check size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}
