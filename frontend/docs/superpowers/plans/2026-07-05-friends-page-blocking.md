# Friends Page Redesign + Unified User-Level Blocking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Friends page gets a single-column, less-cluttered card layout with a
three-dots overflow menu, and the whole project gets ONE user-level blocking
system (`blockedUserIds` in the store) that replaces the chat-scoped
`dialogMeta.blocked` flag everywhere it's currently read/written.

**Architecture:** Add `blockedUserIds`/`hiddenUserIds` + `blockUser`/
`unblockUser`/`hideUser` actions and an `isBlocked` selector to the existing
`lib/store.ts` reducer (same pattern as `SET_DIALOG_META`/`REMOVE_FRIEND`).
Migrate the three existing consumers of `dialogMeta.blocked`
(`ChatHeaderActions.tsx`, `messenger.tsx`'s send-gates, `BlockedUsersSection.tsx`)
to read/write the new selector/actions instead. Build a new
`FriendActionsMenu.tsx` (three-dots dropdown, same visual pattern as
`MessageActionsMenu.tsx`, including the `createPortal`-to-`document.body` fix
for the mobile bottom-sheet) and wire it into a redesigned `friends.tsx` card
list.

**Tech Stack:** React 18, TypeScript strict, TanStack Router, Tailwind v4
(CSS custom properties), framer-motion, lucide-react, sonner.

## Global Constraints

- Работать строго внутри `frontend/`.
- Не трогать backend social-graph и auth.
- Блокировка — **одна логическая система**: `blockedUserIds` в
  `lib/store.ts` первична; `DialogMeta.blocked` больше нигде не читается и не
  пишется как признак "человек заблокирован" (тип поля остаётся в
  интерфейсе для обратной совместимости, но не используется).
- "Добавить в список" — НЕ добавлять в меню (списки друзей не реализованы
  нигде в проекте — прямое условие из ТЗ).
- Симметрия блокировки — только клиентская (один локальный demo-store, нет
  второго живого пользователя); реальная серверная симметрия — backend-need.
- Mobile: все интерактивные элементы ≥44px; меню действий — bottom-sheet
  через `createPortal(document.body)` (framer-motion transform на
  animated-ancestor ломает `position: fixed`, как уже было обнаружено и
  исправлено в `MessageActionsMenu.tsx` в прошлой фиче).
- Юнит-тестов в проекте нет — верификация через `npx tsc --noEmit`, `grep`,
  ручной QA через `preview_*` MCP-инструменты.
- После каждой задачи: `npx tsc --noEmit` чист.

---

### Task 1: Store — unified user-level blocking (`blockedUserIds`, `hiddenUserIds`)

**Files:**
- Modify: `src/lib/store.ts` (`AppState` ~строка 48-60, `createInitialState`
  ~строка 65-79, Action union ~строка 122-126, reducer ~после
  `case "CLEAR_HISTORY"`, `actions` object ~после `clearHistory`, `selectors`
  object ~конец файла)

**Interfaces:**
- Produces: `AppState.blockedUserIds: ID[]`, `AppState.hiddenUserIds: ID[]`;
  `actions.blockUser(userId: ID)`, `actions.unblockUser(userId: ID)`,
  `actions.hideUser(userId: ID)`; `selectors.isBlocked(userId: ID) => (s) => boolean`.
  Все последующие задачи используют эти имена дословно.

- [ ] **Step 1: Добавить поля в `AppState` и `createInitialState`**

Найти (текущий блок):

```ts
export interface AppState {
  users: Record<ID, User>;
  posts: Record<ID, Post>;
  ads: Record<ID, Ad>;
  adStatus: Record<ID, AdStatusKey>;
  dialogs: Record<ID, Dialog>;
  dialogMeta: Record<ID, DialogMeta>;
  communities: Record<ID, Community>;
  communityMemberships: Record<ID, ID[]>; // userId -> communityIds
  friendRequests: FriendRequest[];
  friendships: Friendship[];
  currentUserId: ID;
}
```

Заменить на:

```ts
export interface AppState {
  users: Record<ID, User>;
  posts: Record<ID, Post>;
  ads: Record<ID, Ad>;
  adStatus: Record<ID, AdStatusKey>;
  dialogs: Record<ID, Dialog>;
  dialogMeta: Record<ID, DialogMeta>;
  communities: Record<ID, Community>;
  communityMemberships: Record<ID, ID[]>; // userId -> communityIds
  friendRequests: FriendRequest[];
  friendships: Friendship[];
  blockedUserIds: ID[];
  hiddenUserIds: ID[];
  currentUserId: ID;
}
```

Найти в `createInitialState()`:

```ts
    friendRequests: [],
    friendships: [],
    currentUserId: GUEST_USER.id,
```

Заменить на:

```ts
    friendRequests: [],
    friendships: [],
    blockedUserIds: [],
    hiddenUserIds: [],
    currentUserId: GUEST_USER.id,
```

- [ ] **Step 2: Добавить Action-варианты**

Найти хвост `type Action =` (последняя строка перед `;`):

```ts
  | { type: "CLEAR_HISTORY"; dialogId: ID };
```

Заменить на:

```ts
  | { type: "CLEAR_HISTORY"; dialogId: ID }
  | { type: "BLOCK_USER"; userId: ID }
  | { type: "UNBLOCK_USER"; userId: ID }
  | { type: "HIDE_USER"; userId: ID };
```

- [ ] **Step 3: Добавить reducer-кейсы**

Найти кейс `case "CLEAR_HISTORY":` и следующий за ним `default: return s;`.
Вставить перед `default:`:

```ts
    case "BLOCK_USER": {
      if (s.blockedUserIds.includes(a.userId)) return s;
      const meId = s.currentUserId;
      return {
        ...s,
        blockedUserIds: [...s.blockedUserIds, a.userId],
        friendships: s.friendships.filter(
          (f) =>
            !(
              (f.userId1 === meId && f.userId2 === a.userId) ||
              (f.userId1 === a.userId && f.userId2 === meId)
            ),
        ),
        friendRequests: s.friendRequests.filter(
          (r) =>
            !(
              (r.fromId === meId && r.toId === a.userId) ||
              (r.fromId === a.userId && r.toId === meId)
            ),
        ),
      };
    }
    case "UNBLOCK_USER":
      return { ...s, blockedUserIds: s.blockedUserIds.filter((id) => id !== a.userId) };
    case "HIDE_USER":
      return {
        ...s,
        hiddenUserIds: s.hiddenUserIds.includes(a.userId)
          ? s.hiddenUserIds
          : [...s.hiddenUserIds, a.userId],
      };
```

- [ ] **Step 4: Добавить actions**

Найти строку (последнюю добавленную в прошлой фиче):

```ts
  clearHistory: (dialogId: ID) => dispatch({ type: "CLEAR_HISTORY", dialogId }),
```

Добавить сразу после неё:

```ts
  blockUser: (userId: ID) => dispatch({ type: "BLOCK_USER", userId }),
  unblockUser: (userId: ID) => dispatch({ type: "UNBLOCK_USER", userId }),
  hideUser: (userId: ID) => dispatch({ type: "HIDE_USER", userId }),
```

- [ ] **Step 5: Добавить selector**

Найти конец объекта `selectors`:

```ts
  dialogMeta: (dialogId: ID) => (s: AppState): DialogMeta =>
    s.dialogMeta[dialogId] ?? { archived: false, muted: false, blocked: false },
};
```

Заменить на:

```ts
  dialogMeta: (dialogId: ID) => (s: AppState): DialogMeta =>
    s.dialogMeta[dialogId] ?? { archived: false, muted: false, blocked: false },
  isBlocked: (userId: ID) => (s: AppState): boolean => s.blockedUserIds.includes(userId),
};
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 7: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat(store): unified user-level blocking (blockedUserIds/hiddenUserIds)"
```

---

### Task 2: Migrate `ChatHeaderActions.tsx` to unified blocking

**Files:**
- Modify: `src/components/messenger/ChatHeaderActions.tsx`

**Interfaces:**
- Consumes: `selectors.isBlocked` and `actions.blockUser`/`unblockUser` (Task 1).

- [ ] **Step 1: Заменить `meta.blocked` на `isBlocked` selector**

Найти (строка 20):

```ts
  const meta = useStore(dialogId ? selectors.dialogMeta(dialogId) : () => ({ archived: false, muted: false, blocked: false }));
```

Заменить на:

```ts
  const meta = useStore(dialogId ? selectors.dialogMeta(dialogId) : () => ({ archived: false, muted: false, blocked: false }));
  const blocked = useStore(selectors.isBlocked(partnerId));
```

- [ ] **Step 2: Переписать `toggleBlock`**

Найти:

```ts
  const toggleBlock = () => {
    close();
    if (!dialogId) return;
    if (meta.blocked) {
      actions.setDialogMeta(dialogId, { blocked: false });
      toast.success(`${partnerName} разблокирован`, { description: "Вы снова можете обмениваться сообщениями" });
    } else {
      actions.setDialogMeta(dialogId, { blocked: true });
      toast.success(`${partnerName} заблокирован`, { description: "Вы больше не будете получать сообщения от этого пользователя" });
    }
  };
```

Заменить на:

```ts
  const toggleBlock = () => {
    close();
    if (blocked) {
      actions.unblockUser(partnerId);
      toast.success(`${partnerName} разблокирован`, { description: "Вы снова можете обмениваться сообщениями" });
    } else {
      actions.blockUser(partnerId);
      toast.success(`${partnerName} заблокирован`, { description: "Вы больше не будете получать сообщения от этого пользователя, он исчез из ваших друзей" });
    }
  };
```

(Убрана проверка `if (!dialogId) return;` — блокировка теперь по `partnerId`,
доступна даже если диалога ещё нет технически, хотя `ChatHeaderActions`
всегда рендерится внутри открытого чата, где `partnerId` уже есть.)

- [ ] **Step 3: Обновить чтение `meta.blocked` в остальных местах компонента**

Найти (строка ~131, проверка звонка):

```ts
          if (meta.blocked) {
            toast.error("Пользователь заблокирован", { description: "Разблокируйте, чтобы позвонить" });
            return;
          }
```

Заменить на:

```ts
          if (blocked) {
            toast.error("Пользователь заблокирован", { description: "Разблокируйте, чтобы позвонить" });
            return;
          }
```

Найти (строки ~203-208, пункт меню):

```tsx
              <Item
                icon={meta.blocked ? ShieldOff : Ban}
                label={meta.blocked ? "Разблокировать" : "Заблокировать"}
                onClick={toggleBlock}
                danger={!meta.blocked}
              />
```

Заменить на:

```tsx
              <Item
                icon={blocked ? ShieldOff : Ban}
                label={blocked ? "Разблокировать" : "Заблокировать"}
                onClick={toggleBlock}
                danger={!blocked}
              />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/components/messenger/ChatHeaderActions.tsx
git commit -m "refactor(messenger): ChatHeaderActions block toggle uses unified blockUser/unblockUser"
```

---

### Task 3: Migrate `messenger.tsx` blocked-gates to unified blocking

**Files:**
- Modify: `src/routes/messenger.tsx` (три проверки блокировки перед отправкой
  + иконка в списке диалогов)

**Interfaces:**
- Consumes: `selectors.isBlocked` (Task 1).

- [ ] **Step 1: Добавить `blockedUserIds`/хелпер рядом с `dialogMetaMap`**

Найти (строка 245):

```ts
  const dialogMetaMap = useStore((s) => s.dialogMeta);
```

Добавить сразу после неё:

```ts
  const blockedUserIds = useStore((s) => s.blockedUserIds);
  const isPartnerBlocked = (dialogUserId: string) => blockedUserIds.includes(dialogUserId);
```

- [ ] **Step 2: Заменить проверку в `send`**

Найти:

```ts
    if (getMeta(active.id).blocked) {
      toast.error("Пользователь заблокирован", { description: "Разблокируйте его, чтобы отправлять сообщения" });
      return;
    }
```

Это выражение встречается 3 раза (в `send`, `sendVoice`, `handleAttachment`).
В каждом из трёх мест заменить на:

```ts
    if (isPartnerBlocked(active.userId)) {
      toast.error("Пользователь заблокирован", { description: "Разблокируйте его, чтобы отправлять сообщения" });
      return;
    }
```

- [ ] **Step 3: Заменить иконку блокировки в списке диалогов**

Найти:

```tsx
                              {getMeta(d.id).blocked && <Ban size={12} style={{ color: "var(--error)", flexShrink: 0 }} />}
```

Заменить на:

```tsx
                              {isPartnerBlocked(d.userId) && <Ban size={12} style={{ color: "var(--error)", flexShrink: 0 }} />}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Manual verify**

Открыть `/messenger`, заблокировать собеседника через меню чата (уже
мигрировано в Task 2) → попытка отправить текст/голос/вложение показывает
toast "Пользователь заблокирован"; иконка `Ban` появляется у этого диалога в
списке.

- [ ] **Step 6: Commit**

```bash
git add src/routes/messenger.tsx
git commit -m "refactor(messenger): send-gates and dialog-list icon use unified isBlocked"
```

---

### Task 4: Migrate `BlockedUsersSection.tsx` to `blockedUserIds`

**Files:**
- Modify: `src/components/profile/BlockedUsersSection.tsx`

**Interfaces:**
- Consumes: `AppState.blockedUserIds`, `actions.unblockUser` (Task 1).

- [ ] **Step 1: Переписать компонент целиком**

Заменить весь файл на:

```tsx
import { Ban, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { userById } from "@/lib/mock";
import { useStore, actions } from "@/lib/store";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export function BlockedUsersSection() {
  const blockedUserIds = useStore((s) => s.blockedUserIds);

  if (blockedUserIds.length === 0) {
    return <EmptyState icon={Ban} title="Никто не заблокирован" variant="compact" />;
  }

  return (
    <div className="flex flex-col gap-[8px]">
      {blockedUserIds.map((id) => {
        const u = userById(id);
        return (
          <div
            key={id}
            className="flex items-center gap-[12px] rounded-[12px] border px-[14px] py-[10px]"
            style={{ borderColor: "var(--border)" }}
          >
            <img src={u.avatar} alt="" className="h-[40px] w-[40px] shrink-0 rounded-full object-cover" />
            <div className="min-w-0 flex-1 truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
              {u.name}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                actions.unblockUser(id);
                toast.success(`${u.name} разблокирован`);
              }}
            >
              <ShieldOff size={14} className="mr-[6px]" /> Разблокировать
            </Button>
          </div>
        );
      })}
    </div>
  );
}
```

(`selectors`/`dialogsList` больше не нужны — раздел теперь смотрит
напрямую на `blockedUserIds`, независимо от того, есть ли диалог с этим
человеком, что и требовалось: заблокировать можно и того, с кем никогда не
переписывались.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/BlockedUsersSection.tsx
git commit -m "refactor(profile): BlockedUsersSection reads blockedUserIds directly (not dialog-scoped)"
```

---

### Task 5: `FriendActionsMenu` component

**Files:**
- Create: `src/components/friends/FriendActionsMenu.tsx`

**Interfaces:**
- Produces: `FriendActionsMenu` — props `{ isFriend: boolean; onViewProfile: () => void; onRemoveFriend: () => void; onHide: () => void; onReport: () => void; onBlock: () => void }`.
  Task 6 wires these callbacks from `friends.tsx`.

- [ ] **Step 1: Создать `src/components/friends/FriendActionsMenu.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { User as UserIcon, UserMinus, EyeOff, Flag, Ban, MoreHorizontal } from "lucide-react";

interface Props {
  isFriend: boolean;
  onViewProfile: () => void;
  onRemoveFriend: () => void;
  onHide: () => void;
  onReport: () => void;
  onBlock: () => void;
}

export function FriendActionsMenu({ isFriend, onViewProfile, onRemoveFriend, onHide, onReport, onBlock }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full sm:h-[32px] sm:w-[32px]"
        style={{ color: "var(--foreground-50)" }}
        aria-label="Ещё действия"
        aria-expanded={open}
      >
        <MoreHorizontal size={18} />
      </button>

      {!isMobile && (
        <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-full z-[60] mt-[6px] w-[220px] overflow-hidden rounded-[12px] border"
              style={{
                background: "var(--background-elevated)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-float)",
              }}
            >
              <MenuItems
                isFriend={isFriend}
                onViewProfile={run(onViewProfile)}
                onRemoveFriend={run(onRemoveFriend)}
                onHide={run(onHide)}
                onReport={run(onReport)}
                onBlock={run(onBlock)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {isMobile &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  key="overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="fixed inset-0 z-[89]"
                  style={{ background: "rgba(0,0,0,0.4)" }}
                  onClick={() => setOpen(false)}
                />
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-x-0 bottom-0 z-[90] overflow-hidden rounded-t-[16px] border pb-[max(8px,env(safe-area-inset-bottom))]"
                  style={{
                    background: "var(--background-elevated)",
                    borderColor: "var(--border)",
                    boxShadow: "var(--shadow-float)",
                  }}
                >
                  <MenuItems
                    isFriend={isFriend}
                    onViewProfile={run(onViewProfile)}
                    onRemoveFriend={run(onRemoveFriend)}
                    onHide={run(onHide)}
                    onReport={run(onReport)}
                    onBlock={run(onBlock)}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function MenuItems({
  isFriend,
  onViewProfile,
  onRemoveFriend,
  onHide,
  onReport,
  onBlock,
}: {
  isFriend: boolean;
  onViewProfile: () => void;
  onRemoveFriend: () => void;
  onHide: () => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  return (
    <>
      <Item icon={UserIcon} label="Смотреть профиль" onClick={onViewProfile} />
      {isFriend && <Item icon={UserMinus} label="Удалить из друзей" onClick={onRemoveFriend} />}
      <Item icon={EyeOff} label="Скрыть из рекомендаций" onClick={onHide} />
      <Item icon={Flag} label="Пожаловаться" onClick={onReport} />
      <div className="border-t" style={{ borderColor: "var(--border)" }} />
      <Item icon={Ban} label="Заблокировать" onClick={onBlock} danger />
    </>
  );
}

function Item({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof UserIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-[10px] px-[14px] py-[12px] text-left text-[13px] transition-colors hover:bg-[var(--background-surface)]"
      style={{ color: danger ? "var(--error)" : "var(--foreground)" }}
    >
      <Icon className="h-[16px] w-[16px]" />
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/components/friends/FriendActionsMenu.tsx
git commit -m "feat(friends): FriendActionsMenu component (profile/remove/hide/report/block)"
```

---

### Task 6: Friends page — single-column layout, wider cards, wire blocking

**Files:**
- Modify: `src/routes/friends.tsx`

**Interfaces:**
- Consumes: `selectors.isBlocked`, `actions.blockUser`, `actions.hideUser`
  (Task 1), `FriendActionsMenu` (Task 5).

- [ ] **Step 1: Обновить импорты**

Найти (строки 1-24):

```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, UserPlus, MessageSquare, Check, X, Clock, Users,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatRelativeTime, type User } from "@/lib/mock";
import { useStore, selectors } from "@/lib/store";
import { groupCalls } from "@/lib/groupCall";
import { useOnlineSet } from "@/lib/realtime/presence";
import {
  fetchFriends, fetchIncomingRequests, searchUsers,
  sendFriendRequest, removeFriend, acceptFriendRequest, declineFriendRequest,
  type IncomingRequest,
} from "@/lib/api/social";
import { createConversation } from "@/lib/api/chat";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
```

Заменить на:

```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, UserPlus, MessageSquare, Check, X, Clock, Users,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatRelativeTime, type User } from "@/lib/mock";
import { useStore, selectors, actions } from "@/lib/store";
import { groupCalls } from "@/lib/groupCall";
import { useOnlineSet } from "@/lib/realtime/presence";
import {
  fetchFriends, fetchIncomingRequests, searchUsers,
  sendFriendRequest, removeFriend, acceptFriendRequest, declineFriendRequest,
  type IncomingRequest,
} from "@/lib/api/social";
import { createConversation } from "@/lib/api/chat";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FriendActionsMenu } from "@/components/friends/FriendActionsMenu";
```

- [ ] **Step 2: Добавить blocked/hidden state и фильтрацию**

Найти (строка 52-53):

```ts
  const onlineSet = useOnlineSet();
  const isOnline = (u: User) => onlineSet.has(u.id) || !!u.online;
```

Заменить на:

```ts
  const onlineSet = useOnlineSet();
  const isOnline = (u: User) => onlineSet.has(u.id) || !!u.online;
  const blockedUserIds = useStore((s) => s.blockedUserIds);
  const hiddenUserIds = useStore((s) => s.hiddenUserIds);
  const isBlockedUser = (id: string) => blockedUserIds.includes(id);
```

Найти `filteredUsers` (строки 80-88):

```ts
  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      if (me && u.id === me.id) return false;
      if (tab === "online" && !isOnline(u)) return false;
      const ql = q.toLowerCase();
      if (!ql) return true;
      return u.name.toLowerCase().includes(ql) || u.interests.toLowerCase().includes(ql);
    });
  }, [q, tab, allUsers, me]);
```

Заменить на:

```ts
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

Найти строку, где вычисляется `requests` из state (используется напрямую в
JSX, без `useMemo`) — добавить фильтрацию блокировки прямо в рендере вкладки
"Заявки" в Step 5 ниже (там, где `requests.map(...)`), а не здесь, т.к.
`requests` — простой `useState`, не производный список.

- [ ] **Step 3: Добавить обработчики блокировки/скрытия**

Найти конец функции `writeTo` (строки 144-152):

```ts
  const writeTo = async (u: User) => {
    if (!u.numericId || !me) return;
    try {
      const dialog = await createConversation(u.numericId, me.id);
      navigateMessenger({ to: "/messenger", search: { chat: dialog.id } });
    } catch {
      toast.error("Не удалось открыть диалог");
    }
  };
```

Добавить сразу после неё (переиспользуя уже существующий в компоненте
`navigateMessenger`, без второго вызова `useNavigate()`):

```ts
  const viewProfile = (u: User) => {
    navigateMessenger({ to: "/user/$id", params: { id: u.slug ?? u.id } });
  };

  const removeFriendVia = async (u: User) => {
    if (!u.numericId) return;
    try {
      await removeFriend(u.numericId);
      setFriends((fs) => fs.filter((f) => f.id !== u.id));
      toast.success("Удалён из друзей");
    } catch {
      toast.error("Не удалось удалить из друзей");
    }
  };

  const hideUserFromList = (u: User) => {
    actions.hideUser(u.id);
    toast.success("Скрыто из рекомендаций");
  };

  const reportUser = () => {
    toast("Жалоба: будет доступно позже");
  };

  const blockUserVia = (u: User) => {
    actions.blockUser(u.id);
    setFriends((fs) => fs.filter((f) => f.id !== u.id));
    setRequests((rs) => rs.filter((r) => r.from.id !== u.id));
    toast.success(`${u.name} заблокирован`, { description: "Пропал из друзей и списков — можно разблокировать в разделе «Заблокированные» в профиле" });
  };
```

- [ ] **Step 4: Заявки — фильтр по блокировке + добавить FriendActionsMenu**

Найти блок рендера вкладки "Заявки" (строки 253-311):

```tsx
              ) : (
                <div className="grid gap-[12px] sm:grid-cols-2">
                  {requests.map((r) => {
                    const u = r.from;
                    return (
                      <Card
                        key={r.id}
                        className="flex items-start gap-[12px] p-[16px] shadow-none"
                        style={{ borderColor: "var(--border)", borderRadius: 14 }}
                      >
                        <Link to="/user/$id" params={{ id: u.slug ?? u.id }} className="shrink-0">
                          <Avatar className="h-[48px] w-[48px]">
                            <AvatarImage src={u.avatar} alt="" />
                            <AvatarFallback
                              className="text-[13px] font-semibold"
                              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                            >
                              {userInitials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/user/$id"
                            params={{ id: u.slug ?? u.id }}
                            className="block truncate font-semibold text-[14px]"
                            style={{ color: "var(--foreground)" }}
                          >
                            {u.name}
                          </Link>
                          <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
                            Хочет добавить вас в друзья
                          </p>
                          <p className="mt-[2px] flex items-center gap-[4px] text-[11px]" style={{ color: "var(--foreground-30)" }}>
                            <Clock size={10} /> {formatRelativeTime(r.date)}
                          </p>
                          <div className="mt-[10px] flex gap-[8px]">
                            <Button
                              size="sm"
                              onClick={() => accept(r.id)}
                              className="h-[32px] rounded-[8px] px-[12px] text-[12px] gap-[4px]"
                            >
                              <Check size={12} /> Принять
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => decline(r.id)}
                              className="h-[32px] rounded-[8px] px-[12px] text-[12px] gap-[4px]"
                            >
                              <X size={12} /> Отклонить
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )
```

Заменить на:

```tsx
              ) : (
                <div className="flex flex-col gap-[10px]">
                  {requests.filter((r) => !isBlockedUser(r.from.id)).map((r) => {
                    const u = r.from;
                    return (
                      <Card
                        key={r.id}
                        className="flex items-start gap-[14px] p-[20px] shadow-none"
                        style={{ borderColor: "var(--border)", borderRadius: 14 }}
                      >
                        <Link to="/user/$id" params={{ id: u.slug ?? u.id }} className="shrink-0">
                          <Avatar className="h-[52px] w-[52px]">
                            <AvatarImage src={u.avatar} alt="" />
                            <AvatarFallback
                              className="text-[14px] font-semibold"
                              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                            >
                              {userInitials(u.name)}
                            </AvatarFallback>
                          </Avatar>
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
                          <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
                            Хочет добавить вас в друзья
                          </p>
                          <p className="mt-[2px] flex items-center gap-[4px] text-[11px]" style={{ color: "var(--foreground-30)" }}>
                            <Clock size={10} /> {formatRelativeTime(r.date)}
                          </p>
                          <div className="mt-[12px] flex gap-[8px]">
                            <Button
                              size="sm"
                              onClick={() => accept(r.id)}
                              className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
                            >
                              <Check size={13} /> Принять
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => decline(r.id)}
                              className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
                            >
                              <X size={13} /> Отклонить
                            </Button>
                          </div>
                        </div>
                        <FriendActionsMenu
                          isFriend={false}
                          onViewProfile={() => viewProfile(u)}
                          onRemoveFriend={() => {}}
                          onHide={() => hideUserFromList(u)}
                          onReport={reportUser}
                          onBlock={() => {
                            blockUserVia(u);
                            decline(r.id);
                          }}
                        />
                      </Card>
                    );
                  })}
                </div>
              )
```

(`onRemoveFriend={() => {}}` — безопасный no-op: пункт "Удалить из друзей"
не рендерится в меню, когда `isFriend={false}`, поэтому этот callback никогда
не вызывается для карточки заявки; передаётся только чтобы удовлетворить
обязательный проп интерфейса `FriendActionsMenu`.)

- [ ] **Step 5: Список друзей/рекомендаций — 1 колонка + FriendActionsMenu**

Найти блок рендера вкладок "Все"/"Онлайн" (строки 325-395):

```tsx
            ) : (
              <div className="grid gap-[12px] sm:grid-cols-2">
                {filteredUsers.map((u) => {
                  const isAdded = added.has(u.id);
                  const isPending = !isAdded && pending.has(u.id);
                  const interests = u.interests.split(",").slice(0, 3).join(", ");
                  return (
                    <Card
                      key={u.id}
                      className="flex gap-[12px] p-[16px] shadow-none"
                      style={{ borderColor: "var(--border)", borderRadius: 14 }}
                    >
                      <Link to="/user/$id" params={{ id: u.slug ?? u.id }} className="relative shrink-0">
                        <Avatar className="h-[48px] w-[48px]">
                          <AvatarImage src={u.avatar} alt="" />
                          <AvatarFallback
                            className="text-[13px] font-semibold"
                            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                          >
                            {userInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        {isOnline(u) && (
                          <span
                            className="absolute bottom-0 right-0 h-[12px] w-[12px] rounded-full"
                            style={{ background: "var(--success)", border: "2px solid var(--background)" }}
                          />
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/user/$id"
                          params={{ id: u.slug ?? u.id }}
                          className="block truncate font-semibold text-[14px]"
                          style={{ color: "var(--foreground)" }}
                        >
                          {u.name}
                        </Link>
                        <div className="mt-[2px] flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                          <MapPin size={11} /> <span className="truncate">{u.city}</span>
                        </div>
                        <div className="mt-[2px] truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>{interests}</div>
                        <div className="mt-[10px] flex flex-wrap gap-[8px]">
                          <Button
                            size="sm"
                            variant={isAdded || isPending ? "outline" : "default"}
                            disabled={isPending}
                            onClick={() => toggleFriend(u)}
                            className="h-[32px] rounded-[8px] px-[12px] text-[12px] gap-[4px]"
                          >
                            {isAdded
                              ? <><Check size={12} /> В друзьях</>
                              : isPending
                              ? <><Clock size={12} /> Заявка отправлена</>
                              : <><UserPlus size={12} /> Добавить</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => writeTo(u)}
                            className="h-[32px] rounded-[8px] px-[12px] text-[12px] gap-[4px]"
                          >
                            <MessageSquare size={12} /> Написать
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
```

Заменить на:

```tsx
            ) : (
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
            )
```

- [ ] **Step 6: Обновить skeleton-заглушку на 1 колонку**

Найти (строки 229-244):

```tsx
            {loading ? (
              <div className="grid gap-[12px] sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card
                    key={i}
                    className="flex items-center gap-[12px] p-[16px] shadow-none"
                    style={{ borderColor: "var(--border)", borderRadius: 14 }}
                  >
                    <Skeleton className="h-[48px] w-[48px] shrink-0 rounded-full" />
                    <div className="flex-1 space-y-[8px]">
                      <Skeleton className="h-[12px] rounded-[6px]" style={{ width: `${40 + (i * 13) % 40}%` }} />
                      <Skeleton className="h-[10px] rounded-[6px]" style={{ width: `${30 + (i * 11) % 30}%` }} />
                    </div>
                  </Card>
                ))}
              </div>
            ) : tab === "requests" ? (
```

Заменить на:

```tsx
            {loading ? (
              <div className="flex flex-col gap-[10px]">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card
                    key={i}
                    className="flex items-center gap-[16px] p-[20px] shadow-none"
                    style={{ borderColor: "var(--border)", borderRadius: 14 }}
                  >
                    <Skeleton className="h-[56px] w-[56px] shrink-0 rounded-full" />
                    <div className="flex-1 space-y-[8px]">
                      <Skeleton className="h-[12px] rounded-[6px]" style={{ width: `${40 + (i * 13) % 40}%` }} />
                      <Skeleton className="h-[10px] rounded-[6px]" style={{ width: `${30 + (i * 11) % 30}%` }} />
                    </div>
                  </Card>
                ))}
              </div>
            ) : tab === "requests" ? (
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 8: Manual verify (dev server, `preview_*`)**

Desktop (≥1280px): список друзей — 1 колонка, карточки на всю ширину
контента, действия справа. Добавить в друзья → кнопка меняется на "Заявка
отправлена"/"В друзьях". Написать → переход в мессенджер с открытым диалогом.
Заблокировать через three-dots → карточка немедленно исчезает из списка;
открыть `/profile` → вкладка "Заблокированные" → пользователь там, кнопка
"Разблокировать" возвращает доступ (демо не возвращает его обратно в список
друзей автоматически — только снимает блокировку, это отдельное намеренное
разделение, соответствует ТЗ "разблокировать из раздела").
Mobile (375px): карточки друг под другом, все кнопки ≥44px
(`preview_inspect` на `getBoundingClientRect`), three-dots открывает
bottom-sheet, не вылезающий за экран.

- [ ] **Step 9: Commit**

```bash
git add src/routes/friends.tsx
git commit -m "feat(friends): single-column card layout, FriendActionsMenu, block/hide wiring"
```

---

### Task 7: `backend-endpoints-needed.md` updates + final QA

**Files:**
- Modify: `frontend/docs/backend-endpoints-needed.md`

**Interfaces:** нет новых — финальная документация и верификация.

- [ ] **Step 1: Уточнить запись №2 ("Блокировка пользователя")**

Найти:

```md
**Endpoint разблокировки:** `DELETE /users/{userId}/block`  
**Статус:** `Needed` — нигде нет (`blockUser` в `social.ts` отсутствует).  
**Demo/mock fallback:** флаг `blocked` в `dialogMetaMap` уже есть в store — можно имитировать локально.
```

Заменить на:

```md
**Endpoint разблокировки:** `DELETE /users/{userId}/block`  
**Статус:** `Needed` — нигде нет (`blockUser` в `social.ts` отсутствует).  
**Demo/mock fallback (обновлено 2026-07-05):** `blockedUserIds: ID[]` в
`lib/store.ts` (`actions.blockUser`/`unblockUser`, `selectors.isBlocked`) —
единая user-level блокировка, используется и мессенджером (`ChatHeaderActions`,
send-гейты в `messenger.tsx`), и страницей друзей (`friends.tsx`), и разделом
"Заблокированные" в `/profile` (`BlockedUsersSection`). Симметрия
("Б тоже не видит А") — только клиентская иллюзия в рамках одного
demo-store; реальная двусторонняя блокировка требует серверного
relationship-статуса, видимого обеим сторонам.
```

- [ ] **Step 2: Финальный typecheck всего проекта**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Grep-аудит на отсутствие "Добавить в список"**

Run: `grep -in "добавить в список" src/routes/friends.tsx src/components/friends/*.tsx`
Expected: пусто (пункт сознательно не реализован).

- [ ] **Step 4: Manual QA (preview_* MCP, полный сценарий из ТЗ)**

1. `/friends`, вкладка "Все" — добавить в друзья → кнопка меняется на
   "Заявка отправлена".
2. Написать → открывается `/messenger` с выбранным диалогом.
3. Заблокировать пользователя (three-dots → Заблокировать) → карточка
   пропадает из списка друзей на `/friends` немедленно.
4. `/profile` → вкладка "Заблокированные" → заблокированный виден → нажать
   "Разблокировать" → пропадает из этого списка.
5. В `/messenger` (если был диалог с заблокированным до блокировки) —
   попытка написать ему показывает toast "Пользователь заблокирован" ПОКА он
   заблокирован; после разблокировки на `/profile` — снова можно писать.
6. Mobile 375px: three-dots-меню на карточке друга открывается как
   bottom-sheet, не обрезается экраном; все кнопки ≥44px.

- [ ] **Step 5: Commit**

```bash
git add docs/backend-endpoints-needed.md
git commit -m "docs: update backend-endpoints-needed.md for unified user-level blocking"
```

---

## После завершения плана

Использовать `superpowers:finishing-a-development-branch` — та же
последовательность, что в предыдущих фичах: merge в `master`, затем в
`neeklo` (fetch первым, merge, не rebase), деплой на VPS через
`deploy/scripts/deploy-neeklo-frontend.sh`, обновить
`memory/project_neeklo_stand.md` новым HEAD.

**Перед первым коммитом любой новой фичи после этой** — согласно
зафиксированному в памяти правилу (`feedback_feature_branch_discipline`),
подтвердить текущую ветку (`git branch --show-current`) ДО начала
исследования кода/brainstorming, не после.
