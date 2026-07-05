# Премиум-бэклог, раунд 1 (A + B) — Design Spec

## Контекст

Заказчик утвердил «сделать всё из бэклога, профессионально». Бэклог
декомпозирован (см. брейншторм): **A** — app-полировка (персист избранного +
бейджи в топ-баре), **B** — плашка объявления в шапке чата (demo + backend-doc).
**C** (полный i18n лендинга) — отдельный спек следующим прогоном. **D**
(реальная серверная загрузка) — чисто backend, только документация.

Этот спек покрывает **A + B**.

Найденные факты:
- `favoriteAdIds` (store, из прошлого раунда) сбрасывается на hard-reload —
  не персистится.
- В топ-баре (`DesktopTopBar`) есть сердечко → `/favorites` (без бейджа) и
  колокольчик уведомлений (с бейджем). Иконки «Сообщения» нет.
- Непрочитанные сообщения считаются в `BottomNav` как
  `Object.values(s.dialogs).reduce((n, d) => n + (d.unread ?? 0), 0)` —
  переиспользуем тот же расчёт.
- `createConversation(userId, meUuid)` не несёт ad-контекста; `Dialog` не
  хранит ссылку на объявление; шапка чата показывает только собеседника.

## Блок A1. Персист избранного в localStorage

**Файлы:** `src/lib/store.ts`.

- Константа `const FAVORITES_KEY = "modelizm:favorites";`.
- Хелпер чтения (guard SSR):
  ```ts
  function readPersistedFavorites(): ID[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(FAVORITES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x): x is ID => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  ```
- В `createInitialState()`: `favoriteAdIds: readPersistedFavorites()` (вместо `[]`).
- После определения `subscribe`/`emit` (там, где стор уже эмитит на dispatch)
  — добавить persist-подписчик, который пишет только `favoriteAdIds` при
  изменении:
  ```ts
  let lastPersistedFavorites: ID[] = state.favoriteAdIds;
  subscribe(() => {
    if (typeof window === "undefined") return;
    if (state.favoriteAdIds === lastPersistedFavorites) return;
    lastPersistedFavorites = state.favoriteAdIds;
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favoriteAdIds));
    } catch { /* quota/full — игнор */ }
  });
  ```
  (`subscribe` уже существует в store — переиспользуем его же механизм.
  Сравнение по ссылке дёшево: reducer возвращает новый массив только при
  реальном изменении `favoriteAdIds`.)

Сохранённые посты ленты — вне scope (ре-фетчатся из API; session-only,
персист требует backend-bookmark).

## Блок A2. Бейджи-счётчики в топ-баре

**Файлы:** `src/components/layout/DesktopTopBar.tsx`.

Общий стиль бейджа — как у существующего бейджа уведомлений (маленький
accent-кружок в правом-верхнем углу иконки, `9+` при >9).

### Сердечко — бейдж количества избранного
- `const favCount = useStore((s) => s.favoriteAdIds.length);`
- На `<Link>` сердечка (сделать `relative`) — добавить бейдж, если
  `favCount > 0`, с тем же оформлением, что у колокольчика.

### Новая иконка «Сообщения»
- Импорт `MessageSquare` из lucide.
- `const unreadMessages = useStore((s) => Object.values(s.dialogs).reduce((n, d) => n + (d.unread ?? 0), 0));`
- Новый `<Link to={ROUTES.messenger}>` (иконка `MessageSquare`, h-10 w-10,
  `hover:bg`, `aria-label="Сообщения"`) с бейджем `unreadMessages` (>0), тем
  же стилем.
- Итоговый порядок правых контролов: `LanguageSwitcher` · Сердечко ·
  Уведомления · Сообщения · `UserMenu`.

## Блок B. Плашка объявления в шапке чата (demo)

**Файлы:** `src/lib/store.ts` (слайс + action), `src/lib/mock.ts` (тип
`DialogAdRef`), `src/routes/ads.$id.tsx` (проброс при «Написать»),
`src/routes/messenger.tsx` (рендер плашки), `frontend/docs/backend-endpoints-needed.md`.

### Тип (`src/lib/mock.ts`)
```ts
export interface DialogAdRef {
  id: ID;
  title: string;
  price: number;
  image?: string;
}
```

### Store (`src/lib/store.ts`)
- `AppState.dialogAdRefs: Record<ID, DialogAdRef>` (инициализация `{}` в
  `createInitialState`). Session-only — НЕ персистится.
- Action `setDialogAd(dialogId: ID, ref: DialogAdRef)` + reducer-кейс
  `SET_DIALOG_AD` (мёрджит в `dialogAdRefs[dialogId]`).
- Selector не нужен — читаем `useStore((s) => s.dialogAdRefs[activeId])`
  прямо в компоненте.

### Проброс при «Написать» (`src/routes/ads.$id.tsx`)
В `writeToSeller`, после успешного `createConversation`:
```ts
const dialog = await createConversation(sellerId, me.id);
actions.setDialogAd(dialog.id, {
  id: ad.id,
  title: ad.title,
  price: ad.price,
  image: ad.gallery?.[0] ?? ad.image,
});
navigate({ to: "/messenger", search: { chat: dialog.id } });
```
(`actions` уже импортирован в `ads.$id.tsx` — из прошлого раунда.)

### Рендер плашки (`src/routes/messenger.tsx`)
- В `MessengerPage`: `const dialogAdRefs = useStore((s) => s.dialogAdRefs);`
  и `const activeAdRef = activeId ? dialogAdRefs[activeId] : undefined;`
- В шапке чата (`<header>` с `partner`), сразу ПОД строкой имени/статуса
  собеседника — условная плашка, если `activeAdRef`:
  - `<Link to="/ads/$id" params={{ id: activeAdRef.id }}>` — компактная строка:
    миниатюра (`activeAdRef.image`, 36×36, rounded, object-cover; если нет —
    плейсхолдер-блок цвета `background-surface`), заголовок (truncate, 13px) +
    цена (`{price.toLocaleString("ru")} ₽`, 12px accent). Ховер — лёгкий фон.
  - Плашка не ломает существующую высоту/скролл: рендерится в потоке шапки
    (шапка станет чуть выше при наличии плашки) — приемлемо, чат сам скроллит
    ниже.

### Backend-doc
Обновить запись №11 (диалог, привязанный к объявлению): отметить, что
frontend-demo реализован (`dialogAdRefs` session-only), реальный персист по-
прежнему требует `conversation.listing_id` на бэке.

## Что НЕ делается (scope)

- Полный i18n лендинга (C) — отдельный спек следующим прогоном.
- Реальная серверная загрузка файлов/аватара (D) — только backend-doc.
- Персист сохранённых постов ленты — session-only (нужен backend-bookmark).
- Персист `dialogAdRefs` — session-only (backend #11).
- Backend не трогаем.

## Acceptance criteria

- Избранное объявление переживает hard-reload страницы (localStorage).
- В топ-баре: сердечко с числом избранного (>0), иконка «Сообщения» с числом
  непрочитанных (>0), обе ведут на `/favorites` и `/messenger`.
- «Написать» с карточки объявления открывает чат, в шапке которого — плашка
  этого объявления (миниатюра+заголовок+цена), клик по ней → `/ads/$id`.
- `npx tsc --noEmit` чист.

## Manual QA

Desktop 1440 + mobile 390: (1) добавить в избранное → F5 → всё ещё в
избранном; (2) топ-бар показывает число избранного и непрочитанных; (3)
«Написать» с объявления → в шапке чата плашка объявления → клик открывает
объявление.
