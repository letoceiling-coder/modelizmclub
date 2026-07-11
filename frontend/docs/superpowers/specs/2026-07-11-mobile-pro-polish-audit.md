# Mobile Pro-Polish Audit — Avito/VK-level pass

Reproduced live (Claude Preview, 360×740), not from memory. Each item cites
what was measured or read in code.

## Reproduced problems

| # | Symptom (user) | Measured cause | Screen |
|---|---|---|---|
| A | Лента «улетает вправо-влево» при листании | FeedFilterTabs strip was `overflow-x-auto`, scrollWidth 424 > client 336 → pans sideways on diagonal gestures. Also `layoutId` underline flew across strip. | /feed |
| B | Bottom-nav в открытом диалоге «летает/дёргается» | `BottomNav` is rendered unconditionally in AppLayout; messenger uses `mobileView` state — in "chat" the fixed nav overlaps the composer/back header. | /messenger chat |
| C | Композер поста: смайлики, категории, кнопка «Опубл.» | Current `CreatePostForm` shows emoji row + category selects + textarea all on step 1; user wants photo-first 2-step flow. | /feed composer |
| D | «Найди своих» — странная анимация, нет «назад» | Sheet slide uses `data-[state=open]:duration-500` (>400ms checklist limit); relies on default Radix X only. | /feed |
| E | Комментарии открываются «вверху», перекрывает клавиатура | `PostCard` comments expand inline below the post (input at y≈1121 on a 740 viewport → far below fold; opening near page bottom pushes input under keyboard). | /feed |

## Decisions locked (user, this session)
- Bottom-nav: **Avito pattern** — visible in dialog LIST, hidden in open CHAT.
- Composer: **photo-first 2-step** — tap → system gallery (or "без фото") →
  step 2 preview + title + text + compact category + "Опубликовать". Emoji
  block removed entirely.

## Wave plan
1. **Feed drift + tab animation** (A) — DONE in this pass: static equal-width
   tabs, no overflow, no flying underline.
2. **Messenger chat: hide bottom-nav** (B) — thread a flag so BottomNav hides
   while a dialog is open; list keeps it.
3. **Composer redesign** (C) — DONE: 2-step photo-first flow. Step 1 "Фото
   публикации" = dashed dropzone → system gallery (or "Далее без фото"); once
   picked, a 3-col thumbnail grid + add tile. Step 2 "Детали публикации" =
   photo strip + title + text + category/масштаб selects + full-width
   "Опубликовать". Emoji block + toolbar Smile button removed entirely.
   Modal header dropped (form owns its back/close header + footer CTA);
   CreatePostFormHandle/forwardRef removed — form self-closes via onClose.
4. **Sheet + comments polish** (D, E) — sheet open ≤300ms + drag handle; keep
   comments inline but scroll the input into view above the keyboard on open.
5. **Global sweeps** — animation-duration audit (>400ms → trim), touch-target
   re-check on any new controls, empty-states/back-buttons confirm.

Verification per wave: live at 360–430px, overflow probes empty, CLS via the
session's PerformanceObserver method where a value updates.
