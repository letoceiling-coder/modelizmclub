# Catalog Filter Simplification — Design Spec

## Context

The catalog page (`routes/ads.index.tsx`) shows a full-width horizontal row of category chips (Все / Автомодели / Самолёты …) above the results, plus a Фильтры panel (desktop side panel + mobile sheet). The chips row eats vertical space, the Состояние filter uses 4 stacked checkboxes, and a "Только с фото" filter is meaningless (photo is mandatory at publish time). This spec simplifies all three.

## Architectural investigation (item 3)

Confirmed by reading the code before proposing changes:

- **Filters are local `useState`** (`FiltersState`). The **URL carries only `q`** (`validateSearch` extracts only the search query) — category/subcategory/conditions were never URL params.
- **`CategoryChips`** (used *only* in `ads.index.tsx`) is pure filtering: `onChange(name)` sets `filters.category` and resets `filters.subcategory` to "Все". It has no internal URL/breadcrumb/navigation logic.
- **`CatalogBreadcrumb`** is a *readout* of `filters.category`/`filters.subcategory`; its `onResetToRoot`/`onResetToCategory` handlers just clear filter state. It is driven BY the filters, not the reverse.
- The mobile sheet (`AdFiltersSheet`) and desktop panel (`AdFiltersPanel`) both render a **shared `Body` component** — a single change covers both.

**Conclusion:** moving category selection from the chips row into the Фильтры panel is safe. The breadcrumb, the active-filter chip readout, and URLs are all unaffected. The only change is UX prominence — on mobile, category selection moves from an always-visible chip row into the Фильтры sheet (one extra tap), which is the intended row-space reclaim; the breadcrumb continues to show the active category at the top of the results.

## Changes

### Item 3 — category chips → Фильтры select

- Add a **"Категория" `Group`** at the **top of `Body`** (before "Подкатегория"), using the panel's existing `Select` component: `options={["Все", ...categories.map((c) => c.name)]}`, `value={value.category}`, and `onChange` that sets `category` and resets `subcategory` to "Все" (identical to the chips' current behavior at `ads.index.tsx`'s `handleCategory`).
- Remove `<CategoryChips>` and its import from `ads.index.tsx`.
- **Delete** `components/ads/CategoryChips.tsx` (no other consumers).
- The "Подкатегория" group keeps its existing condition (only rendered when a category is selected — `cat` truthy).
- `CatalogBreadcrumb` and the active-filter chip readout are **unchanged** (they read `filters.category`/`filters.subcategory`).

### Item 4 — Состояние checkboxes → collapsible disclosure

- Replace the 4 flat `Checkbox`es in the "Состояние" group with a **collapsible disclosure**:
  - A summary button spanning the row: label "Состояние" + a count when any are selected (e.g. "Состояние · 2"), with a chevron that rotates on expand.
  - Collapsed by default. Clicking toggles a panel containing the same 4 `Checkbox`es (`CONDITIONS`), preserving multi-select semantics via the existing `toggle("conditions", c)`.
  - Local `useState` for open/closed inside `Body`.
  - No floating/absolute positioning — the disclosure expands inline (low-risk, no popover library).
- The "Состояние" `Group` title wrapper is replaced by this self-titled disclosure (avoid a redundant double title).

### Item 5 — remove "Только с фото"

- Delete the `<Checkbox … label="Только с фото" />` from `Body`.
- Remove `withPhotoOnly` from:
  - `FiltersState` interface.
  - `DEFAULT_FILTERS`.
  - the active-filter count in `ads.index.tsx` (`if (f.withPhotoOnly) n++`).
  - the API param mapping in `ads.index.tsx` (`withPhotoOnly: filters.withPhotoOnly || undefined`).
  - any active-filter chip readout referencing it (verify none remains).

## Non-goals

- No change to Статус / Цена / Город / Доставка controls.
- No change to URL/search-param handling (only `q` remains in the URL, as today).
- No change to `CatalogBreadcrumb` behavior.
- No backend changes (removing `withPhotoOnly` only drops an optional client-sent param; the demo/real `fetchListings` simply stops receiving it).

## Testing

No unit-test framework — `npx tsc --noEmit` + live Playwright at 375px (mobile-first) then desktop.

- **Item 3:** chips row gone; opening Фильтры shows a "Категория" select at the top; selecting a category updates the breadcrumb + results and resets subcategory; "Все" clears the category filter. Desktop panel + mobile sheet both show it (shared `Body`).
- **Item 4:** Состояние shows a collapsed summary by default; expanding reveals the 4 checkboxes; selecting some shows the count; filtering by condition still narrows results; collapse/expand persists selection.
- **Item 5:** no "Только с фото" control anywhere; active-filter count no longer includes it; results unaffected; `tsc` clean (no dangling `withPhotoOnly` references).
- No new console errors on the catalog at 375px or desktop.
