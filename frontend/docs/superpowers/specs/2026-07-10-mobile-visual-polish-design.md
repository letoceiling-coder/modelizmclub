# Final Mobile & Visual Polish Pass — Design Spec

## Context

The session focused on shipping feature functionality (Доставка, Звонок, Обзоры, Друзья, Настройки) and accumulated visual debt. This is the final systematic polish pass across the whole app, worked as a senior mobile frontend designer: diagnose the *pattern* first, fix systemically everywhere it recurs, not pixel-by-pixel patches. Mobile-first (360–430px) with live reproduction — the customer notes prior viewport emulation sometimes missed real-device issues, so each item gets live before/after evidence.

## Working method

- **Staged, not one commit.** Seven stages; each is its own commit(s) with before/after screenshots and explicit per-stage commit approval.
- **Commits per stage, single deploy at the end** (customer decision).
- **Native controls: restyle, don't replace** (customer decision) — wrap native `<select>` / pickers in UI-Kit chrome (border, radius, chevron, typography, focus/hover), keep native mechanics and the native mobile keyboard/picker wheel.
- Every stage: reproduce the issue live at 360–430px first, confirm the fix live, then commit.

## Audit findings (root cause confirmed in code where static analysis suffices; flagged for live repro where it doesn't)

### Systemic (one fix = many places)
- **P1.4 scrollbar (confirmed):** `styles.css` global `* { scrollbar-width: thin }` + `::-webkit-scrollbar { width:7px; height:7px }` paints a bar on every horizontal row. 23 files use `overflow-x`; they patch inconsistently (~6 inline `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`, others `scrollbar-width:thin`, others nothing). No shared utility. **Fix:** add a single `.no-scrollbar` utility in `styles.css`; apply to every horizontal scroll row; remove the inline patches. Subsumes P1c.13 (friends row) — same class.
- **P1.5 feed jank (partly diagnosed):** the customer's hypothesis (unreserved image height) does **not** hold for post media — `PostCard.PostMedia` already reserves 16:9 via `aspect-video`. Real cause requires live scroll profiling (candidates: `backdrop-filter: blur` repaints on the sticky header, motion animations re-triggering). Diagnosed live in Stage 2; fix targets the actual cause, not the wrong hypothesis.

### P0 bugs (need live reproduction to pin — static reading shows the obvious components are already correct)
- **P0.1 city-over-badge (wizard preview):** `ListingPreviewCard` (status badge top-left, "N фото" bottom-right, no city on image) and `CatalogCard` (city below image) do not statically overlap. The overlap is a runtime layout condition; reproduce the exact preview step live to see what overlaps and why.
- **P0.2 phone mask garbage ("+7шш"):** the ad form's Контакт field is a plain text input (no mask). The masked `PhoneInput` (`formatRuPhone`, strips non-digits) lives in `register.tsx` + `settings.account.tsx`. Reproduce live to identify which field shows garbage and whether it's an IME/controlled-input reconciliation issue.
- **P0.3 checkbox/keyboard overlap:** focus-scroll behavior with a soft keyboard open; observable only with a real keyboard — reproduce and fix scroll-into-view / form padding.

### Aesthetic (clear component adjustments — confirmed at their stage)
P1a.6 composer (`CreatePostForm.tsx`), P1a.7 media picker, P1b.8 my-ads context-menu backdrop + FAB overlap, P1b.9 profile stat block vertical density, P1b.10 "Написать в личку" → envelope icon + tooltip, P1c.11 feed media padding (VK-uniform), P1c.12 sidebar "Подписка активна" block (less harsh accent), P1c.14 search placeholder text (contextual), P1c.15 "Найти друзей" button by the Друзья page heading, P1d.16 pricing cards (distinguishable), P1d.17 "Почему нас выбирают" icons (more distinct, lucide-only, no new assets), P18 settings re-check (inherited native selects / toggles / scrollbars in the 6 new sections).

## Stages

1. **P0 bugs** (P0.1, P0.2, P0.3) — live-repro each at 375px, fix, before/after. Fast & isolated.
2. **Systemic** — P1.4 `.no-scrollbar` utility applied app-wide (incl. P1c.13); P1.5 live-diagnose scroll jank → targeted fix.
3. **P1a** — composer + media picker restyle (native chrome).
4. **P1b** — my-ads menu backdrop + FAB, profile stats density, envelope icon.
5. **P1c** — feed media padding, sidebar subscription block, search placeholder, "Найти друзей" button.
6. **P1d** — landing pricing cards + why-us icons.
7. **Settings re-check** — apply systemic patterns (scrollbar, native-select chrome, toggle polish) to the 6 `/settings/*` sections + expanded `/settings/account`.

## Constraints

- No new dependencies, no new custom asset files (icons from the existing lucide set only).
- Reuse the existing UI Kit (`components/ui/*`) and CSS variables; follow existing patterns.
- Native controls restyled, not replaced (keep native mobile mechanics).
- `npx tsc --noEmit` clean after every stage.
- No unit-test framework — verification is `tsc` + live Playwright at 360–430px (mobile-first) then desktop, with before/after screenshots per stage.
- Per-stage commit approval; single push-to-neeklo + deploy at the very end.

## Testing / verification

Each stage: reproduce the target issue live at 375px, capture a "before" screenshot/measurement, apply the fix, capture "after", confirm `tsc` clean and no new console errors, then request commit approval. The systemic stages (2) additionally verify the fix holds across a representative sample of the many affected locations, not just one.
