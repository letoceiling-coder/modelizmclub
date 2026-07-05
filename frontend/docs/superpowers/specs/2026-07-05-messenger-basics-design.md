# Мессенджер: базовые ожидаемые функции — Design Spec

## Контекст

Мессенджер (`src/routes/messenger.tsx`) уже умеет: список диалогов с вкладками
(Активные/Каналы/Архив/Звонки), отправку текста/голоса, reply (стрелка на
hover), realtime через Echo/hub, mute/archive/block через `ChatHeaderActions`.
Скрепка в composer — декоративная кнопка без обработчика. Нет: attachment-меню,
действий с сообщением (кроме reply), pin чата/сообщения, раздела blacklist.

Backend chat/socket-инфраструктуру не трогаем. Всё, для чего нет API —
реализуется как demo/local state поверх существующего `store.ts`, с фиксацией
недостающих endpoint'ов в `docs/backend-endpoints-needed.md` (там уже есть
черновые записи №2 block, №3 delete message, №4 pin conversation, №5 file
upload из прошлого аудита — их нужно уточнить/расширить, не дублировать).

## 1. Расширение типов данных

**`src/lib/mock.ts`**

```ts
export interface MessageFile {
  name: string;
  size: number; // bytes
  kind: "image" | "video" | "file";
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
  forwardedFrom?: ID; // original authorId, shown as "Переслано от {name}"
}

export interface Dialog {
  id: ID;
  userId: ID;
  lastMessage: string;
  time: string;
  unread?: number;
  messages: Message[];
  pinned?: boolean; // chat-level pin (list ordering)
}
```

`file` — вложение видео/документа (не фото — фото продолжает использовать
существующее поле `image`, чтобы не трогать уже работающий рендер
`MessageImage`). `pinned` на `Message` — ровно одно закреплённое сообщение на
чат (при закреплении нового — снимается флаг со старого, на фронте). `pinned`
на `Dialog` — закрепление чата в списке диалогов (независимо от pin сообщения).

**`src/lib/store.ts`** — новые actions:

```ts
pinMessage: (dialogId: ID, messageId: ID) => void; // снимает pinned с остальных сообщений этого диалога, ставит на messageId (toggle: если уже pinned — снимает)
deleteMessageForMe: (dialogId: ID, messageId: ID) => void; // ставит deletedForMe: true
pinDialog: (dialogId: ID, pinned: boolean) => void;
clearHistory: (dialogId: ID) => void; // messages = []
```

Реализуются как новые `dispatch({ type: "..." })` case'ы в существующем
reducer, по образцу `SET_DIALOG_META`. `deletedForMe` messages фильтруются из
рендера в `MessengerPage` (`active.messages.filter(m => !m.deletedForMe)`),
не удаляются из store — так проще откатить в будущем при реальном API.

## 2. Attachment-меню + быстрая кнопка-фото

Composer row меняется с одной кнопки-скрепки на:

```
[Скрепка → popover: Фото / Видео / Файл] [Быстрое фото] [textarea] [Send/Voice]
```

- **Скрепка** — клик открывает маленький popover (тот же паттерн, что
  `ChatHeaderActions`/`PostActionMenu`: `useRef` + click-outside + Escape) с
  тремя пунктами: Фото, Видео, Файл. Каждый пункт триггерит скрытый
  `<input type="file" accept="...">` с нужным `accept` (`image/*`, `video/*`,
  `*`).
- **Быстрая кнопка-фото** — отдельная иконка (`ImagePlus` из lucide-react),
  сразу открывает `input[type=file][accept=image/*]`, без промежуточного меню.
  Слева от текстового поля, рядом со скрепкой (после неё).
- **Demo upload:** нет `POST /conversations/{id}/attachments` в проде →
  `URL.createObjectURL(file)` для preview, локальное сообщение:
  - Фото → `optimistic.image = blobUrl` (существующий рендер).
  - Видео/Файл → `optimistic.file = { name, size, kind, url: blobUrl }`.
  Новый компонент `MessageFileBubble` рендерит video/file: для `video` —
  `<video controls>` ограниченного размера; для `file` — карточка с иконкой
  (по `kind`), именем, размером (`(size/1024).toFixed(0)} КБ`), кликабельная
  (`<a download>` на blob URL).
- Ограничение размера (demo, client-side): >20 МБ → `toast.error` без отправки
  (защита от зависания на blob URL огромного файла в demo).

## 3. Действия с сообщением

Убирается текущая reply-стрелка на hover, заменяется универсальной
three-dots кнопкой (`MoreHorizontal`, тот же визуальный слот — справа от
пузыря чужого сообщения, слева от пузыря своего). Клик открывает dropdown
(тот же паттерн meню, что `ChatHeaderActions`):

| Пункт | Действие | Условие показа |
|---|---|---|
| Ответить | `onReply(msg)` — как сейчас | всегда |
| Копировать | `navigator.clipboard.writeText(msg.text \|\| "[вложение]")` | всегда |
| Переслать | открывает `ForwardDialog` (см. ниже) | всегда |
| Закрепить / Открепить | `actions.pinMessage(dialogId, msg.id)` | всегда |
| Удалить у меня | `actions.deleteMessageForMe(dialogId, msg.id)`, danger-стиль | только `isMe` (свои сообщения) |
| Пожаловаться | `toast("Жалоба: будет доступно позже")` (как в `PostActionMenu`) | только чужие (`!isMe`) |

**Desktop:** three-dots появляется при hover на пузырь (`group-hover:opacity-100`,
как сейчас у reply-стрелки).
**Mobile:** long-press на пузырь (300мс `onTouchStart`/`onTouchEnd`/`onTouchMove`-cancel)
открывает то же меню как bottom sheet (используется тот же dropdown-компонент,
но с мобильным позиционированием — `fixed bottom-0 inset-x-0` на `<640px` через
media-query в компоненте, или простая проверка `window.innerWidth`).

**ForwardDialog** — новый компонент `src/components/messenger/ForwardDialog.tsx`,
переиспользует список диалогов (простой список: аватар + имя + последнее
сообщение, без вкладок/поиска — YAGNI, это не полноценный `CreateChatDialog`).
Выбор диалога → `actions.addMessage(targetDialogId, { ...msg, id: newId,
authorId: meId, time: now, forwardedFrom: msg.authorId })` → toast success.
Реального forward API нет → фиксируется в backend-endpoints-needed.md.

## 4. Закреплённое сообщение — sticky-полоска

Под шапкой чата (между `<header>` и списком сообщений) — условный блок, если
`active.messages.some(m => m.pinned)`:

```
📌 [превью текста/типа вложения закреплённого сообщения]  ✕
```

Клик по тексту — `scrollRef.current.querySelector('[data-msg-id=...]')?.scrollIntoView()`.
✕ — снимает pin (`actions.pinMessage` toggle). Каждый `MessageBubble` получает
`data-msg-id={msg.id}` для скролла.

## 5. Меню диалога — добавить 2 пункта

`ChatHeaderActions.tsx` — в существующий dropdown между Archive и разделителем
блокировки добавляются:

- **Закрепить чат / Открепить чат** — `actions.pinDialog(dialogId, !meta_dialog.pinned)`.
  Читает `pinned` не из `dialogMeta` (там его нет), а напрямую из `Dialog`
  через `selectors.dialogsList` — компоненту передаётся доп. проп `pinned:
  boolean` и `dialogId` уже есть.
- **Очистить историю** — с подтверждением через `window.confirm` (простой
  guard от случайного клика, без отдельного модального компонента — YAGNI для
  demo) → `actions.clearHistory(dialogId)`.
- **Пожаловаться** — `toast("Жалоба: будет доступно позже")`, в самый низ меню
  (danger-стиль, как блокировка).

## 6. Закреплённые чаты в списке диалогов

В `MessengerPage`, сортировка `filtered` списка (только для вкладки
"Активные", не для архива/каналов/звонков):

```ts
const sorted = [...filtered].sort((a, b) => {
  const pa = a.pinned ? 1 : 0, pb = b.pinned ? 1 : 0;
  if (pa !== pb) return pb - pa;
  return 0; // сохраняет исходный (по времени) порядок внутри групп
});
```

Иконка `Pin` (lucide) рядом с существующими `BellOff`/`Ban`/`Archive` в имени
диалога — тот же визуальный паттерн, тот же размер/цвет.

## 7. Чёрный список — раздел в `/profile`

Новая секция на странице профиля (`src/routes/profile.tsx`) — блок
"Заблокированные" (по аналогии с существующими секциями профиля, стиль карточек
уже используемый в файле). Список: `useStore(s => s.dialogMeta)` →
`Object.entries` → фильтр `blocked === true` → для каждого dialogId ищем
`Dialog` в `selectors.dialogsList` → `userById(dlg.userId)`. Строка: аватар,
имя, кнопка "Разблокировать" (`actions.setDialogMeta(dialogId, { blocked:
false })`, тот же вызов, что и в `ChatHeaderActions.toggleBlock`). Пусто —
`EmptyState` ("Никто не заблокирован"). Доступ к разблокированному собеседнику
для написания восстанавливается автоматически — `send()`/`sendVoice()` уже
проверяют `getMeta(active.id).blocked` перед отправкой.

## 8. Mobile

- Быстрая кнопка-фото и скрепка — `h-[36px] w-[36px]` на десктопе (текущий
  паттерн composer-кнопок), но на `<640px` — `h-[44px] w-[44px]` через
  `sm:h-[36px] sm:w-[36px]` (mobile-first: 44 по умолчанию, 36 от sm и выше).
  Тот же паттерн применяется к three-dots кнопке действий сообщения и кнопке
  Send.
- Composer уже учитывает `env(safe-area-inset-bottom)` и не перекрыт
  `BottomNav` (мессенджер — полноэкранная страница с собственной высотой
  `calc(100dvh - ...)`, `BottomNav` — отдельный fixed-элемент шелла поверх;
  проверить вручную через `preview_resize` на мобильной ширине — возможный
  z-index конфликт между composer и BottomNav, если такой обнаружится —
  зафиксировать в задаче как отдельный микро-фикс, не расширять scope заранее).
- Action-меню сообщения на mobile — bottom sheet (`fixed inset-x-0 bottom-0`),
  не должно вылезать за экран по высоте (`max-h-[70dvh] overflow-y-auto` при
  необходимости — но 6 пунктов меню умещаются без скролла).

## Backend-endpoints-needed.md — обновления

Существующие записи №2 (блокировка), №3 (удаление сообщения), №4 (pin
conversation), №5 (upload вложения) уточняются:
- №3 переименовать в контекст "удаление у себя" явно (уже так и есть в
  Demo-fallback, дублировать не нужно — только явно пометить, что "у обоих" не
  реализуется вообще, ни в UI, ни как заготовка).
- №5 расширить: сейчас описан только generic upload — добавить, что нужен
  единый endpoint для фото/видео/файла (`type` в response уже предусмотрен).
- Новая запись: **Pin message** — `POST /conversations/{id}/messages/{messageId}/pin`,
  нужен для реального закрепления сообщения (сейчас только чат целиком в №4).
- Новая запись: **Forward message** — `POST /conversations/{targetId}/messages`
  с телом пересылаемого сообщения + `forwarded_from_message_id` (или
  переиспользовать обычный send message endpoint с доп. полем — уточнить у
  бэкенд-команды).

## Что не делается (YAGNI)

- Delete "у всех" — нет API, не выдаётся в UI вообще (ни как disabled-пункт).
- Множественное закрепление сообщений — одно на чат, как в дизайне Telegram
  для обычных (не premium) чатов.
- Поиск/фильтр в ForwardDialog — простой список, без вкладок.
- Реальная загрузка файлов на сервер — только demo blob-preview.
- Настройки уведомлений/языка на уровне blacklist-раздела — не запрошено.
