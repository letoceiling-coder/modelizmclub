# Мессенджер: базовые ожидаемые функции — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Мессенджер получает вложения (фото/видео/файл), действия с сообщением
(reply/copy/forward/pin/delete-own/report), закрепление чата и сообщения, и
раздел "Заблокированные" в профиле — всё работает хотя бы в demo-режиме поверх
существующего `store.ts`, без изменений chat/socket-инфраструктуры.

**Architecture:** Расширяем существующие типы `Message`/`Dialog` (`lib/mock.ts`)
и reducer-actions в `lib/store.ts` (тот же паттерн `dispatch({ type: ... })`,
что уже используют `SET_DIALOG_META`/`ADD_MESSAGE`). Новые UI-компоненты
(`AttachmentMenu`, `MessageActionsMenu`, `ForwardDialog`, `MessageFileBubble`,
`BlockedUsersSection`) следуют визуальным паттернам уже существующих
компонентов (`ChatHeaderActions`, `PostActionMenu`, `CreateChatDialog`) —
`useRef` + click-outside + Escape, framer-motion dropdown, CSS-переменные
дизайн-системы. `messenger.tsx` и `profile.tsx` подключают их через props/state,
без изменения realtime/API-слоя (`lib/api/chat.ts`, `lib/realtime/*`).

**Tech Stack:** React 18, TypeScript strict, TanStack Router, Tailwind v4
(CSS custom properties), framer-motion, lucide-react, sonner (toast).

## Global Constraints

- Работать строго внутри `frontend/`.
- Не трогать backend chat/socket-инфраструктуру и реальную доставку сообщений
  (`lib/api/chat.ts` функции не меняются, `lib/realtime/*` не меняются).
- Delete — **только "у себя"** (`deletedForMe`), вариант "у всех" не
  предлагается в UI вообще (ни как disabled-пункт).
- Одно закреплённое сообщение на чат (не список).
- Если для действия нет backend API — реализуется как demo/local state поверх
  `store.ts`, и фиксируется в `frontend/docs/backend-endpoints-needed.md`.
- Все интерактивные элементы ≥44px на mobile (`<640px`, т.е. без `sm:`-префикса
  в Tailwind — mobile-first: базовый размер 44px, `sm:` уменьшает до 36/40px).
- После каждой задачи: `npx tsc --noEmit` должен быть чист.
- Юнит-тестов в проекте нет (нет Vitest/RTL) — верификация через `tsc --noEmit`,
  `grep`, и вручную через `preview_*` MCP-инструменты (не изобретать тесты).
- Никогда не коммитить без явного разрешения пользователя на комментарий/merge
  за пределами этого плана (сам факт выполнения плана уже разрешён).

---

### Task 1: Данные — расширение `Message`/`Dialog` + store-actions

**Files:**
- Modify: `src/lib/mock.ts` (interface `Message` ~168-176, `Dialog` ~201-208)
- Modify: `src/lib/store.ts` (Action union ~100-113, reducer ~127+, actions object ~180+)

**Interfaces:**
- Produces: `MessageFile` type; `Message.file?/pinned?/deletedForMe?/forwardedFrom?`;
  `Dialog.pinned?`; `actions.pinMessage(dialogId, messageId)`,
  `actions.deleteMessageForMe(dialogId, messageId)`,
  `actions.pinDialog(dialogId, pinned)`, `actions.clearHistory(dialogId)`.
  Все последующие задачи используют эти имена и сигнатуры дословно.

- [ ] **Step 1: Расширить `Message` и `Dialog` в `src/lib/mock.ts`**

Найти текущий блок (строки 168-176):

```ts
export interface Message {
  id: ID;
  authorId: ID;
  time: string;
  text: string;
  status?: "sent" | "delivered" | "read";
  replyTo?: ID;
  image?: string;
  voice?: VoiceMessage;
}
```

Заменить на:

```ts
export interface MessageFile {
  name: string;
  size: number; // bytes
  kind: "video" | "file";
  url: string; // blob: URL (demo) or real URL
}

export interface Message {
  id: ID;
  authorId: ID;
  time: string;
  text: string;
  status?: "sent" | "delivered" | "read";
  replyTo?: ID;
  image?: string;
  voice?: VoiceMessage;
  file?: MessageFile;
  pinned?: boolean;
  deletedForMe?: boolean;
  forwardedFrom?: ID;
}
```

(`kind` не включает `"image"` — фото продолжает идти через существующее поле
`image`, как описано в спеке; `MessageFile` только для видео/файла.)

Найти текущий блок (строки 201-208):

```ts
export interface Dialog {
  id: ID;
  userId: ID;
  lastMessage: string;
  time: string;
  unread?: number;
  messages: Message[];
}
```

Заменить на:

```ts
export interface Dialog {
  id: ID;
  userId: ID;
  lastMessage: string;
  time: string;
  unread?: number;
  messages: Message[];
  pinned?: boolean;
}
```

- [ ] **Step 2: Добавить новые Action-варианты в `src/lib/store.ts`**

Найти блок `type Action =` (строки ~100-113), последняя строка перед `;`:

```ts
  | { type: "SET_DIALOG_MESSAGES"; dialogId: ID; messages: Message[] };
```

Заменить на:

```ts
  | { type: "SET_DIALOG_MESSAGES"; dialogId: ID; messages: Message[] }
  | { type: "PIN_MESSAGE"; dialogId: ID; messageId: ID }
  | { type: "DELETE_MESSAGE_FOR_ME"; dialogId: ID; messageId: ID }
  | { type: "PIN_DIALOG"; dialogId: ID; pinned: boolean }
  | { type: "CLEAR_HISTORY"; dialogId: ID };
```

- [ ] **Step 3: Добавить reducer-кейсы**

Найти в `reducer()` кейс `case "SET_DIALOG_MESSAGES":` и следующий за ним
`default: return s;` (конец switch). Вставить перед `default:`:

```ts
    case "PIN_MESSAGE": {
      const d = s.dialogs[a.dialogId];
      if (!d) return s;
      const target = d.messages.find((m) => m.id === a.messageId);
      const nextPinned = !target?.pinned;
      const messages = d.messages.map((m) => ({
        ...m,
        pinned: m.id === a.messageId ? nextPinned : false,
      }));
      return { ...s, dialogs: { ...s.dialogs, [a.dialogId]: { ...d, messages } } };
    }
    case "DELETE_MESSAGE_FOR_ME": {
      const d = s.dialogs[a.dialogId];
      if (!d) return s;
      const messages = d.messages.map((m) =>
        m.id === a.messageId ? { ...m, deletedForMe: true } : m,
      );
      return { ...s, dialogs: { ...s.dialogs, [a.dialogId]: { ...d, messages } } };
    }
    case "PIN_DIALOG": {
      const d = s.dialogs[a.dialogId];
      if (!d) return s;
      return { ...s, dialogs: { ...s.dialogs, [a.dialogId]: { ...d, pinned: a.pinned } } };
    }
    case "CLEAR_HISTORY": {
      const d = s.dialogs[a.dialogId];
      if (!d) return s;
      return { ...s, dialogs: { ...s.dialogs, [a.dialogId]: { ...d, messages: [] } } };
    }
```

- [ ] **Step 4: Добавить actions в объект `actions`**

Найти в объекте `export const actions = { ... }` строку:

```ts
  setDialogMeta: (dialogId: ID, patch: Partial<DialogMeta>) => dispatch({ type: "SET_DIALOG_META", dialogId, patch }),
```

Добавить сразу после неё:

```ts
  pinMessage: (dialogId: ID, messageId: ID) => dispatch({ type: "PIN_MESSAGE", dialogId, messageId }),
  deleteMessageForMe: (dialogId: ID, messageId: ID) => dispatch({ type: "DELETE_MESSAGE_FOR_ME", dialogId, messageId }),
  pinDialog: (dialogId: ID, pinned: boolean) => dispatch({ type: "PIN_DIALOG", dialogId, pinned }),
  clearHistory: (dialogId: ID) => dispatch({ type: "CLEAR_HISTORY", dialogId }),
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок (никакой другой код ещё не использует новые поля/actions,
так что единственный риск — опечатка в типах).

- [ ] **Step 6: Commit**

```bash
git add src/lib/mock.ts src/lib/store.ts
git commit -m "feat(messenger): extend Message/Dialog types + pin/delete/clear store actions"
```

---

### Task 2: Вложения — AttachmentMenu, быстрая кнопка-фото, MessageFileBubble

**Files:**
- Create: `src/components/messenger/AttachmentMenu.tsx`
- Create: `src/components/messenger/MessageFileBubble.tsx`
- Modify: `src/routes/messenger.tsx` (imports ~1-40, composer JSX ~656-707,
  `MessageBubble` render body ~160-194, `MessengerPage` body — add handler)

**Interfaces:**
- Consumes: `Message.file` (Task 1), `actions.addMessage` (existing).
- Produces: `AttachmentMenu` component (`onPick: (file: File, kind: "image"|"video"|"file") => void`),
  `MessageFileBubble` component (`{ file: MessageFile; isMe: boolean }`),
  `handleAttachment(file, kind)` in `MessengerPage` — used by Task 3 for
  nothing further (self-contained), но по паттерну совпадает с `sendVoice`.

- [ ] **Step 1: Создать `src/components/messenger/AttachmentMenu.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Paperclip, Image as ImageIcon, Video, File as FileIcon } from "lucide-react";
import { toast } from "sonner";

export type AttachmentKind = "image" | "video" | "file";

interface Props {
  onPick: (file: File, kind: AttachmentKind) => void;
}

const MAX_BYTES = 20 * 1024 * 1024;

export function AttachmentMenu({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<AttachmentKind>("file");

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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

  const openPicker = (kind: AttachmentKind) => {
    setOpen(false);
    pendingKind.current = kind;
    const accept = kind === "image" ? "image/*" : kind === "video" ? "video/*" : "*/*";
    if (inputRef.current) {
      inputRef.current.accept = accept;
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("Файл слишком большой", { description: "Максимум 20 МБ в демо-режиме" });
      return;
    }
    onPick(file, pendingKind.current);
  };

  return (
    <div className="relative" ref={ref}>
      <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full sm:h-[36px] sm:w-[36px]"
        style={{ color: "var(--foreground-50)" }}
        aria-label="Прикрепить"
        aria-expanded={open}
      >
        <Paperclip size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-full left-0 z-[60] mb-[8px] w-[180px] overflow-hidden rounded-[12px] border"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            <MenuItem icon={ImageIcon} label="Фото" onClick={() => openPicker("image")} />
            <MenuItem icon={Video} label="Видео" onClick={() => openPicker("video")} />
            <MenuItem icon={FileIcon} label="Файл" onClick={() => openPicker("file")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ImageIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-[10px] px-[14px] py-[10px] text-left text-[13px] transition-colors hover:bg-[var(--background-surface)]"
      style={{ color: "var(--foreground)" }}
    >
      <Icon className="h-[16px] w-[16px]" style={{ color: "var(--foreground-70)" }} />
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Создать `src/components/messenger/MessageFileBubble.tsx`**

```tsx
import { FileText } from "lucide-react";
import type { MessageFile } from "@/lib/mock";

export function MessageFileBubble({ file, isMe }: { file: MessageFile; isMe: boolean }) {
  if (file.kind === "video") {
    return (
      <video
        src={file.url}
        controls
        className="mb-[6px] w-full object-cover"
        style={{ borderRadius: 12, maxWidth: 280, maxHeight: 320 }}
      />
    );
  }

  const sizeLabel =
    file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} МБ`
      : `${Math.max(1, Math.round(file.size / 1024))} КБ`;

  return (
    <a
      href={file.url}
      download={file.name}
      className="mb-[6px] flex items-center gap-[10px] px-[12px] py-[10px] transition-opacity hover:opacity-90"
      style={{
        borderRadius: 12,
        background: isMe ? "rgba(255,255,255,0.14)" : "var(--background-elevated)",
        maxWidth: 260,
      }}
    >
      <div
        className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full"
        style={{ background: isMe ? "rgba(255,255,255,0.2)" : "var(--accent-soft)" }}
      >
        <FileText size={18} style={{ color: isMe ? "white" : "var(--accent)" }} />
      </div>
      <div className="min-w-0">
        <div
          className="truncate text-[13px] font-medium"
          style={{ color: isMe ? "white" : "var(--foreground)" }}
        >
          {file.name}
        </div>
        <div
          className="text-[11px]"
          style={{ color: isMe ? "rgba(255,255,255,0.7)" : "var(--foreground-50)" }}
        >
          {sizeLabel}
        </div>
      </div>
    </a>
  );
}
```

- [ ] **Step 3: Подключить в `src/routes/messenger.tsx` — импорты**

Найти строку (строка 6-7):

```ts
  Paperclip, Send, Users, X, Plus, Archive, Ban, BellOff, Radio, BadgeCheck, ImageOff,
} from "lucide-react";
```

Заменить на:

```ts
  Send, Users, X, Plus, Archive, Ban, BellOff, Radio, BadgeCheck, ImageOff, ImagePlus,
} from "lucide-react";
```

(`Paperclip` больше не импортируется напрямую в `messenger.tsx` — он теперь
внутри `AttachmentMenu`; `ImagePlus` — иконка быстрой кнопки-фото.)

Добавить после строки `import { ChatHeaderActions } from "@/components/messenger/ChatHeaderActions";`:

```ts
import { AttachmentMenu, type AttachmentKind } from "@/components/messenger/AttachmentMenu";
import { MessageFileBubble } from "@/components/messenger/MessageFileBubble";
```

- [ ] **Step 4: Рендер вложения в `MessageBubble`**

Найти блок (строка 180):

```tsx
          {msg.image && <MessageImage src={msg.image} />}
          {msg.voice && <VoiceBubble voice={msg.voice} isMe={isMe} />}
```

Заменить на:

```tsx
          {msg.image && <MessageImage src={msg.image} />}
          {msg.file && <MessageFileBubble file={msg.file} isMe={isMe} />}
          {msg.voice && <VoiceBubble voice={msg.voice} isMe={isMe} />}
```

- [ ] **Step 5: Добавить `handleAttachment` в `MessengerPage`**

Найти функцию `sendVoice` (строки 390-423), вставить сразу после её
закрывающей скобки новую функцию:

```tsx
  const handleAttachment = (file: File, kind: AttachmentKind) => {
    if (!active) return;
    if (getMeta(active.id).blocked) {
      toast.error("Пользователь заблокирован", { description: "Разблокируйте его, чтобы отправлять сообщения" });
      return;
    }
    const dialogId = active.id;
    const url = URL.createObjectURL(file);
    const replyId = replyTo?.id;
    const tempId = `tmp${Date.now()}`;
    const base: Message = {
      id: tempId,
      authorId: meId,
      time: new Date().toISOString(),
      text: "",
      status: "sent",
      replyTo: replyId,
    };
    const optimistic: Message =
      kind === "image" ? { ...base, image: url } : { ...base, file: { name: file.name, size: file.size, kind, url } };
    actions.addMessage(dialogId, optimistic);
    setReplyTo(null);
    toast("Вложение отправлено (демо)", { description: "Загрузка на сервер появится позже" });
  };

  const quickPhotoRef = useRef<HTMLInputElement>(null);
  const handleQuickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleAttachment(file, "image");
  };
```

- [ ] **Step 6: Заменить скрепку в composer на AttachmentMenu + быструю кнопку-фото**

Найти блок (строки 666-673):

```tsx
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-[36px] w-[36px] shrink-0 rounded-full text-[var(--foreground-50)]"
                      aria-label="Прикрепить"
                    >
                      <Paperclip size={18} />
                    </Button>
```

Заменить на:

```tsx
                    <AttachmentMenu onPick={handleAttachment} />
                    <input
                      ref={quickPhotoRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleQuickPhoto}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => quickPhotoRef.current?.click()}
                      className="h-[44px] w-[44px] shrink-0 rounded-full text-[var(--foreground-50)] sm:h-[36px] sm:w-[36px]"
                      aria-label="Быстрое фото"
                    >
                      <ImagePlus size={18} />
                    </Button>
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 8: Manual verify (dev server)**

Открыть `/messenger`, выбрать любой диалог, нажать на скрепку → появляется
меню Фото/Видео/Файл; нажать на быструю кнопку рядом — сразу открывается
выбор фото (системный file picker), без промежуточного меню. Выбрать любой
файл — сообщение с превью появляется в чате.

- [ ] **Step 9: Commit**

```bash
git add src/components/messenger/AttachmentMenu.tsx src/components/messenger/MessageFileBubble.tsx src/routes/messenger.tsx
git commit -m "feat(messenger): attachment menu (photo/video/file) + quick-photo button"
```

---

### Task 3: Действия с сообщением — MessageActionsMenu (reply/copy/forward/pin/delete/report)

**Files:**
- Create: `src/components/messenger/MessageActionsMenu.tsx`
- Modify: `src/routes/messenger.tsx` (`MessageBubble` ~124-198, `MessengerPage` handlers, message list render ~618-621)

**Interfaces:**
- Consumes: `actions.pinMessage`, `actions.deleteMessageForMe` (Task 1).
- Produces: `MessageActionsMenu` component + `MessageActionsMenuHandle` (forwardRef
  handle with `open(): void`, used by long-press in this same task).
  `onForward: (m: Message) => void` prop wired to Task 4's `ForwardDialog`.

- [ ] **Step 1: Создать `src/components/messenger/MessageActionsMenu.tsx`**

```tsx
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerUpLeft, Copy, Forward, Pin, PinOff, Trash2, Flag, MoreHorizontal } from "lucide-react";

export interface MessageActionsMenuHandle {
  open: () => void;
}

interface Props {
  isMe: boolean;
  pinned: boolean;
  align: "left" | "right";
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onPin: () => void;
  onDelete: () => void;
  onReport: () => void;
}

export const MessageActionsMenu = forwardRef<MessageActionsMenuHandle, Props>(function MessageActionsMenu(
  { isMe, pinned, align, onReply, onCopy, onForward, onPin, onDelete, onReport },
  ref,
) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }));

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
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:h-[28px] sm:w-[28px] ${open ? "!opacity-100" : ""}`}
        style={{ background: "var(--background-surface)", color: "var(--foreground-50)" }}
        aria-label="Действия с сообщением"
        aria-expanded={open}
      >
        <MoreHorizontal size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={isMobile ? { opacity: 0, y: 24 } : { opacity: 0, y: -6, scale: 0.96 }}
            animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { opacity: 0, y: 24 } : { opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={
              isMobile
                ? "fixed inset-x-0 bottom-0 z-[90] overflow-hidden rounded-t-[16px] border pb-[max(8px,env(safe-area-inset-bottom))]"
                : `absolute top-full z-[60] mt-[6px] w-[220px] overflow-hidden rounded-[12px] border ${align === "right" ? "right-0" : "left-0"}`
            }
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            <Item icon={CornerUpLeft} label="Ответить" onClick={run(onReply)} />
            <Item icon={Copy} label="Копировать" onClick={run(onCopy)} />
            <Item icon={Forward} label="Переслать" onClick={run(onForward)} />
            <Item icon={pinned ? PinOff : Pin} label={pinned ? "Открепить" : "Закрепить"} onClick={run(onPin)} />
            {isMe && <Item icon={Trash2} label="Удалить у себя" onClick={run(onDelete)} danger />}
            {!isMe && <Item icon={Flag} label="Пожаловаться" onClick={run(onReport)} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

function Item({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Copy;
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

- [ ] **Step 2: Обновить импорты в `src/routes/messenger.tsx`**

Найти строку (первая строка блока lucide-react import, строка 5):

```ts
  ArrowLeft, Check, CheckCheck, CornerUpLeft, MessageSquare,
```

Заменить на:

```ts
  ArrowLeft, Check, CheckCheck, CornerUpLeft, MessageSquare, Pin,
```

(`CornerUpLeft` остаётся — он всё ещё используется в баннере reply-превью над
composer'ом, строка ~642, эта область не меняется. Меняется только сам рендер
пузыря сообщения, где `CornerUpLeft`-стрелка заменяется на `MessageActionsMenu`.
`Pin` понадобится в Task 6/7 для иконки закреплённого чата — импортировать
сразу, чтобы не трогать этот блок ещё раз.)

Добавить после `import { MessageFileBubble } from "@/components/messenger/MessageFileBubble";`:

```ts
import { MessageActionsMenu, type MessageActionsMenuHandle } from "@/components/messenger/MessageActionsMenu";
```

- [ ] **Step 3: Переписать `MessageBubble` — заменить reply-стрелку на меню действий**

Найти весь блок `function MessageBubble({ ... }) { ... }` (строки 124-198) и
заменить целиком на:

```tsx
function MessageBubble({
  msg, prev, allMessages, onReply, onCopy, onForward, onPin, onDelete, onReport,
}: {
  msg: Message; prev?: Message; allMessages: Message[];
  onReply: (m: Message) => void;
  onCopy: (m: Message) => void;
  onForward: (m: Message) => void;
  onPin: (m: Message) => void;
  onDelete: (m: Message) => void;
  onReport: (m: Message) => void;
}) {
  const meId = useStore((s) => s.currentUserId);
  const isMe = msg.authorId === meId;
  const author = userById(msg.authorId);
  const isFirstInGroup = !prev || prev.authorId !== msg.authorId;
  const reply = msg.replyTo ? allMessages.find((m) => m.id === msg.replyTo) : null;
  const replyAuthor = reply ? userById(reply.authorId) : null;
  const forwardedAuthor = msg.forwardedFrom ? userById(msg.forwardedFrom) : null;

  const menuRef = useRef<MessageActionsMenuHandle>(null);
  const touchTimer = useRef<number | null>(null);
  const startLongPress = () => {
    touchTimer.current = window.setTimeout(() => menuRef.current?.open(), 400);
  };
  const cancelLongPress = () => {
    if (touchTimer.current) {
      window.clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`group flex items-end gap-[8px] ${isMe ? "justify-end" : "justify-start"}`}
      style={{ marginTop: isFirstInGroup ? 16 : 4 }}
    >
      {!isMe && (
        <div className="w-[28px] shrink-0">
          {isFirstInGroup && <ChatAvatar src={author.avatar} name={author.name} size={28} />}
        </div>
      )}
      <div
        className="relative max-w-[70%]"
        data-msg-id={msg.id}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
      >
        <div className={`absolute top-1/2 -translate-y-1/2 ${isMe ? "-left-[48px]" : "-right-[48px]"}`}>
          <MessageActionsMenu
            ref={menuRef}
            isMe={isMe}
            pinned={Boolean(msg.pinned)}
            align={isMe ? "right" : "left"}
            onReply={() => onReply(msg)}
            onCopy={() => onCopy(msg)}
            onForward={() => onForward(msg)}
            onPin={() => onPin(msg)}
            onDelete={() => onDelete(msg)}
            onReport={() => onReport(msg)}
          />
        </div>
        <div
          className="px-[14px] py-[10px]"
          style={{
            background: isMe ? "var(--accent)" : "var(--background-surface)",
            color: isMe ? "white" : "var(--foreground)",
            borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          }}
        >
          {forwardedAuthor && (
            <div
              className="mb-[6px] text-[11px] font-semibold italic"
              style={{ color: isMe ? "rgba(255,255,255,0.75)" : "var(--foreground-50)" }}
            >
              Переслано от {forwardedAuthor.name}
            </div>
          )}
          {reply && (
            <div
              className="mb-[6px] pl-[8px] text-[12px]"
              style={{
                borderLeft: `3px solid ${isMe ? "rgba(255,255,255,0.4)" : "var(--accent)"}`,
                color: isMe ? "rgba(255,255,255,0.85)" : "var(--foreground-50)",
              }}
            >
              <div className="font-semibold">{reply.authorId === meId ? "Вы" : replyAuthor?.name}</div>
              <div className="truncate">{reply.text}</div>
            </div>
          )}
          {msg.image && <MessageImage src={msg.image} />}
          {msg.file && <MessageFileBubble file={msg.file} isMe={isMe} />}
          {msg.voice && <VoiceBubble voice={msg.voice} isMe={isMe} />}
          {msg.text && (
            <div className="text-[14px] leading-[1.4]" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {msg.text}
            </div>
          )}
          <div
            className="mt-[4px] flex items-center justify-end gap-[4px] font-mono text-[10px]"
            style={{ color: isMe ? "rgba(255,255,255,0.6)" : "var(--foreground-30)" }}
          >
            <TimeAgo iso={msg.time} />
            {isMe && <StatusIcon status={msg.status} />}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
```

(Меню всегда в DOM — на desktop скрыто через `opacity-0 group-hover:opacity-100`
в самой кнопке `MessageActionsMenu`, на mobile `group-hover` не сработает от
touch, поэтому доступ идёт через long-press, вызывающий `menuRef.current.open()`
напрямую, минуя hover-класс. Позиционирование `-left-[48px]`/`-right-[48px]`
занимает место старой reply-стрелки (`-right-[36px]`), сдвинуто на 48px, т.к.
кнопка меню на 44px шире на mobile.)

- [ ] **Step 4: Добавить обработчики в `MessengerPage` + отфильтровать удалённые**

Найти функцию `sendVoice`/`handleAttachment` блок (после Task 2, перед
`return (`). Добавить:

```tsx
  const handleCopy = (m: Message) => {
    const text = m.text || (m.file ? m.file.name : m.image ? "[изображение]" : "[вложение]");
    navigator.clipboard.writeText(text).then(
      () => toast.success("Скопировано"),
      () => toast.error("Не удалось скопировать"),
    );
  };

  const handlePinMessage = (m: Message) => {
    if (!active) return;
    actions.pinMessage(active.id, m.id);
  };

  const handleDeleteMessage = (m: Message) => {
    if (!active) return;
    actions.deleteMessageForMe(active.id, m.id);
  };

  const handleReportMessage = () => {
    toast("Жалоба: будет доступно позже");
  };

  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
```

Найти рендер сообщений (строки 618-621):

```tsx
                  active.messages.map((m, i) => (
                    <MessageBubble key={m.id} msg={m} prev={active.messages[i - 1]} allMessages={active.messages} onReply={setReplyTo} />
                  ))
```

Заменить на:

```tsx
                  active.messages
                    .filter((m) => !m.deletedForMe)
                    .map((m, i, arr) => (
                      <MessageBubble
                        key={m.id}
                        msg={m}
                        prev={arr[i - 1]}
                        allMessages={active.messages}
                        onReply={setReplyTo}
                        onCopy={handleCopy}
                        onForward={setForwardMsg}
                        onPin={handlePinMessage}
                        onDelete={handleDeleteMessage}
                        onReport={handleReportMessage}
                      />
                    ))
```

(`forwardMsg` state подключается к `ForwardDialog` в Task 4.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок. (`forwardMsg`/`setForwardMsg` временно неиспользуемые до
Task 4 — TS не ругается на неиспользуемый setState-сеттер как таковой, но
если появится ошибка "declared but never used" для `forwardMsg` — это ожидаемо
исчезнет в Task 4, где `forwardMsg` подключается к JSX; при страхе ошибки на
этом шаге можно временно добавить `void forwardMsg;` — но это не должно
понадобиться, т.к. `noUnusedLocals` в tsconfig обычно не включён для JSX-стейта,
используемого в том же файле хотя бы один раз позже. Проверить это именно
здесь, командой ниже.)

- [ ] **Step 6: Manual verify**

Открыть чат, навести на сообщение — появляется three-dots. Кликнуть → меню
Ответить/Копировать/Переслать/Закрепить/Удалить у себя (только на своих)
/Пожаловаться (только на чужих). Проверить "Удалить у себя" — сообщение
исчезает из чата. Проверить "Копировать" — попадает в буфер (toast
"Скопировано").

- [ ] **Step 7: Commit**

```bash
git add src/components/messenger/MessageActionsMenu.tsx src/routes/messenger.tsx
git commit -m "feat(messenger): message actions menu (reply/copy/forward/pin/delete-own/report)"
```

---

### Task 4: ForwardDialog — пересылка сообщения

**Files:**
- Create: `src/components/messenger/ForwardDialog.tsx`
- Modify: `src/routes/messenger.tsx` (render `<ForwardDialog>` рядом с
  `<CreateChatDialog>`, ~строка 713)

**Interfaces:**
- Consumes: `selectors.dialogsList`, `userById` (existing), `actions.addMessage`
  (existing), `forwardMsg`/`setForwardMsg` state (Task 3).
- Produces: `ForwardDialog` component (`{ message: Message | null; onClose: () => void }`).

- [ ] **Step 1: Создать `src/components/messenger/ForwardDialog.tsx`**

```tsx
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Message } from "@/lib/mock";
import { userById } from "@/lib/mock";
import { useStore, selectors, actions } from "@/lib/store";

interface Props {
  message: Message | null;
  onClose: () => void;
}

export function ForwardDialog({ message, onClose }: Props) {
  const dialogs = useStore(selectors.dialogsList);
  const meId = useStore((s) => s.currentUserId);
  const ref = useRef<HTMLDivElement>(null);
  const open = Boolean(message);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const forwardTo = (targetDialogId: string) => {
    if (!message) return;
    const forwarded: Message = {
      ...message,
      id: `tmp${Date.now()}`,
      authorId: meId,
      time: new Date().toISOString(),
      status: "sent",
      replyTo: undefined,
      pinned: false,
      deletedForMe: false,
      forwardedFrom: message.authorId,
    };
    actions.addMessage(targetDialogId, forwarded);
    toast.success("Сообщение переслано");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[80]"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={onClose}
          />
          <motion.div
            key="dialog"
            ref={ref}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-[81] w-[min(400px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[16px] border"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            <div className="flex items-center gap-[8px] border-b px-[16px] py-[12px]" style={{ borderColor: "var(--border)" }}>
              <h3 className="flex-1 font-display text-[16px] font-bold" style={{ color: "var(--foreground)" }}>
                Переслать сообщение
              </h3>
              <button
                onClick={onClose}
                className="grid h-[32px] w-[32px] place-items-center rounded-full"
                style={{ color: "var(--foreground-50)" }}
                aria-label="Закрыть"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="max-h-[360px] overflow-y-auto py-[8px]">
              {dialogs.length === 0 ? (
                <li className="px-[20px] py-[24px] text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>
                  Нет диалогов
                </li>
              ) : (
                dialogs.map((d) => {
                  const u = userById(d.userId);
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => forwardTo(d.id)}
                        className="flex w-full items-center gap-[12px] px-[16px] py-[10px] text-left transition-colors hover:bg-[var(--background-surface)]"
                      >
                        <img src={u.avatar} alt="" className="h-[36px] w-[36px] rounded-full object-cover" />
                        <span className="truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                          {u.name}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Подключить в `src/routes/messenger.tsx`**

Добавить импорт после `import { CreateChatDialog } from "@/components/messenger/CreateChatDialog";`:

```ts
import { ForwardDialog } from "@/components/messenger/ForwardDialog";
```

Найти строку (текущая строка ~713):

```tsx
      <CreateChatDialog open={createOpen} onClose={() => setCreateOpen(false)} onPick={handleCreateChat} />
```

Добавить сразу после неё:

```tsx
      <ForwardDialog message={forwardMsg} onClose={() => setForwardMsg(null)} />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Manual verify**

В меню действий сообщения нажать "Переслать" → открывается список диалогов;
выбрать один → toast "Сообщение переслано", в выбранном чате появляется новое
сообщение с пометкой "Переслано от {имя}".

- [ ] **Step 5: Commit**

```bash
git add src/components/messenger/ForwardDialog.tsx src/routes/messenger.tsx
git commit -m "feat(messenger): forward message via dialog picker (demo, local addMessage)"
```

---

### Task 5: Закреплённое сообщение — sticky-полоска в чате

**Files:**
- Modify: `src/routes/messenger.tsx` (header/messages area ~611-622)

**Interfaces:**
- Consumes: `Message.pinned` (Task 1), `data-msg-id` attribute on bubble (Task 3),
  `actions.pinMessage` (Task 1).

- [ ] **Step 1: Найти закреплённое сообщение и добавить sticky-полоску**

Найти в `MessengerPage`, сразу после определения `const partner = ...` (строка
307), добавить:

```tsx
  const pinnedMessage = active?.messages.find((m) => m.pinned && !m.deletedForMe) ?? null;

  const scrollToMessage = (id: string) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
```

Найти блок `</header>` закрывающий тег шапки чата (строка 611) и следующий за
ним div с сообщениями (строка 614 `<div ref={scrollRef} ...>`). Вставить между
ними:

```tsx
              </header>

              {pinnedMessage && (
                <button
                  onClick={() => scrollToMessage(pinnedMessage.id)}
                  className="flex w-full items-center gap-[10px] border-b px-[20px] py-[8px] text-left"
                  style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
                >
                  <Pin size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  <div className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--foreground-70)" }}>
                    {pinnedMessage.text || (pinnedMessage.file ? pinnedMessage.file.name : "Вложение")}
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.pinMessage(active!.id, pinnedMessage.id);
                    }}
                    className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full"
                    style={{ color: "var(--foreground-50)" }}
                    aria-label="Открепить сообщение"
                  >
                    <X size={13} />
                  </span>
                </button>
              )}

              {/* Messages */}
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-[20px] py-[16px]">
```

(Существующая строка `{/* Messages */}` и `<div ref={scrollRef} ...>` уже есть
в файле на строках 613-614 — этот шаг заменяет их вместе с добавлением новой
полоски перед ними; не создавать вторую копию `<div ref={scrollRef}>`.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок. `Pin` уже импортирован в Task 3 Step 2.

- [ ] **Step 3: Manual verify**

Закрепить сообщение через меню действий → под шапкой появляется полоска с
превью; клик по ней скроллит к сообщению; клик по × снимает закрепление.
Закрепить другое сообщение — предыдущее автоматически откреплено (одно на
чат, проверяется логикой `PIN_MESSAGE` из Task 1).

- [ ] **Step 4: Commit**

```bash
git add src/routes/messenger.tsx
git commit -m "feat(messenger): sticky pinned-message banner with scroll-to and unpin"
```

---

### Task 6: Меню диалога — закрепить чат / очистить историю / пожаловаться

**Files:**
- Modify: `src/components/messenger/ChatHeaderActions.tsx`
- Modify: `src/routes/messenger.tsx` (вызов `<ChatHeaderActions>` ~строка 607)

**Interfaces:**
- Consumes: `actions.pinDialog`, `actions.clearHistory` (Task 1).
- Produces: `ChatHeaderActions` принимает новый обязательный проп `pinned: boolean`.

- [ ] **Step 1: Обновить импорты и Props в `ChatHeaderActions.tsx`**

Найти строку 4:

```ts
import { Phone, MoreHorizontal, Info, Search, Bell, BellOff, Archive, ArchiveRestore, Ban, ShieldOff, Users } from "lucide-react";
```

Заменить на:

```ts
import { Phone, MoreHorizontal, Info, Search, Bell, BellOff, Archive, ArchiveRestore, Ban, ShieldOff, Users, Pin, PinOff, Trash2, Flag } from "lucide-react";
```

Найти интерфейс `Props` (строки 11-16):

```ts
interface Props {
  partnerId: string;
  partnerName: string;
  dialogId?: string;
  onSearch?: () => void;
}
```

Заменить на:

```ts
interface Props {
  partnerId: string;
  partnerName: string;
  dialogId?: string;
  pinned?: boolean;
  onSearch?: () => void;
}
```

Найти сигнатуру функции (строка 18):

```ts
export function ChatHeaderActions({ partnerId, partnerName, dialogId, onSearch }: Props) {
```

Заменить на:

```ts
export function ChatHeaderActions({ partnerId, partnerName, dialogId, pinned, onSearch }: Props) {
```

- [ ] **Step 2: Добавить обработчики**

Найти функцию `toggleArchive` (строки 72-82), добавить сразу после её
закрывающей скобки:

```tsx
  const togglePin = () => {
    close();
    if (!dialogId) return;
    if (pinned) {
      actions.pinDialog(dialogId, false);
      toast.success("Чат откреплён");
    } else {
      actions.pinDialog(dialogId, true);
      toast.success("Чат закреплён", { description: "Теперь он вверху списка" });
    }
  };

  const clearHistory = () => {
    close();
    if (!dialogId) return;
    if (!window.confirm(`Очистить историю переписки с ${partnerName}? Это действие нельзя отменить.`)) return;
    actions.clearHistory(dialogId);
    toast.success("История очищена");
  };

  const reportUser = () => {
    close();
    toast("Жалоба: будет доступно позже");
  };
```

- [ ] **Step 3: Добавить пункты в dropdown**

Найти блок (строки 165-176):

```tsx
              <Item
                icon={meta.muted ? Bell : BellOff}
                label={meta.muted ? "Включить уведомления" : "Отключить уведомления"}
                onClick={toggleMute}
              />
              <Item
                icon={meta.archived ? ArchiveRestore : Archive}
                label={meta.archived ? "Вернуть из архива" : "Архивировать"}
                onClick={toggleArchive}
              />
              <div className="border-t" style={{ borderColor: "var(--border)" }} />
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
                icon={pinned ? PinOff : Pin}
                label={pinned ? "Открепить чат" : "Закрепить чат"}
                onClick={togglePin}
              />
              <Item
                icon={meta.muted ? Bell : BellOff}
                label={meta.muted ? "Включить уведомления" : "Отключить уведомления"}
                onClick={toggleMute}
              />
              <Item
                icon={meta.archived ? ArchiveRestore : Archive}
                label={meta.archived ? "Вернуть из архива" : "Архивировать"}
                onClick={toggleArchive}
              />
              <Item icon={Trash2} label="Очистить историю" onClick={clearHistory} />
              <div className="border-t" style={{ borderColor: "var(--border)" }} />
              <Item
                icon={meta.blocked ? ShieldOff : Ban}
                label={meta.blocked ? "Разблокировать" : "Заблокировать"}
                onClick={toggleBlock}
                danger={!meta.blocked}
              />
              <Item icon={Flag} label="Пожаловаться" onClick={reportUser} danger />
```

- [ ] **Step 4: Передать `pinned` из `messenger.tsx`**

Найти строку (текущая строка 607):

```tsx
                  <ChatHeaderActions partnerId={partner!.id} partnerName={partner!.name} dialogId={active.id} />
```

Заменить на:

```tsx
                  <ChatHeaderActions partnerId={partner!.id} partnerName={partner!.name} dialogId={active.id} pinned={Boolean(active.pinned)} />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 6: Manual verify**

Открыть меню диалога (три точки в шапке чата) → видно "Закрепить чат",
"Очистить историю" (с window.confirm), "Пожаловаться" внизу списка. Закрепить
чат — проверяется визуально в Task 7 (список диалогов).

- [ ] **Step 7: Commit**

```bash
git add src/components/messenger/ChatHeaderActions.tsx src/routes/messenger.tsx
git commit -m "feat(messenger): dialog menu gets pin chat / clear history / report"
```

---

### Task 7: Закреплённые чаты вверху списка + иконка

**Files:**
- Modify: `src/routes/messenger.tsx` (`filtered`/сортировка ~309-320, рендер
  строки диалога ~543-548)

**Interfaces:**
- Consumes: `Dialog.pinned` (Task 1), `Pin` иконка (импортирована в Task 3).

- [ ] **Step 1: Отсортировать список для вкладки «Активные»**

Найти `const filtered = useMemo(...)` (строки 309-320):

```tsx
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = dlgs.filter((d) => {
      const m = getMeta(d.id);
      return showArchived ? m.archived : !m.archived;
    });
    if (!q) return base;
    return base.filter((d) => {
      const u = userById(d.userId);
      return u.name.toLowerCase().includes(q) || d.lastMessage.toLowerCase().includes(q);
    });
  }, [dlgs, query, dialogMetaMap, showArchived]);
```

Заменить на:

```tsx
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = dlgs.filter((d) => {
      const m = getMeta(d.id);
      return showArchived ? m.archived : !m.archived;
    });
    const searched = !q
      ? base
      : base.filter((d) => {
          const u = userById(d.userId);
          return u.name.toLowerCase().includes(q) || d.lastMessage.toLowerCase().includes(q);
        });
    if (showArchived) return searched;
    return [...searched].sort((a, b) => {
      const pa = a.pinned ? 1 : 0;
      const pb = b.pinned ? 1 : 0;
      return pb - pa;
    });
  }, [dlgs, query, dialogMetaMap, showArchived]);
```

(`Array.prototype.sort` в V8 стабильна — порядок внутри групп pinned/не-pinned
сохраняется как в исходном `searched`.)

- [ ] **Step 2: Иконка закреплённого чата в списке**

Найти блок (строки 543-548):

```tsx
                            <span className="flex min-w-0 items-center gap-[6px] truncate font-display text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                              <span className="truncate">{u.name}</span>
                              {getMeta(d.id).muted && <BellOff size={12} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />}
                              {getMeta(d.id).blocked && <Ban size={12} style={{ color: "var(--error)", flexShrink: 0 }} />}
                              {getMeta(d.id).archived && <Archive size={12} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />}
                            </span>
```

Заменить на:

```tsx
                            <span className="flex min-w-0 items-center gap-[6px] truncate font-display text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                              {d.pinned && <Pin size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                              <span className="truncate">{u.name}</span>
                              {getMeta(d.id).muted && <BellOff size={12} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />}
                              {getMeta(d.id).blocked && <Ban size={12} style={{ color: "var(--error)", flexShrink: 0 }} />}
                              {getMeta(d.id).archived && <Archive size={12} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />}
                            </span>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Manual verify**

Закрепить чат через меню диалога → чат переезжает вверх списка "Активные", с
иконкой булавки перед именем. Открепить — возвращается на своё место по
времени.

- [ ] **Step 5: Commit**

```bash
git add src/routes/messenger.tsx
git commit -m "feat(messenger): pinned chats float to top of active dialog list with pin icon"
```

---

### Task 8: Чёрный список — раздел в `/profile`

**Files:**
- Create: `src/components/profile/BlockedUsersSection.tsx`
- Modify: `src/routes/profile.tsx` (imports ~1-7, `TabKey`/`TABS_BASE` ~96-104,
  render block ~427-430)

**Interfaces:**
- Consumes: `selectors.dialogsList`, `dialogMeta` store slice, `userById`,
  `actions.setDialogMeta` (all existing).
- Produces: `BlockedUsersSection` component (no props — reads store directly).

- [ ] **Step 1: Создать `src/components/profile/BlockedUsersSection.tsx`**

```tsx
import { Ban, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { userById } from "@/lib/mock";
import { useStore, selectors, actions } from "@/lib/store";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export function BlockedUsersSection() {
  const dialogMetaMap = useStore((s) => s.dialogMeta);
  const dialogs = useStore(selectors.dialogsList);

  const blocked = dialogs.filter((d) => dialogMetaMap[d.id]?.blocked);

  if (blocked.length === 0) {
    return <EmptyState icon={Ban} title="Никто не заблокирован" variant="compact" />;
  }

  return (
    <div className="flex flex-col gap-[8px]">
      {blocked.map((d) => {
        const u = userById(d.userId);
        return (
          <div
            key={d.id}
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
                actions.setDialogMeta(d.id, { blocked: false });
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

- [ ] **Step 2: Добавить вкладку в `src/routes/profile.tsx`**

Найти строку импорта иконок (строки 4-6):

```ts
import {
  Bell, BadgeCheck, FileText, MapPin, MessageSquare, Pencil, Tag, User as UserIcon,
  UserPlus, Users, X, Plus, Car, Plane, Ship, Send as SendIcon, Code2, Wrench, Cpu, BatteryCharging,
} from "lucide-react";
```

Заменить на:

```ts
import {
  Bell, BadgeCheck, Ban, FileText, MapPin, MessageSquare, Pencil, Tag, User as UserIcon,
  UserPlus, Users, X, Plus, Car, Plane, Ship, Send as SendIcon, Code2, Wrench, Cpu, BatteryCharging,
} from "lucide-react";
```

Добавить импорт после `import { InvitedFriendsSection } from "@/components/referral/InvitedFriendsSection";`:

```ts
import { BlockedUsersSection } from "@/components/profile/BlockedUsersSection";
```

Найти (строка 96):

```ts
type TabKey = "posts" | "ads" | "communities" | "invited" | "about";
```

Заменить на:

```ts
type TabKey = "posts" | "ads" | "communities" | "invited" | "blocked" | "about";
```

Найти `TABS_BASE` (строки 98-104):

```ts
const TABS_BASE: { key: TabKey; label: string; Icon: typeof FileText; ownOnly?: boolean }[] = [
  { key: "posts", label: "Публикации", Icon: FileText },
  { key: "ads", label: "Объявления", Icon: Tag },
  { key: "communities", label: "Сообщества", Icon: Users },
  { key: "invited", label: "Приглашённые", Icon: UserPlus, ownOnly: true },
  { key: "about", label: "О себе", Icon: UserIcon },
];
```

Заменить на:

```ts
const TABS_BASE: { key: TabKey; label: string; Icon: typeof FileText; ownOnly?: boolean }[] = [
  { key: "posts", label: "Публикации", Icon: FileText },
  { key: "ads", label: "Объявления", Icon: Tag },
  { key: "communities", label: "Сообщества", Icon: Users },
  { key: "invited", label: "Приглашённые", Icon: UserPlus, ownOnly: true },
  { key: "blocked", label: "Заблокированные", Icon: Ban, ownOnly: true },
  { key: "about", label: "О себе", Icon: UserIcon },
];
```

Найти рендер вкладки (строка 428-429):

```tsx
              {tab === "invited" && isOwn && <InvitedFriendsSection />}
```

Добавить сразу после неё:

```tsx
              {tab === "blocked" && isOwn && <BlockedUsersSection />}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Manual verify**

Открыть `/profile`, вкладка "Заблокированные" видна только у себя (не у чужих
профилей — `ownOnly: true`). Заблокировать кого-то из мессенджера → он
появляется в этом списке; нажать "Разблокировать" → пропадает из списка и
пользователю снова можно писать.

- [ ] **Step 5: Commit**

```bash
git add src/components/profile/BlockedUsersSection.tsx src/routes/profile.tsx
git commit -m "feat(profile): blocked users section (blacklist tab, unblock action)"
```

---

### Task 9: Mobile-размеры, backend-endpoints-needed.md, финальный QA

**Files:**
- Modify: `src/components/messenger/VoiceRecorder.tsx` (кнопка ~строка 197)
- Modify: `src/routes/messenger.tsx` (кнопка Send ~строка 695-702)
- Modify: `frontend/docs/backend-endpoints-needed.md`

**Interfaces:**
- Нет новых интерфейсов — финальная доводка размеров и документации.

- [ ] **Step 1: Увеличить кнопку Send до 44px на mobile**

Найти в `src/routes/messenger.tsx` (строки 694-702):

```tsx
                  {text.trim() ? (
                    <Button
                      size="icon"
                      onClick={send}
                      className="h-[42px] w-[42px] shrink-0 rounded-full transition-transform active:scale-95"
                      aria-label="Отправить"
                    >
                      <Send size={18} />
                    </Button>
                  ) : (
```

Заменить на:

```tsx
                  {text.trim() ? (
                    <Button
                      size="icon"
                      onClick={send}
                      className="h-[44px] w-[44px] shrink-0 rounded-full transition-transform active:scale-95 sm:h-[42px] sm:w-[42px]"
                      aria-label="Отправить"
                    >
                      <Send size={18} />
                    </Button>
                  ) : (
```

- [ ] **Step 2: Увеличить кнопку голосового сообщения до 44px на mobile**

Найти в `src/components/messenger/VoiceRecorder.tsx` (строка 197):

```tsx
        className="relative z-30 grid h-[42px] w-[42px] shrink-0 touch-none place-items-center rounded-full select-none"
```

Заменить на:

```tsx
        className="relative z-30 grid h-[44px] w-[44px] shrink-0 touch-none place-items-center rounded-full select-none sm:h-[42px] sm:w-[42px]"
```

- [ ] **Step 3: Уточнить `frontend/docs/backend-endpoints-needed.md`**

Найти запись №3 (удаление сообщения) — после строки
`**Demo/mock fallback:** локальное удаление из store.` добавить (в конец
записи №3, перед разделителем `---`):

```md
**Уточнение (2026-07-05):** UI предлагает только "удалить у себя"
(`deletedForMe` в `Message`, `lib/store.ts` → `deleteMessageForMe`). Опция
"удалить у обоих" сознательно не реализована и не показывается в UI — для неё
нет API.
```

Найти запись №5 (загрузка вложения) — после текущего Demo/mock fallback
добавить:

```md
**Уточнение (2026-07-05):** нужен единый endpoint для фото/видео/файла —
`type`/`kind` в response уже предусмотрен дизайном. Текущий demo-режим
(`AttachmentMenu`/`handleAttachment` в `messenger.tsx`) создаёт превью через
`URL.createObjectURL` без реальной загрузки; ограничение 20 МБ — client-side
demo guard, не серверная валидация.
```

В конец файла (после записи №8) добавить две новые записи:

```md

---

## 9. Закрепление сообщения в чате

**Задача:** Мессенджер — базовые функции (2026-07-05)
**Endpoint:** `POST /conversations/{conversationId}/messages/{messageId}/pin`
**Метод:** POST
**Response:** `{ "pinned": true }`
**Endpoint снятия:** `DELETE /conversations/{conversationId}/messages/{messageId}/pin`
**Статус:** `Needed` — в `chat.ts` нет функции pin/unpin сообщения (записи №4
покрывает только pin чата целиком, не сообщения).
**Demo/mock fallback:** `actions.pinMessage(dialogId, messageId)` в
`lib/store.ts` — одно закреплённое сообщение на диалог, хранится в поле
`Message.pinned`.

---

## 10. Пересылка сообщения (forward)

**Задача:** Мессенджер — базовые функции (2026-07-05)
**Endpoint:** предположительно обычный `POST /conversations/{targetId}/messages`
с доп. полем `forwarded_from_message_id` (или отдельный endpoint — уточнить у
бэкенд-команды при реализации).
**Статус:** `Needed` — в `chat.ts` нет функции пересылки.
**Demo/mock fallback:** `ForwardDialog` (`src/components/messenger/ForwardDialog.tsx`)
добавляет сообщение локально в выбранный диалог через `actions.addMessage`,
с полем `Message.forwardedFrom` = id автора оригинала. Реальной доставки
получателю нет — сообщение видно только у пересылающего локально.
```

- [ ] **Step 4: Финальный typecheck всего проекта**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Финальный grep-аудит на отсутствие "удалить у всех"**

Run: `grep -in "удалить у всех\|delete for everyone\|delete_for_all" src/routes/messenger.tsx src/components/messenger/*.tsx`
Expected: пусто (ни один UI-текст не предлагает удаление у обоих).

- [ ] **Step 6: Manual QA (preview_* MCP, сценарий из спеки)**

1. Открыть `/messenger` на desktop (`preview_resize` ширина ≥1280).
2. Ответить на сообщение (three-dots → Ответить) — reply-превью появляется
   над полем ввода, отправить ответ, превью исчезает.
3. Удалить своё сообщение (three-dots на своём сообщении → Удалить у себя) —
   сообщение исчезает.
4. Закрепить чат (шапка → три точки → Закрепить чат) — чат уезжает наверх
   списка "Активные" с иконкой булавки.
5. Заблокировать пользователя (шапка → три точки → Заблокировать) — попытка
   отправить сообщение показывает toast "Пользователь заблокирован".
6. Перейти в `/profile` → вкладка "Заблокированные" → пользователь виден в
   списке → нажать "Разблокировать" → пропадает из списка.
7. `preview_resize` на mobile-ширину (375px) — проверить: composer не
   перекрыт `BottomNav`, кнопки скрепки/быстрого фото/send ≥44px
   (`preview_inspect` на `getBoundingClientRect`), long-press на сообщении
   открывает bottom-sheet меню действий, не вылезающее за экран.

- [ ] **Step 7: Commit**

```bash
git add src/routes/messenger.tsx src/components/messenger/VoiceRecorder.tsx frontend/docs/backend-endpoints-needed.md
git commit -m "chore(messenger): mobile tap-target sizing, backend-endpoints-needed.md updates, final QA"
```

---

## После завершения плана

Использовать `superpowers:finishing-a-development-branch` — та же
последовательность, что в предыдущих фичах этой сессии: merge в `master`,
затем в `neeklo` (fetch первым, merge, не rebase — сохранить независимые
коммиты из других сессий), деплой на VPS через
`deploy/scripts/deploy-neeklo-frontend.sh`, обновить
`memory/project_neeklo_stand.md` новым HEAD.
