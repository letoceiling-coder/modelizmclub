# Final Mobile & Visual Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: execute inline (superpowers:executing-plans) — this is discovery-driven visual work requiring live browser reproduction and before/after screenshots by the controller, with per-stage commit approval. It is NOT suited to blind subagent dispatch.

**Goal:** Systematically resolve the app's accumulated visual/mobile debt — 3 P0 bugs, systemic scrollbar + scroll-jank patterns, composer/forms, my-ads/profile, feed/sidebar, landing, and a polish re-check of the 6 new /settings sections — fixing each *pattern* once everywhere it recurs.

**Architecture:** Mostly Tailwind/CSS-variable adjustments + one new global CSS utility (`.no-scrollbar`). Native controls restyled (UI-Kit chrome), not replaced. No new dependencies, no new asset files.

**Tech Stack:** React 19, TypeScript strict, Tailwind, existing UI Kit + CSS variables in `styles.css`.

## Global Constraints

- Native `<select>` / pickers: restyle with UI-Kit chrome (border, radius, chevron, focus/hover), keep native mechanics + mobile keyboard/wheel. Do NOT build custom dropdown components.
- No new dependencies; no new icon/image asset files (lucide set only).
- Reuse existing UI Kit (`components/ui/*`) and CSS variables; follow existing patterns.
- Each stage = its own commit(s), preceded by a live 375px before-screenshot and followed by an after-screenshot; `npx tsc --noEmit` clean per stage; no new console errors.
- Per-stage commit approval from the user. Push to `neeklo` + deploy ONCE at the very end (after all stages approved).
- Mobile-first: reproduce/verify at 360–430px FIRST, then desktop.

---

### Stage 1: P0 bugs (live-repro → fix)

**Files (confirmed at repro time):** likely `frontend/src/components/ads/wizard/ListingPreviewCard.tsx` and/or the wizard preview step in `frontend/src/routes/ads.new.tsx` (P0.1); `frontend/src/components/ui/phone-input.tsx` and/or `register.tsx`/`settings.account.tsx` (P0.2); the ad-form step container in `frontend/src/routes/ads.new.tsx` (P0.3).

- [ ] **Step 1: Repro P0.1 live at 375px** — open the ad wizard, reach the Превью step with a title + city + status set, screenshot. Identify in the DOM exactly which element (city text) overlaps the status badge and why (z-index / absolute positioning / flex wrap). Record the confirmed cause before touching code.
- [ ] **Step 2: Fix P0.1** — resolve the overlap at its structural cause (spacing/z-index/wrap), not a magic-number nudge. Re-screenshot to confirm no overlap at 360px and 430px.
- [ ] **Step 3: Repro P0.2 live** — focus the phone/contact field on the mobile viewport, type via the emulated keyboard, and capture the exact garbage string + which field. Inspect `formatRuPhone` behavior and whether the controlled value reconciles (IME/composition). Record the confirmed cause.
- [ ] **Step 4: Fix P0.2** — correct the input so only valid masked digits ever render (e.g. guard composition/onChange, or normalize the value). Verify live: typing produces only `+7 (XXX) XXX-XX-XX`, no stray characters.
- [ ] **Step 5: Repro P0.3 live** — in the ad form, focus a field low on the page with the emulated soft keyboard open; observe whether condition/delivery checkboxes overlap adjacent blocks or get obscured. Record the cause (scroll-into-view / container padding / sticky element).
- [ ] **Step 6: Fix P0.3** — ensure focused fields scroll into view above the keyboard and blocks don't overlap (scroll-padding / container spacing). Verify live.
- [ ] **Step 7: tsc + commit** — `cd frontend && npx tsc --noEmit` clean; commit `fix(ads): P0 wizard preview overlap, phone mask, keyboard scroll`. Present before/after screenshots and request approval before committing.

---

### Stage 2: Systemic — scrollbar utility (P1.4 + P1c.13) and feed jank (P1.5)

**Files:**
- Modify: `frontend/src/styles.css` (add `.no-scrollbar`)
- Modify: the ~23 files using `overflow-x` (apply the class, remove inline patches) — enumerated live via grep at implementation time
- Modify: feed scroll surfaces (P1.5) — confirmed after live diagnosis

- [ ] **Step 1: Add the `.no-scrollbar` utility to `styles.css`**

After the existing scrollbar block (the `::-webkit-scrollbar` rules), add:

```css
/* Hide the scroll indicator on intentionally-scrollable rows/rails
   (horizontal chip/category/filter rows, friend strips, etc.) while
   keeping scrolling fully functional. Single source of truth — replaces
   the ad-hoc inline [scrollbar-width:none] patches scattered across
   components. */
.no-scrollbar {
  scrollbar-width: none;          /* Firefox */
  -ms-overflow-style: none;       /* legacy Edge/IE */
}
.no-scrollbar::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;                  /* Chrome/Safari */
}
```

- [ ] **Step 2: Apply `.no-scrollbar` across horizontal rows** — for every horizontal `overflow-x-auto`/`overflow-x-scroll` row that should hide its bar, add `no-scrollbar` to `className` and remove the inline `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden` / `[scrollbar-width:thin]` / `style={{ scrollbarWidth: ... }}` patch. Enumerate the current set with:
  `grep -rlnE "overflow-x-auto|overflow-x-scroll" frontend/src` and handle each (category chips, feed filter tabs, tabs.tsx, AdBanner, SimilarAds, ListingPreviewCard thumb strip, my-ads status row, ads.new photo strip, friends row P1c.13, breadcrumbs, etc.). Vertical rails that legitimately want a thin bar (RightCategories, FeedRightRail, Sidebar) are left as-is unless they read as debt.
- [ ] **Step 3: Verify scrollbar fix live** — at 375px and desktop, confirm no visible bar on a representative sample (feed category chips, ads filter chips, friends row, my-ads status row) while scrolling still works. Desktop hover on the friends row (P1c.13) behaves correctly (no jarring bar).
- [ ] **Step 4: Commit scrollbar fix** — `cd frontend && npx tsc --noEmit` clean; commit `fix(ui): global .no-scrollbar utility, remove ad-hoc scrollbar patches`. Screenshots + approval.
- [ ] **Step 5: Diagnose P1.5 feed jank live** — scroll the feed fast at 375px; use the browser (performance/paint observation, and DOM inspection) to identify the actual cause (candidates: `backdrop-filter: blur` repaints on the sticky `MobileHeader`, motion animations re-triggering per card, or a specific unreserved-height element that is NOT the post media). Record the confirmed cause. Do not assume the customer's image-height hypothesis.
- [ ] **Step 6: Fix P1.5 at the confirmed cause** — e.g. reduce/contain the repaint (`will-change`/`contain`, or lighten the blur), or reserve height on the actual offending element, or gate the motion. Verify the jank is measurably reduced live.
- [ ] **Step 7: Commit jank fix** — `tsc` clean; commit `perf(feed): reduce scroll jank (<confirmed cause>)`. Screenshots + approval.

---

### Stage 3: P1a — composer + media picker

**Files:** `frontend/src/components/CreatePostForm.tsx` (composer), the media-picker component/list it uses (confirmed at stage start).

- [ ] **Step 1: Screenshot composer + media picker at 375px** (before).
- [ ] **Step 2: Composer restyle (P1a.6)** — prominent, clear publish button; wrap native `<select>`s in UI-Kit chrome (border/radius/chevron/focus); tidy the emoji grid spacing/sizing. Keep native select mechanics.
- [ ] **Step 3: Media picker restyle (P1a.7)** — style the Медиатека/Снимок/Файлы options with UI-Kit chrome (cards/rows, icons, spacing) instead of a bare native list.
- [ ] **Step 4: Verify live** at 375px + desktop; **Step 5: tsc + commit** `style(composer): native-minimal composer + media picker polish`. Screenshots + approval.

---

### Stage 4: P1b — my-ads + profile

**Files:** `frontend/src/routes/my-ads.tsx`, `frontend/src/components/MyAdCard.tsx` (menu/FAB), `frontend/src/routes/profile.tsx` (stats block, "Написать" button).

- [ ] **Step 1: Screenshots (before)** — my-ads card menu open, FAB on scroll, profile stats block, "Написать в личку" button.
- [ ] **Step 2: P1b.8** — add a backdrop scrim behind the my-ads card context menu (match the app's existing sheet/menu backdrop treatment); verify the floating "+" FAB doesn't cover content on scroll (add safe spacing / hide-on-scroll if it does).
- [ ] **Step 3: P1b.9** — make the profile stat block (Публикаций/Объявлений/Друзей/Сообществ) more vertically compact.
- [ ] **Step 4: P1b.10** — replace the "Написать в личку" text button with an envelope icon + accessible tooltip/aria-label.
- [ ] **Step 5: Verify live; Step 6: tsc + commit** `style(my-ads,profile): menu backdrop, FAB, compact stats, envelope action`. Screenshots + approval.

---

### Stage 5: P1c — feed + sidebar

**Files:** `frontend/src/components/PostCard.tsx` (media padding), `frontend/src/components/layout/Sidebar.tsx` (subscription block), the search input component(s) (placeholder), `frontend/src/routes/friends.tsx` (heading button).

- [ ] **Step 1: Screenshots (before).**
- [ ] **Step 2: P1c.11** — normalize feed post media padding to a uniform VK-style inset (consistent gutters around media within the card).
- [ ] **Step 3: P1c.12** — soften the sidebar "Подписка активна" block (less harsh accent, cleaner treatment) while keeping size/position.
- [ ] **Step 4: P1c.14** — make search placeholders contextual ("Поиск по объявлениям" etc.) instead of a bare "Поиск".
- [ ] **Step 5: P1c.15** — add a "Найти друзей" button beside the Друзья page heading.
- [ ] **Step 6: Verify live; Step 7: tsc + commit** `style(feed,sidebar,friends): media padding, subscription block, search placeholder, find-friends button`. Screenshots + approval.

---

### Stage 6: P1d — landing

**Files:** landing pricing card component + "Почему нас выбирают" section (in `frontend/src/routes/landing.tsx` or its section components — confirmed at stage start).

- [ ] **Step 1: Screenshots (before)** — pricing cards + why-us cards at 375px.
- [ ] **Step 2: P1d.16** — make pricing tiers visually distinguishable (differentiate the per-tier treatment beyond identical check icons — e.g. accent/emphasis on the recommended tier, clearer per-tier feature contrast).
- [ ] **Step 3: P1d.17** — give each "Почему нас выбирают" card a distinct, topically-appropriate lucide icon (no new assets), replacing the generic/repeated ones.
- [ ] **Step 4: Verify live; Step 5: tsc + commit** `style(landing): distinguishable pricing tiers + distinct why-us icons`. Screenshots + approval.

---

### Stage 7: Settings re-check (P18)

**Files:** the 6 `/settings/*` section files + `settings.account.tsx` + `SettingsNav`/`SettingsSectionShell` as needed.

- [ ] **Step 1: Walk all 6 sections + /settings/account at 375px**, screenshotting each; look specifically for the same systemic debt (visible scrollbars, un-chromed native `<select>`, unpolished toggles, spacing inconsistencies) inherited by the recently-added code.
- [ ] **Step 2: Apply the systemic patterns** — `.no-scrollbar` on any horizontal rows; UI-Kit chrome on any native `<select>`; align toggle/field styling with the rest of the app. Only touch what actually reads as debt (do not restyle for its own sake).
- [ ] **Step 3: Verify live at 375px + desktop; Step 4: tsc + commit** `style(settings): apply polish pass to the 6 sections + account`. Screenshots + approval.

---

### Stage 8: Final deploy

- [ ] **Step 1: Full `npx tsc --noEmit` clean.**
- [ ] **Step 2: Push** `git push origin feature/audit-round3-fixes:neeklo` (after all stage commits are approved).
- [ ] **Step 3: Deploy** on the VPS (`git pull origin neeklo` + `bash deploy/scripts/deploy-neeklo-frontend.sh`).
- [ ] **Step 4: Verify live on production** at 375px — spot-check a representative fix from each stage (scrollbar hidden, P0 bugs gone, settings polished), confirm no new console errors.
