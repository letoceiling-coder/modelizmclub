# Catalog Filter Simplification Implementation Plan

> **For agentic workers:** Execute inline (superpowers:executing-plans) as one stage of the ongoing Mobile Functional Fixes pass, with a single before/after checkpoint + commit approval. All three tasks touch the shared filter `Body` + `ads.index.tsx`.

**Goal:** Move category selection from the chips row into the Фильтры panel, replace the 4 Состояние checkboxes with a collapsible disclosure, and remove the meaningless "Только с фото" filter.

**Architecture:** All filter controls render through a shared `Body` component (used by both `AdFiltersSheet` and `AdFiltersPanel`), so each control change lands once. Filters are local `useState`; only `q` is in the URL; `CatalogBreadcrumb` is a readout of filter state — so moving category into the panel is safe.

**Tech Stack:** React 19, TypeScript, Tailwind, existing UI Kit (`Checkbox`, the panel's local `Select`).

## Global Constraints

- `FiltersState`/`DEFAULT_FILTERS`/`buildParams`/`countActiveFilters` must stay internally consistent — remove `withPhotoOnly` from all four.
- No change to Статус / Цена / Город / Доставка controls, to URL handling, or to `CatalogBreadcrumb`.
- Reuse the panel's existing local `Select` for the category dropdown; don't add a new dependency.
- `npx tsc --noEmit` clean; live 375px + desktop verification.

---

### Task 1: Category chips → Фильтры select (item 3)

**Files:** `frontend/src/components/ads/AdFilters.tsx`, `frontend/src/routes/ads.index.tsx`, delete `frontend/src/components/ads/CategoryChips.tsx`.

- [ ] **Step 1: Add a "Категория" group at the top of `Body`**

In `components/ads/AdFilters.tsx`, in `Body`, the `useListingCategories()` result is already `const categories`. Insert this as the FIRST child inside the returned `<div className="flex flex-col gap-[20px]">` (before the `{cat && (…Подкатегория…)}` block):

```tsx
      <Group title="Категория">
        <Select
          value={value.category}
          onChange={(v) => onChange({ ...value, category: v, subcategory: "Все" })}
          options={["Все", ...categories.map((c) => c.name)]}
        />
      </Group>
```

- [ ] **Step 2: Remove the chips row from `ads.index.tsx`**

Delete this block:

```tsx
        {/* Category chips */}
        <CategoryChips
          value={filters.category}
          onChange={handleCategoryChip}
        />
```

Remove the import `import { CategoryChips } from "@/components/ads/CategoryChips";`. Remove the now-unused `handleCategoryChip` function:

```tsx
  function handleCategoryChip(name: string) {
    setFilters((prev) => ({ ...prev, category: name, subcategory: "Все" }));
  }
```

- [ ] **Step 3: Delete the CategoryChips component**

```bash
git rm frontend/src/components/ads/CategoryChips.tsx
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit` — expect clean (no dangling `CategoryChips`/`handleCategoryChip` references).

---

### Task 2: Состояние checkboxes → collapsible disclosure (item 4)

**Files:** `frontend/src/components/ads/AdFilters.tsx`.

- [ ] **Step 1: Add a `useState` import + a `ChevronDown` icon**

`Body` is a component, so it can use hooks. Ensure `useState` is imported from React (add `import { useState } from "react";` at the top if not present) and add `ChevronDown` to the `lucide-react` import line (currently `import { X, RotateCcw } from "lucide-react";` → `import { X, RotateCcw, ChevronDown } from "lucide-react";`).

- [ ] **Step 2: Add local open state in `Body`**

At the top of `Body` (after the `toggle` helper), add:

```tsx
  const [conditionsOpen, setConditionsOpen] = useState(false);
```

- [ ] **Step 3: Replace the Состояние group with a disclosure**

Replace this block:

```tsx
      <Group title="Состояние">
        <div className="flex flex-wrap gap-[6px]">
          {CONDITIONS.map((c) => (
            <Checkbox key={c} checked={value.conditions.includes(c)} onChange={() => toggle("conditions", c)} label={c} />
          ))}
        </div>
      </Group>
```

with:

```tsx
      <div className="flex flex-col gap-[10px]">
        <button
          type="button"
          onClick={() => setConditionsOpen((v) => !v)}
          aria-expanded={conditionsOpen}
          className="flex items-center justify-between"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-input)",
            height: 40,
            padding: "0 12px",
          }}
        >
          <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
            Состояние{value.conditions.length > 0 ? ` · ${value.conditions.length}` : ""}
          </span>
          <ChevronDown
            size={16}
            style={{ color: "var(--foreground-50)", transform: conditionsOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
          />
        </button>
        {conditionsOpen && (
          <div className="flex flex-wrap gap-[6px] pl-[2px]">
            {CONDITIONS.map((c) => (
              <Checkbox key={c} checked={value.conditions.includes(c)} onChange={() => toggle("conditions", c)} label={c} />
            ))}
          </div>
        )}
      </div>
```

- [ ] **Step 4: Typecheck** — `cd frontend && npx tsc --noEmit` clean.

---

### Task 3: Remove "Только с фото" (item 5)

**Files:** `frontend/src/components/ads/AdFilters.tsx`, `frontend/src/routes/ads.index.tsx`.

- [ ] **Step 1: Remove the checkbox from `Body`**

Delete this line from `AdFilters.tsx` `Body`:

```tsx
      <Checkbox checked={value.withPhotoOnly} onChange={(v) => set("withPhotoOnly", v)} label="Только с фото" />
```

- [ ] **Step 2: Remove `withPhotoOnly` from `FiltersState` + `DEFAULT_FILTERS`**

In `FiltersState`, delete `  withPhotoOnly: boolean;`. In `DEFAULT_FILTERS`, delete `  withPhotoOnly: false,`.

- [ ] **Step 3: Remove `withPhotoOnly` from `ads.index.tsx`**

In `countActiveFilters`, delete `  if (f.withPhotoOnly) n++;`. In `buildParams`, delete the line `    withPhotoOnly: filters.withPhotoOnly || undefined,`.

- [ ] **Step 4: Verify no dangling references**

Run: `cd frontend && grep -rn "withPhotoOnly" src` — expect no matches. Then `npx tsc --noEmit` — clean.

---

### Task 4: Live verification (Stage 3 checkpoint)

**Files:** none.

- [ ] **Step 1:** At 375px on `/ads`: the chips row is gone; opening Фильтры shows a "Категория" select at the top; selecting a category updates the breadcrumb + narrows results and resets subcategory; "Все" clears it.
- [ ] **Step 2:** Состояние is a collapsed disclosure by default; expanding shows the 4 checkboxes; selecting some shows "Состояние · N"; filtering by condition narrows results.
- [ ] **Step 3:** No "Только с фото" anywhere; active-filter count excludes it.
- [ ] **Step 4:** Repeat category + condition checks at desktop width (shared `Body`).
- [ ] **Step 5:** No new console errors. Present before/after + request commit approval (single Stage 3 commit).
