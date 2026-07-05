# Премиум-доводка (раунд) — Design Spec

## Контекст

Финальная демо-версия на моковых данных (`neeklo.modelizmclub.ru`). Заказчик
указал на несколько «недотягивающих до премиума» мест. Этот раунд закрывает
4 блока, все чисто frontend (backend не пишем; недостающие эндпоинты —
фиксируем в `backend-endpoints-needed.md`).

Найденные факты (при разведке):
- Избранное для объявлений **не работает**: и `CatalogCard`, и
  `AdActionPanel` держат сердечко в локальном `useState(false)` — клик никуда
  не ведёт, страницы избранного нет, в топ-баре сердечка нет.
- Смена фото профиля **отсутствует**: `ProfileAvatar` только отображает,
  `EditSheet` правит имя/город/био/интересы, но не фото. `uploadMedia(file,
  "avatar")` уже существует (`lib/api/media.ts`), в demo возвращает blob-URL.
- Меню действий чата (right-click / long-press, добавлено ранее) не имеет
  видимой кнопки-подсказки — не обнаруживается.
- Топ-бар поиск декоративный («presentational — no submit logic»).

## Блок 1. Три точки на каждом чате (мессенджер)

**Файлы:** `src/routes/messenger.tsx`, переиспользование
`src/components/messenger/DialogContextMenu.tsx` (уже существует).

На каждой строке диалога (вкладка «Активные») — кнопка «три точки»
(`MoreHorizontal`) справа, после бейджа непрочитанного:
- **Desktop:** `opacity-0 group-hover:opacity-100` — появляется при наведении
  на строку (строка получает класс `group`).
- **Mobile:** всегда видима (`sm:opacity-0 sm:group-hover:opacity-100` —
  базово visible, скрывается только от `sm` вверх на hover).
- Клик по кнопке: `e.stopPropagation()` (чтобы не сработал `handleSelect` —
  открытие чата) + открывает `DialogContextMenu` в точке, вычисленной из
  `getBoundingClientRect()` кнопки (`{ x: rect.left, y: rect.bottom }`).
  Переиспользуется существующий `dialogCtxMenu` state и его обработчики
  (`onMarkUnread`/`onTogglePin`/`onToggleMute`/`onClearHistory`) — те же, что
  для right-click/long-press.

Обычный клик по строке (не по кнопке) — без изменений, открывает чат.
Существующие триггеры `onContextMenu` (desktop right-click) и long-press
(mobile) остаются.

## Блок 2. Избранное для объявлений

### Store (`src/lib/store.ts`)
Новое поле `AppState.favoriteAdIds: ID[]` (инициализация `[]` в
`createInitialState`). Actions:
- `toggleFavoriteAd(adId: ID)` — добавляет/убирает id из `favoriteAdIds`.
Selector:
- `isAdFavorite(adId: ID) => (s) => boolean`.
Reducer-кейс `TOGGLE_FAVORITE_AD` — по образцу `HIDE_USER`/`BLOCK_USER`.

### Карточки
- `CatalogCard` (`src/components/ads/CatalogCard.tsx`): убрать локальный
  `const [fav, setFav] = useState(false)`; читать
  `const fav = useStore(selectors.isAdFavorite(ad.id))`, по клику —
  `actions.toggleFavoriteAd(ad.id)` + `toast`. Остальная разметка сердечка без
  изменений.
- `AdActionPanel` (`src/components/ads/AdActionPanel.tsx`) используется на
  `/ads/$id`. Сейчас `saved`/`onToggleSave` приходят пропами из `ads.$id.tsx`
  (локальный `useState`). Переключить источник: в `ads.$id.tsx` заменить
  локальный `saved` на `useStore(selectors.isAdFavorite(id))`, а
  `onToggleSave` → `actions.toggleFavoriteAd(id)`. Toast-текст уже есть
  («В избранное»/«Убрано из избранного»).

### Топ-бар (`src/components/layout/DesktopTopBar.tsx`)
Иконка-сердечко (`Heart`, lucide) между `LanguageSwitcher` и колокольчиком
уведомлений — `Link` на `/favorites`, тот же visual-размер (h-10 w-10,
`hover:bg-[var(--background-surface)]`), `aria-label="Избранное"`. Без
счётчика-бейджа (по решению — бейджи не берём).

### Страница `/favorites` (новый роут `src/routes/favorites.tsx`)
- `beforeLoad: requireAuth` (как у `/my-ads`).
- Заголовок «Избранное» + подзаголовок.
- Данные: из стора `favoriteAdIds` → резолв в объекты `Ad`. Источник ad-данных:
  `fetchListings()` (demo → весь каталог), затем `.filter(a =>
  favoriteAdIds.includes(a.id))`. Грузится в `useEffect`, состояние loading →
  `AdCardSkeleton` (как в `/ads`).
- Рендер: та же сетка каталога (`grid grid-cols-2 sm:grid-cols-3
  lg:grid-cols-4 2xl:grid-cols-5 gap-[12px]`) из `CatalogCard`.
- Empty state (`EmptyState`, icon `Heart`): «В избранном пусто» /
  «Добавляйте объявления сердечком в каталоге» + кнопка «В каталог» → `/ads`.
- `AppLayout rightColumn={false} footer` (как каталожные страницы).

### Mobile-доступ
Добавить пункт «Избранное» в `Sidebar` `items` (секция `favorites`,
`to: "/favorites"`, иконка `Heart`) — он же покажется в mobile-варианте
sidebar. В `SIDEBAR_ROUTE_MAP` добавить `favorites: ["/favorites"]`. Топ-бар
сердечко — desktop-доступ; sidebar-пункт — покрывает и lg-mobile-sidebar.
(BottomNav не трогаем — там фиксированный набор 5 пунктов, не расширяем.)

## Блок 3. Смена фото профиля (Avito-style)

**Файлы:** `src/routes/profile.tsx` (компонент `ProfileAvatar` + проброс
хендлера), `src/lib/api/social.ts` (доп. параметр), при необходимости
`backend-endpoints-needed.md`.

На аватаре в `/profile` **только для своего профиля** (`isOwn`):
- Обёртка аватара получает `group` + скрытый `<input type="file"
  accept="image/*">`.
- Оверлей при hover (`opacity-0 group-hover:opacity-100`, затемнение
  `rgba(0,0,0,0.45)`, иконка `Camera` по центру) — клик открывает меню из 2
  пунктов (тот же dropdown-паттерн, что в проекте): **Загрузить фото** →
  триггерит file input; **Удалить** → сброс.
- Загрузка: `uploadMedia(file, "avatar")` → получаем `{ url }` (demo: blob).
  Затем `setCurrentUser({ ...currentUser, avatar: url })` — аватар обновляется
  во всём шелле (topbar, sidebar, посты). Плюс `updateOwnProfile({
  avatar_media_id })` для прод-персиста.
- «Удалить»: `setCurrentUser({ ...currentUser, avatar: "" })` (fallback на
  инициалы) + `updateOwnProfile({ avatar_media_id: null })`.
- `updateOwnProfile` (`social.ts`) — добавить опциональный
  `avatar_media_id?: string | null` в input; в demo — no-op (как сейчас);
  в прод — включить в PATCH-тело.

**Backend-нужда (фиксируем):** подтвердить, что `PATCH /users/me` принимает
`avatar_media_id` (media uuid из `POST /media` с purpose=avatar). Если поле
называется иначе — уточнить. В demo не имитируется глубже (blob-URL в сторе).

Client-side guard: размер файла > 5 МБ → `toast.error`, без загрузки.

## Блок 4. Рабочий поиск по каталогу

**Файлы:** `src/components/layout/DesktopTopBar.tsx`, `src/routes/ads.index.tsx`.

- **Топ-бар:** `<input type="search">` получает управляемое значение + `onKeyDown`:
  по `Enter` с непустым trimmed-значением → `navigate({ to: "/ads", search: {
  q: value.trim() } })`. Пустой Enter → `/ads` без q. Локальный state значения
  в `DesktopTopBar` (`useState`).
- **`/ads` (`ads.index.tsx`):** добавить
  `validateSearch: (s) => ({ q: typeof s.q === "string" ? s.q : undefined })`.
  В `CatalogPage` инициализировать локальный `q`-state из
  `Route.useSearch().q ?? ""` и синхронизировать: при изменении URL-параметра
  (`useEffect` на `search.q`) обновлять локальный `q`. Существующая логика
  `buildParams`/`fetchListings` уже прокидывает `q` в запрос и в demo-фильтр —
  менять не нужно. Поле поиска в `AdSortBar` продолжает работать как сейчас
  (двусторонняя правка локального `q`).
- Поведение demo: `demoListingsFiltered` уже фильтрует по `q` (title/desc/
  category) — поиск сразу работает на моках.

## Что НЕ делается (YAGNI / по решению заказчика)

- Персист избранного/сохранённого в localStorage — не берём (store-only,
  консистентно с `blockedUserIds`/`savedIds`; сбрасывается на hard-reload).
- Счётчики-бейджи на сердечке/уведомлениях — не берём.
- Отдельная иконка «Сообщения» в топ-баре — не берём.
- BottomNav не расширяем (фиксированные 5 пунктов).
- Backend не трогаем.

## Acceptance criteria

- Каждый чат в списке имеет видимую кнопку «три точки» (hover на desktop,
  всегда на mobile), открывающую то же меню, что right-click/long-press;
  обычный клик открывает чат.
- Сердечко на карточке объявления реально сохраняет в избранное (переживает
  SPA-навигацию); в топ-баре есть сердечко → `/favorites`; страница
  показывает избранные объявления или empty state.
- На своём `/profile` при наведении на аватар доступны «Загрузить фото» и
  «Удалить»; загрузка меняет аватар во всём шелле.
- Поиск в топ-баре по Enter ведёт на `/ads?q=...` с применённым поиском;
  результаты фильтруются.
- `npx tsc --noEmit` чист.

## Manual QA

Desktop 1440 + mobile 390: (1) hover по строке чата → появляется «три точки»,
клик → меню; (2) сердечко на карточке → toast → `/favorites` показывает её;
(3) hover на свой аватар → камера → загрузка меняет фото; (4) поиск «двигатель»
в топ-баре → `/ads?q=двигатель` с отфильтрованными карточками.
