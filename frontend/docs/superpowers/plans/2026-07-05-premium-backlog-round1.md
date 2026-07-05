# Премиум-бэклог, раунд 1 (A + B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Персист избранного в localStorage, бейджи-счётчики в топ-баре (избранное + сообщения) и плашка объявления в шапке чата (demo).

**Architecture:** Расширяем существующий module-level store (`favoriteAdIds` персист через subscribe-подписчик; новый session-only слайс `dialogAdRefs` с action `setDialogAd`). Топ-бар читает счётчики через `useStore`. Плашка прокидывается из `ads.$id.tsx` при «Написать» и рендерится в шапке `messenger.tsx`.

**Tech Stack:** React 18, TypeScript strict, TanStack Router, Tailwind v4, lucide-react, module-level store (`useSyncExternalStore`).

## Global Constraints

- Работать строго в `frontend/`; backend НЕ трогать — недостающие API документировать в `frontend/docs/backend-endpoints-needed.md`.
- `npx tsc --noEmit` должен быть чист после каждой задачи.
- Ветка `feature/premium-backlog` (уже создана). Деплой на `neeklo` → `neeklo.modelizmclub.ru`.
- Стиль бейджа — как у существующего бейджа уведомлений в `DesktopTopBar` (accent-кружок, `9+` при >9).
- `dialogAdRefs` — session-only, НЕ персистится. `favoriteAdIds` — персистится в `localStorage` ключ `modelizm:favorites`.

---

### Task 1: Персист избранного в localStorage

**Files:**
- Modify: `frontend/src/lib/store.ts`

**Interfaces:**
- Consumes: существующий `favoriteAdIds: ID[]` слайс, `createInitialState()`, `subscribe`, module-level `state`.
- Produces: `favoriteAdIds` теперь читается из `localStorage` при инициализации и пишется при изменении.

- [ ] **Step 1: Добавить константу и хелпер чтения**

В `src/lib/store.ts`, перед `export function createInitialState()`:

```ts
const FAVORITES_KEY = "modelizm:favorites";

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

- [ ] **Step 2: Инициализировать из localStorage**

В `createInitialState()` заменить `favoriteAdIds: [],` на:

```ts
    favoriteAdIds: readPersistedFavorites(),
```

- [ ] **Step 3: Добавить persist-подписчик**

После определения `subscribe`/`emit` (и после `let state = createInitialState();`), добавить:

```ts
let lastPersistedFavorites: ID[] = state.favoriteAdIds;
subscribe(() => {
  if (typeof window === "undefined") return;
  if (state.favoriteAdIds === lastPersistedFavorites) return;
  lastPersistedFavorites = state.favoriteAdIds;
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favoriteAdIds));
  } catch {
    /* quota/full — игнор */
  }
});
```

- [ ] **Step 4: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/store.ts
git commit -m "feat(store): persist favoriteAdIds to localStorage"
```

---

### Task 2: Слайс dialogAdRefs + action setDialogAd

**Files:**
- Modify: `frontend/src/lib/mock.ts` (тип `DialogAdRef`)
- Modify: `frontend/src/lib/store.ts` (слайс, action, reducer-кейс)

**Interfaces:**
- Produces: `DialogAdRef { id: ID; title: string; price: number; image?: string }`; `AppState.dialogAdRefs: Record<ID, DialogAdRef>`; `actions.setDialogAd(dialogId: ID, ref: DialogAdRef): void`.

- [ ] **Step 1: Добавить тип в mock.ts**

В `src/lib/mock.ts`, рядом с интерфейсом `Dialog`:

```ts
export interface DialogAdRef {
  id: ID;
  title: string;
  price: number;
  image?: string;
}
```

- [ ] **Step 2: Импортировать тип и добавить поле в AppState**

В `src/lib/store.ts` добавить `DialogAdRef` в импорт типов из `./mock`. В интерфейсе `AppState` добавить поле:

```ts
  dialogAdRefs: Record<ID, DialogAdRef>;
```

В `createInitialState()` добавить:

```ts
    dialogAdRefs: {},
```

- [ ] **Step 3: Добавить action-тип и reducer-кейс**

В union `type Action` добавить:

```ts
  | { type: "SET_DIALOG_AD"; dialogId: ID; ref: DialogAdRef }
```

В reducer добавить кейс:

```ts
    case "SET_DIALOG_AD":
      return { ...s, dialogAdRefs: { ...s.dialogAdRefs, [a.dialogId]: a.ref } };
```

(имя переменной state/action — как в соседних кейсах: `s`, `a`.)

- [ ] **Step 4: Добавить в actions объект**

В объекте `actions`:

```ts
  setDialogAd(dialogId: ID, ref: DialogAdRef): void {
    dispatch({ type: "SET_DIALOG_AD", dialogId, ref });
  },
```

- [ ] **Step 5: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/mock.ts frontend/src/lib/store.ts
git commit -m "feat(store): add session-only dialogAdRefs slice + setDialogAd action"
```

---

### Task 3: Бейджи-счётчики в топ-баре

**Files:**
- Modify: `frontend/src/components/layout/DesktopTopBar.tsx`

**Interfaces:**
- Consumes: `useStore`, `s.favoriteAdIds`, `s.dialogs`, `ROUTES.favorites`, `ROUTES.messenger`.

- [ ] **Step 1: Импорт иконки и счётчиков**

Добавить `MessageSquare` в импорт из `lucide-react`. В компоненте топ-бара, рядом с `unread` (счётчик уведомлений):

```ts
  const favCount = useStore((s) => s.favoriteAdIds.length);
  const unreadMessages = useStore((s) =>
    Object.values(s.dialogs).reduce((n, d) => n + (d.unread ?? 0), 0),
  );
```

- [ ] **Step 2: Бейдж на сердечке**

Сделать `<Link>` сердечка `relative` (добавить в className) и добавить бейдж перед закрывающим тегом, тем же стилем, что у колокольчика:

```tsx
          <Heart size={20} />
          {favCount > 0 && (
            <span
              className="absolute right-[6px] top-[5px] grid min-w-[15px] place-items-center rounded-full px-[3px]"
              style={{
                height: 15,
                fontSize: 9,
                fontWeight: 700,
                color: "#fff",
                background: "var(--accent)",
                boxShadow: "0 0 0 2px var(--background)",
              }}
            >
              {favCount > 9 ? "9+" : favCount}
            </span>
          )}
```

Соответственно у `<Link>` сердечка className должен содержать `relative` (сейчас `grid h-10 w-10 place-items-center ...` — добавить `relative`).

- [ ] **Step 3: Новая иконка «Сообщения»**

Между колокольчиком и `<UserMenu />` добавить:

```tsx
        <Link
          to={ROUTES.messenger}
          aria-label="Сообщения"
          className="relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-70)" }}
        >
          <MessageSquare size={20} />
          {unreadMessages > 0 && (
            <span
              className="absolute right-[6px] top-[5px] grid min-w-[15px] place-items-center rounded-full px-[3px]"
              style={{
                height: 15,
                fontSize: 9,
                fontWeight: 700,
                color: "#fff",
                background: "var(--accent)",
                boxShadow: "0 0 0 2px var(--background)",
              }}
            >
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </Link>
```

Итоговый порядок: `LanguageSwitcher` · Сердечко · Уведомления · Сообщения · `UserMenu`.

- [ ] **Step 4: Проверить `ROUTES.messenger` существует**

Run: `cd frontend && grep -n "messenger" src/lib/routes.ts`
Expected: строка с `messenger:`. Если ключ называется иначе — использовать существующий (напр. `ROUTES.messages`).

- [ ] **Step 5: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/DesktopTopBar.tsx
git commit -m "feat(topbar): favorites-count + messages unread badges"
```

---

### Task 4: Проброс объявления при «Написать»

**Files:**
- Modify: `frontend/src/routes/ads.$id.tsx:87`

**Interfaces:**
- Consumes: `actions.setDialogAd` (Task 2), `ad.id/title/price/gallery/image`.

- [ ] **Step 1: Убедиться, что `actions` импортирован**

Run: `cd frontend && grep -n "actions" src/routes/ads.\$id.tsx | head -3`
Expected: `actions` в импорте из `@/lib/store`. Если нет — добавить в импорт.

- [ ] **Step 2: Прокинуть ad-контекст после createConversation**

В `writeToSeller`, заменить:

```ts
      const dialog = await createConversation(sellerId, me.id);
      navigate({ to: "/messenger", search: { chat: dialog.id } });
```

на:

```ts
      const dialog = await createConversation(sellerId, me.id);
      if (ad) {
        actions.setDialogAd(dialog.id, {
          id: ad.id,
          title: ad.title,
          price: ad.price,
          image: ad.gallery?.[0] ?? ad.image,
        });
      }
      navigate({ to: "/messenger", search: { chat: dialog.id } });
```

- [ ] **Step 3: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/ads.\$id.tsx
git commit -m "feat(ads): pass ad context to dialog on write-to-seller"
```

---

### Task 5: Плашка объявления в шапке чата

**Files:**
- Modify: `frontend/src/routes/messenger.tsx` (шапка чата, ~line 740)

**Interfaces:**
- Consumes: `s.dialogAdRefs` (Task 2), `activeId`, `Link`.

- [ ] **Step 1: Прочитать активную плашку**

В `MessengerPage`, рядом с другими `useStore` (около line 246), добавить:

```ts
  const dialogAdRefs = useStore((s) => s.dialogAdRefs);
```

И после определения `activeId` (около line 351):

```ts
  const activeAdRef = activeId ? dialogAdRefs[activeId] : undefined;
```

- [ ] **Step 2: Обернуть шапку и добавить плашку**

Шапка сейчас — единый `<header>` с partner-строкой и `ml-auto`-контролами. Плашка должна идти ПОД строкой имени. Проще всего: обернуть существующий `<header>` во внешний контейнер-колонку и добавить плашку строкой ниже.

Заменить открывающий `<header ...>` на контейнер, оставив внутренний ряд без изменений. Конкретно — обернуть блок шапки:

```tsx
              <div className="sticky top-0 z-10 flex flex-col" style={{ background: "var(--background)", borderBottom: "1px solid var(--border)" }}>
                <header className="flex items-center gap-[12px] px-[20px]" style={{ height: 60 }}>
                  {/* ...существующее содержимое header без изменений (кнопка Назад, Link partner, ml-auto контролы)... */}
                </header>
                {activeAdRef && (
                  <Link
                    to="/ads/$id"
                    params={{ id: activeAdRef.id }}
                    className="flex items-center gap-[10px] px-[20px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    {activeAdRef.image ? (
                      <img
                        src={activeAdRef.image}
                        alt=""
                        className="h-[36px] w-[36px] shrink-0 rounded-[8px] object-cover"
                      />
                    ) : (
                      <div className="h-[36px] w-[36px] shrink-0 rounded-[8px]" style={{ background: "var(--background-surface)" }} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px]" style={{ color: "var(--foreground)" }}>{activeAdRef.title}</div>
                      <div className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                        {activeAdRef.price.toLocaleString("ru")} ₽
                      </div>
                    </div>
                  </Link>
                )}
              </div>
```

Важно: убрать `background`/`borderBottom`/`sticky top-0 z-10` из внутреннего `<header>` (они переехали на внешний контейнер), оставив `flex items-center gap-[12px] px-[20px]` и `height: 60`.

- [ ] **Step 3: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/messenger.tsx
git commit -m "feat(messenger): ad plaque in chat header from dialogAdRefs"
```

---

### Task 6: Обновить backend-doc

**Files:**
- Modify: `frontend/docs/backend-endpoints-needed.md` (запись №11)

- [ ] **Step 1: Отметить frontend-demo для записи №11**

Найти запись про диалог, привязанный к объявлению (№11). Добавить пометку:

> **Статус (frontend):** demo реализован — `dialogAdRefs` (session-only store-слайс), плашка в шапке чата прокидывается при «Написать» с карточки. Реальный персист по-прежнему требует `conversation.listing_id` на бэке (после hard-reload/повторного входа привязка теряется).

Если записи №11 нет — добавить новую запись с этим текстом.

- [ ] **Step 2: Commit**

```bash
git add frontend/docs/backend-endpoints-needed.md
git commit -m "docs(backend): mark dialog↔listing #11 frontend-demo done"
```

---

## Self-Review

- **Spec coverage:** A1 → Task 1; A2 → Task 3; B (тип) → Task 2, (проброс) → Task 4, (рендер) → Task 5, (backend-doc) → Task 6. ✅
- **Placeholder scan:** нет TBD/TODO; весь код приведён. ✅
- **Type consistency:** `DialogAdRef`/`setDialogAd`/`dialogAdRefs`/`SET_DIALOG_AD` согласованы между Task 2, 4, 5. `favCount`/`unreadMessages` локальны в Task 3. ✅

## Manual QA (после деплоя)

Desktop 1440 + mobile 390: (1) добавить в избранное → F5 → всё ещё в избранном; (2) топ-бар показывает число избранного и непрочитанных; (3) «Написать» с объявления → в шапке чата плашка объявления → клик открывает объявление.
