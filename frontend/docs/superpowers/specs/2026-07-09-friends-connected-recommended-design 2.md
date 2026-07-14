# Friends Page — Connected + Recommended Split

## Context

`frontend/src/routes/friends.tsx` currently has three tabs: Люди / Онлайн / Заявки. Inside "Люди" is a single flat list (`filteredUsers`) mixing already-added friends and non-friends together — they're only distinguished by which button renders on the card ("В друзьях" vs "Добавить"). This is the "Friends Page Blocking" unified list referenced in prior work.

Reference: VK's friends page shows already-added friends at the top and recommended people below, on one scrollable page.

## Goal

Split the "Люди" tab's content into two stacked sections:
1. **Мои друзья N** — already-added friends, online-first
2. **Рекомендации** — everyone else (not already a friend)

"Онлайн" and "Заявки" tabs, and all blocking/action logic (accept/decline, add/remove friend, message, hide, report, block), are unchanged.

## Non-goals

- No new API endpoints or backend changes. Reuses `fetchFriends()` and `searchUsers("")`, already fetched today.
- No pagination/"show more" for Recommended — full list renders at once, same as today's `filteredUsers`.
- No changes to "Онлайн" or "Заявки" tab content or logic.
- No changes to blocking/hide/report/message action behavior — same handlers, same API calls.

## Data & Filtering

Inside the "Люди" tab's rendering (replacing the current single `filteredUsers.map(...)`):

```ts
const connected = useMemo(() => {
  return allUsers
    .filter((u) => added.has(u.id))
    .filter((u) => {
      if (blockedUserIds.includes(u.id) || hiddenUserIds.includes(u.id)) return false;
      const ql = q.toLowerCase();
      if (!ql) return true;
      return u.name.toLowerCase().includes(ql) || u.interests.toLowerCase().includes(ql);
    })
    .sort((a, b) => Number(isOnline(b)) - Number(isOnline(a)));
}, [allUsers, added, blockedUserIds, hiddenUserIds, q, onlineSet]);

const recommended = useMemo(() => {
  return filteredUsers.filter((u) => !added.has(u.id));
}, [filteredUsers, added]);
```

Notes:
- `connected` is built from `allUsers` (the full directory fetch) rather than the separate `friends` state, because `allUsers` already carries `city`/`interests`/`online` fields the card needs, and cross-referencing via `added` (built from `friends`) keeps a single source of truth for "is this a friend" without a second lookup structure. If a friend isn't present in `allUsers` for some reason (edge case, e.g. a friend who wouldn't otherwise appear in the directory search), they simply won't render in Connected — same limitation the current unified list already has, since it's also driven by `allUsers`.
- Sort is a plain client-side `Array.sort`, no new fetch or store field — reuses the existing `isOnline()` helper.
- `recommended` reuses the existing `filteredUsers` memo verbatim, only adding the `!added.has(u.id)` exclusion so Connected and Recommended never overlap.
- The existing `q` search state and single `SearchInput` control both sections — no separate search inputs.

## Rendering

Mobile-first (360-430px): two sections stacked vertically, page scrolls through both — no internal scroll containers, no tab switching between them.

```
┌─────────────────────────┐
│  [Search input]          │
├─────────────────────────┤
│  Мои друзья 4             │
│  [FriendCard]             │
│  [FriendCard]             │
│  [FriendCard]             │
│  [FriendCard]             │
├─────────────────────────┤
│  Рекомендации              │
│  [FriendCard]             │
│  [FriendCard]             │
│  ...                      │
└─────────────────────────┘
```

Desktop: identical structure — the existing card layout is already a full-width single-column list at every breakpoint (no grid), so the split just adds two section headers; no new breakpoint logic needed.

Section visibility rules:
- **Мои друзья** section (header + cards) renders only if `connected.length > 0`. If empty, the whole section (header included) is omitted — no per-section empty state.
- **Рекомендации** section renders only if `recommended.length > 0`, same omit-if-empty rule.
- If **both** are empty, render the existing single `EmptyState` (same component/props/messaging used today for the "Люди" tab's empty case: `title={q ? "Никого не найдено" : "Список пуст"}`, etc.) — no visual change to that fallback.

Section header style: small label + count, e.g. `Мои друзья 4` / `Рекомендации`, in the same typographic weight/scale as existing UI text (`text-[13px] font-semibold`, `color: var(--foreground-50)` for the count, consistent with the tab badge style already in the file). Recommended has no count shown next to it (per design discussion — count matters for Connected, not for an open-ended discovery list).

## Component Refactor

The current card JSX (avatar, online dot, name/city/interests, action buttons, `FriendActionsMenu`) is inlined once inside the single `filteredUsers.map(...)`. To render it from two places without duplicating ~70 lines, extract it into:

```tsx
function FriendCard({
  user, isAdded, isPending, online,
  onToggleFriend, onWriteTo, onViewProfile, onRemoveFriend, onHide, onReport, onBlock,
}: {
  user: User;
  isAdded: boolean;
  isPending: boolean;
  online: boolean;
  onToggleFriend: () => void;
  onWriteTo: () => void;
  onViewProfile: () => void;
  onRemoveFriend: () => void;
  onHide: () => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  // exact current Card markup, unchanged — props replace closures over `u`/`toggleFriend`/etc.
}
```

Both `connected.map(...)` and `recommended.map(...)` render `<FriendCard ... />`, passing the same handler functions (`toggleFriend`, `writeTo`, `viewProfile`, `removeFriendVia`, `hideUserFromList`, `reportUser`, `blockUserVia`) that exist today — bound per-user via arrow functions at the call site, exactly as the current single map does. No handler logic changes; this is a pure extraction to eliminate duplication.

`userInitials` stays a module-level helper, used inside `FriendCard`.

## Testing

No unit test framework in this repo (tsc + live Playwright checks are the verification story, per project convention). Verification plan for implementation:
- `npx tsc --noEmit` clean
- Live check at 375px: "Люди" tab shows Connected above Recommended, correct counts, online-first order in Connected, search filters both sections, add/remove friend moves a card between sections live (optimistic UI, matching current `toggleFriend`/`removeFriendVia` behavior), block/hide/report still work identically
- Live check at desktop width: same behavior, single-column layout preserved
- Empty states: search query matching nothing → global EmptyState; a user with zero friends but some recommendations → only Recommended section renders; both empty → global EmptyState
- "Онлайн" and "Заявки" tabs unchanged — spot-check they still render exactly as before
