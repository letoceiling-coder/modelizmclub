# Friends Connected + Recommended Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the "Люди" tab of `frontend/src/routes/friends.tsx` into two stacked sections — "Мои друзья N" (already-added friends, online-first) above "Рекомендации" (everyone else) — without touching the "Онлайн"/"Заявки" tabs or any blocking/action logic.

**Architecture:** Extract the existing inline friend-card JSX into a `FriendCard` sub-component (pure refactor, no behavior change), then add two `useMemo`-derived lists (`connected`, `recommended`) and split the "Люди" tab's render branch to render both sections. The "Онлайн" tab keeps rendering its existing flat `filteredUsers` list — just via the new `FriendCard` component instead of inline JSX.

**Tech Stack:** React 19, TypeScript strict, TanStack Router, no new dependencies.

## Global Constraints

- No new API endpoints or backend changes — reuses `fetchFriends()` and `searchUsers("")`, already fetched in `friends.tsx`.
- No pagination/"show more" for Recommended — full list renders at once.
- "Онлайн" and "Заявки" tab content and all handler logic (`toggleFriend`, `writeTo`, `viewProfile`, `removeFriendVia`, `hideUserFromList`, `reportUser`, `blockUserVia`) are unchanged — only extracted into a shared component, never modified.
- Section headers: "Мои друзья N" (count shown) / "Рекомендации" (no count). Each section is omitted entirely (header included) when empty — no per-section empty state.
- If both sections are empty, fall back to the existing single `EmptyState` used today for the "Люди" tab.
- `npx tsc --noEmit` must stay clean after every task.
- No unit test framework in this repo — verification is `tsc` + live Playwright checks at 375px and desktop, per project convention.

---

### Task 1: Extract FriendCard component (pure refactor)

**Files:**
- Modify: `frontend/src/routes/friends.tsx`

**Interfaces:**
- Produces: `FriendCard` component — `function FriendCard(props: { user: User; isAdded: boolean; isPending: boolean; online: boolean; onToggleFriend: () => void; onWriteTo: () => void; onViewProfile: () => void; onRemoveFriend: () => void; onHide: () => void; onReport: () => void; onBlock: () => void }): JSX.Element`. Task 2 renders this from two lists instead of one.

This task changes nothing about what renders — it only moves the existing card JSX (lines 384–453 in the current file) into a standalone component, then calls it from the same single `filteredUsers.map(...)` that exists today. Verify via tsc and a live check that the "Люди" and "Онлайн" tabs look and behave identically to before this task.

- [ ] **Step 1: Add the `FriendCard` component**

Insert this new function directly above `function FriendsPage()` (i.e. right after the `userInitials` helper, before line 45 `function FriendsPage() {`):

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
  const interests = user.interests.split(",").slice(0, 3).join(", ");
  return (
    <Card
      className="flex items-center gap-[16px] p-[20px] shadow-none"
      style={{ borderColor: "var(--border)", borderRadius: 14 }}
    >
      <Link to="/user/$id" params={{ id: user.slug ?? user.id }} className="relative shrink-0">
        <Avatar className="h-[56px] w-[56px]">
          <AvatarImage src={user.avatar} alt="" />
          <AvatarFallback
            className="text-[15px] font-semibold"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            {userInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        {online && (
          <span
            className="absolute bottom-0 right-0 h-[13px] w-[13px] rounded-full"
            style={{ background: "var(--success)", border: "2px solid var(--background)" }}
          />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/user/$id"
          params={{ id: user.slug ?? user.id }}
          className="block truncate font-semibold text-[15px]"
          style={{ color: "var(--foreground)" }}
        >
          {user.name}
        </Link>
        <div className="mt-[2px] flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          <MapPin size={11} /> <span className="truncate">{user.city}</span>
        </div>
        <div className="mt-[2px] truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>{interests}</div>
      </div>
      <div className="flex shrink-0 items-center gap-[8px]">
        <Button
          size="sm"
          variant={isAdded || isPending ? "outline" : "default"}
          disabled={isPending}
          onClick={onToggleFriend}
          className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
        >
          {isAdded
            ? <><Check size={13} /> В друзьях</>
            : isPending
            ? <><Clock size={13} /> Заявка отправлена</>
            : <><UserPlus size={13} /> Добавить</>}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onWriteTo}
          className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
        >
          <MessageSquare size={13} /> Написать
        </Button>
        <FriendActionsMenu
          isFriend={isAdded}
          onViewProfile={onViewProfile}
          onRemoveFriend={onRemoveFriend}
          onHide={onHide}
          onReport={onReport}
          onBlock={onBlock}
        />
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Replace the inline map with a call to `FriendCard`**

Find this block (current lines 379–455):

```tsx
              <div className="flex flex-col gap-[10px]">
                {filteredUsers.map((u) => {
                  const isAdded = added.has(u.id);
                  const isPending = !isAdded && pending.has(u.id);
                  const interests = u.interests.split(",").slice(0, 3).join(", ");
                  return (
                    <Card
                      key={u.id}
                      className="flex items-center gap-[16px] p-[20px] shadow-none"
                      style={{ borderColor: "var(--border)", borderRadius: 14 }}
                    >
                      <Link to="/user/$id" params={{ id: u.slug ?? u.id }} className="relative shrink-0">
                        <Avatar className="h-[56px] w-[56px]">
                          <AvatarImage src={u.avatar} alt="" />
                          <AvatarFallback
                            className="text-[15px] font-semibold"
                            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                          >
                            {userInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        {isOnline(u) && (
                          <span
                            className="absolute bottom-0 right-0 h-[13px] w-[13px] rounded-full"
                            style={{ background: "var(--success)", border: "2px solid var(--background)" }}
                          />
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/user/$id"
                          params={{ id: u.slug ?? u.id }}
                          className="block truncate font-semibold text-[15px]"
                          style={{ color: "var(--foreground)" }}
                        >
                          {u.name}
                        </Link>
                        <div className="mt-[2px] flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                          <MapPin size={11} /> <span className="truncate">{u.city}</span>
                        </div>
                        <div className="mt-[2px] truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>{interests}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-[8px]">
                        <Button
                          size="sm"
                          variant={isAdded || isPending ? "outline" : "default"}
                          disabled={isPending}
                          onClick={() => toggleFriend(u)}
                          className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
                        >
                          {isAdded
                            ? <><Check size={13} /> В друзьях</>
                            : isPending
                            ? <><Clock size={13} /> Заявка отправлена</>
                            : <><UserPlus size={13} /> Добавить</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => writeTo(u)}
                          className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
                        >
                          <MessageSquare size={13} /> Написать
                        </Button>
                        <FriendActionsMenu
                          isFriend={isAdded}
                          onViewProfile={() => viewProfile(u)}
                          onRemoveFriend={() => removeFriendVia(u)}
                          onHide={() => hideUserFromList(u)}
                          onReport={reportUser}
                          onBlock={() => blockUserVia(u)}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
```

Replace it with:

```tsx
              <div className="flex flex-col gap-[10px]">
                {filteredUsers.map((u) => {
                  const isAdded = added.has(u.id);
                  const isPending = !isAdded && pending.has(u.id);
                  return (
                    <FriendCard
                      key={u.id}
                      user={u}
                      isAdded={isAdded}
                      isPending={isPending}
                      online={isOnline(u)}
                      onToggleFriend={() => toggleFriend(u)}
                      onWriteTo={() => writeTo(u)}
                      onViewProfile={() => viewProfile(u)}
                      onRemoveFriend={() => removeFriendVia(u)}
                      onHide={() => hideUserFromList(u)}
                      onReport={reportUser}
                      onBlock={() => blockUserVia(u)}
                    />
                  );
                })}
              </div>
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Live verification (no behavior change)**

Start the dev server if not already running (`npm run dev` in `frontend/`), then via Playwright at both 375px and desktop width, on `/friends`:
- "Люди" tab renders the same cards as before (name, city, interests, online dot, "В друзьях"/"Добавить"/"Заявка отправлена" button states, "Написать", "..." menu).
- "Онлайн" tab still renders correctly (online-only filtered list).
- Adding/removing a friend via the button still works (card's button label updates).
- No new console errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/neeklo/Documents/Project/САЙТЫ/MODELISM"
git add frontend/src/routes/friends.tsx
git commit -m "refactor(friends): extract FriendCard component

Pure extraction, no behavior change — prepares friends.tsx to render
friend cards from two separate lists (Task 2) without duplicating the
~70-line card JSX."
```

---

### Task 2: Connected + Recommended split for the "Люди" tab

**Files:**
- Modify: `frontend/src/routes/friends.tsx`

**Interfaces:**
- Consumes: `FriendCard` from Task 1 (exact props as defined above), `filteredUsers` (existing memo, unchanged), `added` (existing `Set<string>` of friend ids, to be memoized in this task), `isOnline(u: User): boolean` (existing helper).
- Produces: `connected: User[]` and `recommended: User[]` — used only in this task's render branch, no later task depends on them.

- [ ] **Step 1: Memoize `added` so it can be a stable `useMemo` dependency**

Find (current line 128):

```tsx
  const added = new Set(friends.map((f) => f.id));
```

Replace with:

```tsx
  const added = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);
```

- [ ] **Step 2: Add the `connected` and `recommended` memos**

Find the `filteredUsers` memo (current lines 86–96):

```tsx
  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      if (me && u.id === me.id) return false;
      if (blockedUserIds.includes(u.id)) return false;
      if (hiddenUserIds.includes(u.id)) return false;
      if (tab === "online" && !isOnline(u)) return false;
      const ql = q.toLowerCase();
      if (!ql) return true;
      return u.name.toLowerCase().includes(ql) || u.interests.toLowerCase().includes(ql);
    });
  }, [q, tab, allUsers, me, blockedUserIds, hiddenUserIds]);
```

Immediately after it (before the `tabs` array on current line 98), insert:

```tsx
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

Note: `added` is referenced here but defined later in the current file (Step 1 of this task moves its declaration to a `useMemo`, but its position in the file stays after `filteredUsers`/`tabs`/`accept`/`decline`). Since these are all `const` declarations inside the same function body evaluated top-to-bottom on every render, `connected`/`recommended` must be declared **after** `added`. Move the `added` declaration (from Step 1) to sit directly above the `connected` memo — i.e. immediately after `filteredUsers`, before `connected`. The full ordering after this step, top to bottom, is: `filteredUsers` → `added` → `connected` → `recommended` → `tabs`.

- [ ] **Step 3: Split the "Люди" tab's render branch**

Find this structure (current lines 287–456 — the ternary chain starting after the loading check):

```tsx
            ) : tab === "requests" ? (
              requests.length === 0 ? (
                <EmptyState
                  icon={UserPlus}
                  title="Нет входящих заявок"
                  description="Заявки в друзья будут отображаться здесь"
                  variant="compact"
                />
              ) : (
                <div className="flex flex-col gap-[10px]">
                  {requests.filter((r) => !isBlockedUser(r.from.id)).map((r) => {
                    /* ... unchanged requests card JSX ... */
                  })}
                </div>
              )
            ) : filteredUsers.length === 0 ? (
              <EmptyState
                icon={Users}
                title={q ? "Никого не найдено" : tab === "online" ? "Никто не в сети" : "Список пуст"}
                description={
                  q
                    ? "Попробуйте изменить запрос"
                    : tab === "online"
                    ? "Загляните позже — онлайн-участники появятся здесь"
                    : "Найдите интересных участников сообщества"
                }
                variant="compact"
              />
            ) : (
              <div className="flex flex-col gap-[10px]">
                {filteredUsers.map((u) => {
                  const isAdded = added.has(u.id);
                  const isPending = !isAdded && pending.has(u.id);
                  return (
                    <FriendCard
                      key={u.id}
                      user={u}
                      isAdded={isAdded}
                      isPending={isPending}
                      online={isOnline(u)}
                      onToggleFriend={() => toggleFriend(u)}
                      onWriteTo={() => writeTo(u)}
                      onViewProfile={() => viewProfile(u)}
                      onRemoveFriend={() => removeFriendVia(u)}
                      onHide={() => hideUserFromList(u)}
                      onReport={reportUser}
                      onBlock={() => blockUserVia(u)}
                    />
                  );
                })}
              </div>
            )}
```

Replace the two final branches (everything from `) : filteredUsers.length === 0 ? (` through the closing `)}`) with:

```tsx
            ) : tab === "online" ? (
              filteredUsers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Никто не в сети"
                  description="Загляните позже — онлайн-участники появятся здесь"
                  variant="compact"
                />
              ) : (
                <div className="flex flex-col gap-[10px]">
                  {filteredUsers.map((u) => {
                    const isAdded = added.has(u.id);
                    const isPending = !isAdded && pending.has(u.id);
                    return (
                      <FriendCard
                        key={u.id}
                        user={u}
                        isAdded={isAdded}
                        isPending={isPending}
                        online={isOnline(u)}
                        onToggleFriend={() => toggleFriend(u)}
                        onWriteTo={() => writeTo(u)}
                        onViewProfile={() => viewProfile(u)}
                        onRemoveFriend={() => removeFriendVia(u)}
                        onHide={() => hideUserFromList(u)}
                        onReport={reportUser}
                        onBlock={() => blockUserVia(u)}
                      />
                    );
                  })}
                </div>
              )
            ) : connected.length === 0 && recommended.length === 0 ? (
              <EmptyState
                icon={Users}
                title={q ? "Никого не найдено" : "Список пуст"}
                description={q ? "Попробуйте изменить запрос" : "Найдите интересных участников сообщества"}
                variant="compact"
              />
            ) : (
              <div className="flex flex-col gap-[24px]">
                {connected.length > 0 && (
                  <div className="flex flex-col gap-[10px]">
                    <div className="flex items-center gap-[6px] px-[2px]">
                      <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Мои друзья</h2>
                      <span className="text-[13px] font-semibold" style={{ color: "var(--foreground-50)" }}>{connected.length}</span>
                    </div>
                    {connected.map((u) => (
                      <FriendCard
                        key={u.id}
                        user={u}
                        isAdded={true}
                        isPending={false}
                        online={isOnline(u)}
                        onToggleFriend={() => toggleFriend(u)}
                        onWriteTo={() => writeTo(u)}
                        onViewProfile={() => viewProfile(u)}
                        onRemoveFriend={() => removeFriendVia(u)}
                        onHide={() => hideUserFromList(u)}
                        onReport={reportUser}
                        onBlock={() => blockUserVia(u)}
                      />
                    ))}
                  </div>
                )}
                {recommended.length > 0 && (
                  <div className="flex flex-col gap-[10px]">
                    <h2 className="px-[2px] text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Рекомендации</h2>
                    {recommended.map((u) => {
                      const isPending = pending.has(u.id);
                      return (
                        <FriendCard
                          key={u.id}
                          user={u}
                          isAdded={false}
                          isPending={isPending}
                          online={isOnline(u)}
                          onToggleFriend={() => toggleFriend(u)}
                          onWriteTo={() => writeTo(u)}
                          onViewProfile={() => viewProfile(u)}
                          onRemoveFriend={() => removeFriendVia(u)}
                          onHide={() => hideUserFromList(u)}
                          onReport={reportUser}
                          onBlock={() => blockUserVia(u)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
cd "/Users/neeklo/Documents/Project/САЙТЫ/MODELISM"
git add frontend/src/routes/friends.tsx
git commit -m "feat(friends): split Люди tab into Мои друзья + Рекомендации

Connected (already-added friends, online-first) renders above
Recommended (everyone else) on one scrollable page, mobile-first.
Онлайн/Заявки tabs and all blocking/action handlers are untouched."
```

---

### Task 3: Final live QA

**Files:** none (verification only).

**Interfaces:** none — this task only exercises the UI built in Tasks 1–2.

- [ ] **Step 1: Typecheck one more time**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 2: Live verification at 375px (mobile-first)**

Via Playwright, navigate to `/friends` at a 375×812 viewport, on the "Люди" tab:
- "Мои друзья N" section renders above "Рекомендации", N matches the number of friends.
- Within "Мои друзья", online friends appear before offline ones.
- Typing in the search box filters both sections simultaneously (a friend and a non-friend matching the query both remain visible; non-matches in both sections disappear).
- Clicking "Добавить" on a Recommended card moves that user into "Мои друзья N" (count increments) without a page reload, and out of "Рекомендации".
- Clicking "..." → "Удалить из друзей" (or the remove action) on a Connected card moves the user back into Recommended (or removes them from view if they no longer match the search/filter), and the "Мои друзья" count decrements.
- If "Мои друзья" is empty (e.g. a fresh account with zero friends), the whole section — header included — is absent, and "Рекомендации" renders alone with no gap or stray empty state above it.
- Searching for a string that matches nothing shows the existing single `EmptyState` with "Никого не найдено".

- [ ] **Step 3: Live verification at desktop width**

Repeat the same checks at a desktop viewport (e.g. 1440×900) — confirm the single-column card layout and section headers render identically to the mobile pass, just wider.

- [ ] **Step 4: Regression check — Онлайн and Заявки tabs**

Still via Playwright on `/friends`:
- "Онлайн" tab shows only online users in a single flat list (no Connected/Recommended split), exactly as it did before this plan.
- "Заявки" tab (incoming friend requests) renders and its Accept/Decline buttons still work.
- No new browser console errors on any of the three tabs.

- [ ] **Step 5: Report results**

Summarize what was checked and any findings. If everything passes, this plan is complete — no commit needed for this task (verification-only).
