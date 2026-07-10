# Subscription — Term Switcher (Pattern A) — Design Spec

## Context

`/subscription` ([routes/subscription.tsx](../../../src/routes/subscription.tsx)) currently presents tariffs as **three stacked plan cards** (`grid grid-cols-1 md:grid-cols-3`, so on mobile they stack into three big blocks you scroll past) followed by a **"Что входит" comparison table** with three columns (Мес / 6 мес / Год) where **every cell is a ✓**.

Key data fact ([lib/config/pricing.ts](../../../src/lib/config/pricing.ts)): the three plans are **feature-identical** — `PRICING_FEATURES` is one shared list; plans differ only by `price`, `period`, and `savings`. So the 3-column matrix compares nothing: it is a wall of identical checkmarks that implies differences that don't exist. Confirmed with the client (2026-07-10): tiers stay feature-identical; we surface the honest structure — **choose a term, see one shared feature set**.

## Approach (decided): Pattern A — segmented term switcher + one shared feature list

Replace the three stacked plan cards **and** the all-✓ matrix with:
1. A **segmented term switcher** (Месяц / Полгода / Год — names only, recommended term flagged), and
2. A **selected-term detail panel** (big price, period, savings pill, one CTA), and
3. A single **"Что входит" list** (the 6 shared features, ✓, shown once — same for every term).

This compresses the decision to its only real axis (term → price), eliminates horizontal scroll, and removes the misleading matrix. Rejected alternative: vertical radio rows (Pattern B) — taller, price comparison is a vertical scan, closer to the "three blocks" being replaced.

Everything else on the page is unchanged: the active-subscription countdown card, the free-placements counter, the one-time 99 ₽ placement block, and the invite block.

## Mobile behavior (primary, 360 / 390 / 430)

- **Segmented switcher**: a single pill-group, 3 equal segments in one row (`grid grid-cols-3`), each showing only the short term name (Месяц / Полгода / Год). The recommended term (`best: true` → Полгода) carries a small ⭐ / "выгодно" marker inside its segment. Names-only guarantees a 3-up fit at 360px with no horizontal scroll. The selected segment is filled (accent); others are quiet. Whole group ≥44px tall.
- **Selected-term detail panel** (directly below the switcher, updates on selection):
  - Big price `{price} ₽`, then `/ {period}` in muted text.
  - `savings` pill when present (e.g. "Выгода 95 ₽").
  - One full-width CTA "Оформить подписку" → existing `payClick(plan.name)`.
- **"Что входит" list**: heading "Что входит" + one line "Одинаково для всех тарифов — отличается только срок", then the 6 `PRICING_FEATURES` as a vertical list, each with a ✓. Shown once (no per-term columns).
- **Preselected term**: the `best` plan (Полгода) is selected on load.
- **No horizontal scroll**: both overflow probes (`scrollWidth > clientWidth`, `getBoundingClientRect().right > innerWidth`) empty at 360/390/430; `document.documentElement.scrollWidth === innerWidth`.

## Desktop behavior (≥ md)

Same component, same single feature list. The segmented switcher may sit centered at a comfortable max-width (it does not need to span the full 960px column). The detail panel and feature list read as one centered column. No separate desktop layout, no 3-column matrix. (The three-card grid is fully removed on all breakpoints.)

## Components & state

One **shared component** drives both `/subscription` and the landing `PricingSection`, so there is a single tariff style across the site.

- **`PlanTermSelector`** — new, `src/components/subscription/PlanTermSelector.tsx`. Owns the selected-term state and renders the switcher + detail + shared feature list. The CTA is supplied by the parent via a render prop, because the two surfaces need different CTAs (a `payClick` button vs a router `Link`).
  ```tsx
  interface PlanTermSelectorProps {
    /** CTA rendered under the price; receives the currently selected plan. */
    renderCta: (plan: PricingPlan) => React.ReactNode;
    className?: string;
  }
  ```
  - Internal state: `const [termId, setTermId] = useState<PricingPlan["id"]>(defaultTermId)`, where `defaultTermId = PRICING_PLANS.find(p => p.best)?.id ?? PRICING_PLANS[0].id`.
  - Internal `TermSwitcher` (segmented control, `role="radiogroup"`, each segment `role="radio"` `aria-checked`, renders `plan.name` + best marker), `TermDetail` (price / period / savings pill, then the `renderCta(selected)` slot), and `PlanFeatures` (the 6 `PRICING_FEATURES` as a ✓ list, shown once).
- **`/subscription`** uses `<PlanTermSelector renderCta={(p) => <button onClick={() => payClick(p.name)}>Оформить подписку</button>} />` in place of the `md:grid-cols-3` `PlanCard` grid. Delete: `PlanCard`, the plan grid, and the "Что входит" 3-column matrix (`FEATURES.map` over `gridTemplateColumns: … 56px 56px 56px`); the standalone "Что входит" section is now the component's feature list. The local `FEATURES` const collapses to shared `PRICING_FEATURES`.
- **Landing `PricingSection`** ([routes/index.tsx](../../../src/routes/index.tsx)) uses `<PlanTermSelector renderCta={() => <Link to="/subscription">{t("landing.pricing.more")} <ArrowRight/></Link>} />` in place of the `md:grid-cols-3` cards. This also removes the current **3× duplication** of the full feature list (one per card). The section's Eyebrow/Title/subtitle (i18n) stay; the feature list inside the component is Russian-only (matching `PRICING_FEATURES`, as today).

## Data

Reuse `PRICING_PLANS` and `PRICING_FEATURES` unchanged (single source of truth, already shared with the landing). No pricing-data change. No backend/payment change — `payClick` (the existing toast stub) is reused verbatim.

## Out of scope / non-goals

- **No per-tier feature differentiation** — tiers remain feature-identical (product decision unchanged).
- **No payment/backend work** — the `/subscription` CTA keeps the existing `payClick` behavior; the landing CTA keeps linking to `/subscription`.
- **No animation.** The "assembling model / airplane" idea is recorded as a **future task** (see below), explicitly not implemented now.

## Future work (recorded, not in scope)

- Animated "assembling model / airplane" flourish on the subscription page — separate future task.

## Testing

No unit-test framework — `npx tsc --noEmit` clean + live Playwright at 360/390/430 then desktop, on **both** `/subscription` and the landing (`/`) pricing section:
- Both overflow probes empty at all three mobile widths; page does not scroll horizontally.
- Segments fit 3-up at 360px; recommended (Полгода) preselected.
- Tapping a segment updates the price/period/savings; on `/subscription` the CTA fires `payClick` with the selected plan name; on the landing the CTA links to `/subscription`.
- Feature list shows all 6 items once (no 3-column matrix on `/subscription`; no per-card feature duplication on the landing).
- `/subscription`: active-subscription card, free counter, one-time 99 ₽ block, invite block still render unchanged. Landing: Eyebrow/Title/subtitle unchanged.
- Both surfaces render the identical `PlanTermSelector`, confirming one consistent tariff style site-wide.
