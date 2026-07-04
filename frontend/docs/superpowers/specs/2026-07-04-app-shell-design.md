# App Shell — Design Spec

**Дата:** 2026-07-04
**Проект:** ModelizmClub / МоДелизМ (frontend)
**Область:** строго `frontend/`. Backend, auth, routes, БД — не трогать.

## Product goal

Пользователь на любой странице сразу видит одинаковый закреплённый функционал
(поиск, уведомления, профиль) и не теряется в перегруженном меню. UX-ориентир —
Avito: верхняя шапка всегда видна и одинакова; левое меню — только про разделы,
не про аккаунт.

## Основание

Тестирование реальными пользователями зафиксировало: тяжёлую верхнюю панель,
перегруженное левое меню, дублирование профиля/уведомлений/подписки в разных
местах.

## Ключевые решения (утверждены)

1. **Scope шапки:** top bar — только desktop (`lg+`). Мобильные `MobileHeader` +
   `BottomNav` остаются как есть (у них уже есть поиск/уведомления/профиль).
2. **Avatar-меню:** открывается по hover **и** click/focus (доступность +
   тач). Используется UI Kit `dropdown-menu`.
3. **Right rail:** collapsible, чуть уже, xl-only, скрыт на mobile. Состояние
   сворачивания в `localStorage`.
4. **Поиск в top bar:** presentational (как сейчас в `MobileHeader`), без новой
   поисковой логики. Клик может фокусировать поле; реальный поиск — отдельная
   задача вне этого ТЗ.
5. **«Настройки» в avatar-меню:** опустить (роута `/settings` нет, ТЗ запрещает
   выдумывать функционал и трогать routes). Зафиксировано как будущая задача в
   `backend-endpoints-needed.md`. Меню: Мой профиль / Мои объявления / Подписка /
   Выйти.

## Архитектура

Всё крепится в `AppLayout` — единая точка, компоненты рендерятся один раз, не
дублируются по страницам.

Текущий desktop-shell:
```
<div class="min-h-[100dvh] ... lg:flex lg:h-[100dvh] lg:flex-col lg:overflow-hidden">
  <MobileHeader />            // mobile-only
  <div class="... lg:flex-1 lg:items-stretch lg:overflow-hidden ...">
    <Sidebar /> <main> <RightCategories />
  </div>
  <BottomNav />              // mobile-only
</div>
```

Новый desktop-shell:
```
<div class="... lg:flex lg:h-[100dvh] lg:flex-col lg:overflow-hidden">
  <MobileHeader />           // mobile-only, без изменений
  <DesktopTopBar />          // NEW — hidden lg:flex, фикс. высота (первый flex-ребёнок)
  <div class="... lg:flex-1 lg:items-stretch lg:overflow-hidden ...">
    <Sidebar /> <main> <RightCategories />
  </div>
  <BottomNav />              // mobile-only, без изменений
</div>
```

`DesktopTopBar` — первый flex-ребёнок шелла с фиксированной высотой, строка
колонок ниже — `flex-1`. Бар «закреплён» естественно (шелл не скроллится,
скроллится только `<main>`), без `position:sticky`. Скрыт ниже `lg`.

Новая CSS-переменная в `styles.css`:
```css
--desktop-topbar-h: 60px;   /* высота desktop top bar (excl. mobile) */
```

## Компоненты

### 1. `components/layout/DesktopTopBar.tsx` (NEW)

Отвечает за: закреплённую desktop-шапку.

Содержимое (слева направо):
- Логотип (`<Logo size={40} />`, ссылка на `/feed`) — **переезжает сюда из
  Sidebar**.
- Presentational-поиск: поле/кнопка в едином стиле токенов. Без новой логики.
- Колокол уведомлений: иконка `Bell` + бейдж из `useUnreadNotifications()`,
  ссылка на `/notifications`. Бейдж `9+` при `> 9`.
- Переключатель темы (`ThemeToggle`) и языка (`LanguageSwitcher`) — **переезжают
  из Sidebar** (глобальный chrome, не «раздел»).
- `<UserMenu />` (avatar).

Зависимости: `useUnreadNotifications`, `selectors.currentUser` (для avatar),
`ROUTES`, UI Kit, дизайн-токены. Только `hidden lg:flex`.

### 2. `components/layout/UserMenu.tsx` (NEW)

Отвечает за: avatar-триггер + выпадающее меню аккаунта.

- Триггер: avatar (`<Avatar>` из UI Kit) текущего пользователя
  (`selectors.currentUser`).
- Открытие по hover **и** click/focus. Реализация: UI Kit `dropdown-menu`
  (`DropdownMenu`), дополненный `onMouseEnter`/`onMouseLeave` на обёртке для
  hover-открытия, с задержкой закрытия ~150ms чтобы не мигало при переходе
  курсора к меню.
- Пункты:
  - Мой профиль → `ROUTES.profile`
  - Мои объявления → `ROUTES.myAds`
  - Подписка → `ROUTES.subscription`
  - (разделитель)
  - Выйти → логика `signOut()` (как в `LogoutButton`: `signOut().then(() =>
    window.location.href = "/login")`).
- Не блокирует контент (overlay-dropdown поверх, не сдвигает layout).
- Активный раздел не подсвечивается в меню (это не навигация разделов).

Зависимости: `selectors.currentUser`, `signOut` из `@/lib/auth/session`,
`ROUTES`, UI Kit `dropdown-menu` + `avatar`.

### 3. `components/layout/Sidebar.tsx` (MODIFY)

Отвечает за: левое меню — **только разделы**.

Изменения:
- **Убрать** верхний header-блок (логотип + `LanguageSwitcher` + `ThemeToggle`) —
  переезжает в `DesktopTopBar`. Italic-слоган («Моделизм — это жизнь…») можно
  оставить как заголовок sidebar или убрать; **оставить** (не относится к
  удаляемому аккаунт-функционалу).
- **Убрать** из nav пункты: Уведомления, Профиль, Подписка.
- **Итоговый список разделов** (порядок из ТЗ):
  1. Лента → `ROUTES.feed`
  2. Каталог объявлений → `ROUTES.ads`
  3. Разместить объявление → `ROUTES.adCreate` (`/ads/new`)
  4. Мои объявления → `ROUTES.myAds` (только для авторизованных, как сейчас)
  5. Сообщества → `ROUTES.communities`
  6. Каналы → `ROUTES.channels`
  7. Мессенджер → `ROUTES.messenger`
  8. Друзья → `ROUTES.friends`
- Блок подписки внизу: **компактный статус** без кнопки «Управлять». Текст вида
  «Год · активна · N дней». В demo данных о подписке нет реального срока —
  показываем статичный demo-текст «Год · активна» (без выдуманного счётчика
  дней, если данных нет; если поле появится — подставить). Управление подпиской —
  только на `/subscription`.
- `LogoutButton` в sidebar **убрать** (logout теперь в `UserMenu`).
- `FeedbackDialog` **оставить** (не входит в список удаления, не аккаунт-хром).

Активный раздел — переиспользовать существующий `getActiveSection` /
`SIDEBAR_ROUTE_MAP`. Для «Разместить объявление» highlight не обязателен (это
CTA-действие), но `/ads/new` уже попадает под `ads` prefix — приемлемо.

### 4. `components/layout/RightCategories.tsx` (MODIFY)

Отвечает за: правый рейл «Найди своих» — компактный, collapsible.

Изменения:
- Ширина развёрнутого: `w-72` (288px) → `w-64` (256px).
- Chevron-кнопка в шапке сворачивает панель: свёрнутое состояние — тонкая
  вертикальная полоса (~44px) с кнопкой-иконкой «развернуть»; развёрнутое —
  полная панель.
- Состояние в `localStorage` (ключ `modelizm:rightrail:collapsed`), читается при
  монтировании, пишется при переключении.
- Остаётся `hidden xl:block` (скрыт на mobile и <xl, как сейчас).
- В свёрнутом виде `<main>` получает освободившееся место (панель уже флекс-ребёнок
  строки колонок — уменьшение её ширины расширяет main автоматически).

### 5. `routes/messenger.tsx` (MODIFY — обязательный integration fix)

Захардкоженная высота чата `lg:h-[calc(100vh-120px)]` рассчитана на текущий шелл
без desktop-шапки. С новым top bar доступная высота уменьшается на
`--desktop-topbar-h`.

- Заменить `lg:h-[calc(100vh-120px)]` на выражение, учитывающее
  `var(--desktop-topbar-h)`, напр. `lg:h-[calc(100vh-var(--desktop-topbar-h)-60px)]`
  (точное вычитание подобрать при реализации так, чтобы чат не уезжал под шапку и
  не появлялся двойной скролл). Мобильная ветка (`h-[calc(100dvh-var(--mobile-header-h)...)]`)
  — без изменений.

## Состояния для покрытия

- hover-menu: open / close (hover, click, focus, blur, outside-click).
- active-раздел в sidebar (существующая логика).
- unread-бейдж уведомлений: 0 (скрыт) / 1–9 / 9+ .
- right rail: expanded / collapsed (persist).

## Что НЕ трогаем

- Backend, auth, routes (не добавляем `/settings`).
- Мобильные `MobileHeader` и `BottomNav` (кроме отсутствия регрессий).
- Дизайн-систему: только существующие токены и shared UI-компоненты, без
  локальных стилей сверх необходимого.

## Backend endpoints

Новых endpoint'ов не требуется. Зафиксировать в `backend-endpoints-needed.md`
будущую задачу: страница/роут «Настройки аккаунта» (`/settings`) — статус
`Needed`, для пункта avatar-меню, сейчас опущен.

## Acceptance criteria

- top bar идентична и закреплена на `/feed`, `/ads`, `/my-ads`, `/messenger`,
  `/profile`, `/friends`, `/communities`, `/channels`.
- hover на avatar раскрывает меню без перехода на новую страницу; меню также
  открывается по click/focus.
- sidebar не содержит Профиль / Уведомления / Подписка (как nav-пункты); блок
  подписки — компактный статус без кнопки «Управлять».
- fixed desktop shell не сломан; mobile bottom nav и mobile header не сломаны.
- messenger не уезжает под шапку, без двойного скролла.
- `npx tsc --noEmit` чистый.

## Manual QA

Обойти `/feed`, `/ads`, `/my-ads`, `/messenger`, `/profile`, `/friends`,
`/communities`, `/channels`: шапка идентична и не переверстывается; avatar-меню
открывается по hover и click; sidebar без аккаунт-пунктов; right rail
сворачивается и состояние сохраняется после перезагрузки; mobile (bottom nav +
header) не сломан.
