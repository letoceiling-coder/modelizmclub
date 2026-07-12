# Subscription Term Switcher (Pattern A) Implementation Plan

> **For agentic workers:** Execute inline as a staged task with a checkpoint + commit approval. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the three stacked plan cards + all-checkmarks matrix on `/subscription` — and the 3× feature-duplicating cards on the landing `PricingSection` — with one shared `PlanTermSelector` (segmented term switcher + selected-term detail + one shared feature list).

**Architecture:** A single presentational component `PlanTermSelector` owns the selected-term state and renders switcher + price detail + shared feature list; each surface passes its own CTA via a `renderCta` render prop (`/subscription` → `payClick` button; landing → `Link` to `/subscription`).

**Tech Stack:** React 19, TypeScript, Tailwind + CSS variables, existing `PRICING_PLANS`/`PRICING_FEATURES`.

## Global Constraints

- Mobile-first; **no horizontal scroll** at 360/390/430 (both overflow probes empty; `document.documentElement.scrollWidth === innerWidth`).
- Reuse `PRICING_PLANS` + `PRICING_FEATURES` unchanged. No pricing-data, backend, or payment change.
- Tiers stay feature-identical — one shared feature list, no per-tier columns, no прочерки.
- Segments show term names only (3-up fit at 360). Recommended term (`best` → Полгода) preselected. Tap targets ≥44px.
- `npx tsc --noEmit` clean.

---

### Task 1: `PlanTermSelector` component

**Files:** Create `frontend/src/components/subscription/PlanTermSelector.tsx`.

**Produces:** `export function PlanTermSelector({ renderCta, className }: { renderCta: (plan: PricingPlan) => React.ReactNode; className?: string })`.

- [ ] **Step 1: Write the component**

```tsx
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
```

- [ ] **Step 2: Typecheck** — `cd frontend && npx tsc --noEmit` clean.

---

### Task 2: Wire into `/subscription`

**Files:** Modify `frontend/src/routes/subscription.tsx`.

- [ ] **Step 1: Replace the plan grid** — swap the `motion.div … grid grid-cols-1 … md:grid-cols-3` block (the `PLANS.map(p => <PlanCard/>)`) with the selector in a centered column:

```tsx
        <div className="mx-auto mt-[24px] max-w-[420px]">
          <PlanTermSelector
            renderCta={(plan) => (
              <button
                type="button"
                onClick={() => payClick(plan.name)}
                className="inline-flex h-[48px] w-full items-center justify-center rounded-[var(--r-pill)] text-[15px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                Оформить подписку
              </button>
            )}
          />
        </div>
```

- [ ] **Step 2: Delete the "Что входит" 3-column matrix** — remove the entire `<section className="mt-[40px]">…</section>` that renders the `gridTemplateColumns: "minmax(0,1fr) 56px 56px 56px"` head + `FEATURES.map` rows (the feature list now lives inside `PlanTermSelector`).

- [ ] **Step 3: Remove now-dead code** — delete the `PlanCard` function, the local `FEATURES` const (if only the matrix used it), and any now-unused imports (`PricingPlan` if unused, `Check` if unused here, `PRICING_FEATURES` if unused here). Add `import { PlanTermSelector } from "@/components/subscription/PlanTermSelector";`. Keep `payClick`, the active-sub card, free counter, one-time 99 ₽ block, `InviteBlock`.

- [ ] **Step 4: Typecheck** — clean.

---

### Task 3: Wire into landing `PricingSection`

**Files:** Modify `frontend/src/routes/index.tsx`.

- [ ] **Step 1: Replace the 3-card grid** — in `PricingSection`, swap the `<div className="mt-10 grid gap-4 md:grid-cols-3">…</div>` (the `PRICING_PLANS.map` cards, each repeating `PRICING_FEATURES`) with:

```tsx
      <div className="mx-auto mt-10 max-w-[420px]">
        <PlanTermSelector
          renderCta={() => (
            <Link
              to="/subscription"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--r-pill)] text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              {t("landing.pricing.more")} <ArrowRight size={15} />
            </Link>
          )}
        />
      </div>
```

- [ ] **Step 2: Clean imports** — add `import { PlanTermSelector } from "@/components/subscription/PlanTermSelector";`. Remove `PRICING_FEATURES` from the index import if no longer used there; keep `PRICING_PLANS` only if still referenced elsewhere in the file (otherwise remove). Keep `Check`/`ArrowRight` if still used elsewhere. Keep Eyebrow/Title/subtitle.

- [ ] **Step 3: Typecheck** — clean.

---

### Task 4: Live verification (both surfaces)

- [ ] At 360/390/430, on `/subscription` and `/` (scroll to pricing): run both overflow probes → empty; `document.documentElement.scrollWidth === innerWidth`.
- [ ] Segments fit 3-up at 360; Полгода preselected (accent-filled, ★).
- [ ] Tap Месяц / Год → price, period, savings row update; no CTA vertical jump (fixed-height savings row).
- [ ] `/subscription` CTA fires `payClick` (toast) with the selected plan name; landing CTA navigates to `/subscription`.
- [ ] Feature list shows all 6 once on each surface; no 3-column matrix on `/subscription`; no per-card duplication on landing.
- [ ] `/subscription` active-sub card, free counter, one-time 99 ₽, invite still present; landing Eyebrow/Title/subtitle unchanged.
- [ ] Screenshots 360/390/430 for both surfaces. Desktop: switcher centered at max-width, one column.
