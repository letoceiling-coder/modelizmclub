# Responsive Shell Container — Design Spec

**Дата:** 2026-07-04
**Проект:** ModelizmClub / МоДелизМ (frontend)
**Область:** строго `frontend/`. Backend, mobile-брейкпоинты (360-430), состояния данных — не трогать.

## Product goal

Контент на ноутбучных экранах (1280-1440px) использует пространство эффективно и
не выглядит узкой колонкой в море пустоты. Сетка масштабируется по ширине экрана,
а не сидит на одной фиксированной ширине контейнера.

## Основание

`AppLayout` хардкодит `max-w-7xl` (1280px) на shell-контейнере (sidebar + main +
rail). На 1440px это 1280 контента + 160px пустых полей; на 1920px — 1280 + 640px
пустоты. Каталог-сетка при этом зажата в узкий центр. Плюс `DesktopTopBar` —
full-width (`px-6`), не выровнен с контентом ниже.

## Ключевые решения (утверждены)

1. **Механизм:** fluid `clamp()` — непрерывное масштабирование полей + max-width
   cap. Ноль «прыжков» на 1440/1600 по конструкции. Подключить существующие,
   но неиспользуемые CSS-переменные `--container-max` / `--container-pad`.
2. **Topbar:** выровнять по shell-контейнеру (тот же max-width + padding), логотип/
   avatar совпадают с sidebar/rail.
3. **Каталог:** добавить 5-ю колонку на 2xl (`2xl:grid-cols-5`, ≥1536px).

## Найденное в коде (базис дизайна)

- `AppLayout.tsx:32`: `mx-auto flex w-full max-w-7xl items-start gap-6 px-3 pt-4 …
  lg:px-6` — единственный контейнер, кэпящий весь shell.
- `styles.css:68-71`: определены, но **не используются** в layout:
  `--container-max: 1280px`, `--container-pad: 32px`, `--sidebar-w: 240px`,
  `--rightbar-w: 260px`. (`--container-pad` используется только в onboarding.tsx —
  не AppLayout-страница.)
- Tailwind **v4** (`@import "tailwindcss"`, `@theme inline` в styles.css) —
  clamp()/arbitrary values поддерживаются; кастомные брейкпоинты не заданы.
- `DesktopTopBar.tsx:16`: `<header className="hidden lg:flex … px-6">` с прямыми
  детьми (логотип, поиск, контролы) — flex-контейнер = сам header.
- **rightColumn по страницам:** `/feed`, `/profile` — с rail (default
  `RightCategories`); `/ads`, `/my-ads`, `/messenger`, `/channels`,
  `/communities` (index) — `rightColumn={false}` (широкий main).
- Существующая сетка каталога (`ads.index.tsx`): `grid grid-cols-2 gap-[12px]
  sm:grid-cols-3 lg:grid-cols-4` (в loading и data блоках).

## Архитектура

Один рычаг — shell-контейнер в `AppLayout` — расширяет `<main>` на всех
AppLayout-страницах. Плюс два точечных изменения: выравнивание topbar и 5-я
колонка каталога.

## Компоненты и файлы

### 1. `styles.css` (MODIFY) — fluid контейнер-токены

Ответственность: значения ширины/полей shell как CSS-переменные.

- Заменить в `:root` (строки 68-69):
  ```css
  --container-max: 1280px;
  --container-pad: 32px;
  ```
  на:
  ```css
  --container-max: 1560px;                    /* cap: контент не растягивается бесконечно */
  --container-pad: clamp(24px, 3vw, 56px);    /* fluid боковые поля, без прыжков */
  ```
- Точные коэффициенты clamp — стартовые; дотюнить в manual QA под целевые поля
  (24-32 @1280, 32-48 @1440, 48-64 @1600) так, чтобы не было прыжка на 1440.
  Cap 1560 при желании тоже подстраивается в QA (диапазон 1520-1600).

### 2. `components/layout/AppLayout.tsx` (MODIFY) — подключить контейнер

Ответственность: применить fluid-контейнер к shell на desktop, mobile не трогать.

- Строка 32, заменить:
  ```tsx
        className="
          mx-auto flex w-full max-w-7xl items-start gap-6 px-3 pt-4
          pb-[calc(var(--bottom-nav-space)+8px)]
          lg:flex-1 lg:items-stretch lg:overflow-hidden lg:px-6 lg:pb-0
        "
  ```
  на:
  ```tsx
        className="
          mx-auto flex w-full max-w-[var(--container-max)] items-start gap-6 px-3 pt-4
          pb-[calc(var(--bottom-nav-space)+8px)]
          lg:flex-1 lg:items-stretch lg:overflow-hidden lg:px-[var(--container-pad)] lg:pb-0
        "
  ```
- Изменения только: `max-w-7xl` → `max-w-[var(--container-max)]`, `lg:px-6` →
  `lg:px-[var(--container-pad)]`. Mobile `px-3` без изменений. `gap-6`,
  `items-start`, `pt-4`, flex/overflow — без изменений.

### 3. `components/layout/DesktopTopBar.tsx` (MODIFY) — выровнять по shell

Ответственность: контент шапки совпадает по ширине/полям с shell; полоса и
border-bottom тянутся на всю ширину.

- Реструктурировать: `<header>` остаётся full-width (фон + border-bottom на всю
  ширину), внутрь добавить контейнер-обёртку с тем же max-width и padding, что у
  shell. Из:
  ```tsx
    <header
      className="hidden lg:flex shrink-0 items-center gap-4 px-6"
      style={{ height: "var(--desktop-topbar-h)", background: "var(--background)", borderBottom: "1px solid var(--border)" }}
    >
      {/* logo, search, controls … */}
    </header>
  ```
  в:
  ```tsx
    <header
      className="hidden shrink-0 lg:block"
      style={{ height: "var(--desktop-topbar-h)", background: "var(--background)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="mx-auto flex h-full w-full max-w-[var(--container-max)] items-center gap-4 px-[var(--container-pad)]">
        {/* logo, search, controls … без изменений */}
      </div>
    </header>
  ```
- Внутренние элементы (логотип, поиск, LanguageSwitcher/ThemeToggle/Bell/UserMenu)
  переезжают внутрь обёртки без изменений. `hidden lg:…` сохраняется (desktop-only).

### 4. `routes/ads.index.tsx` (MODIFY) — 5-я колонка на 2xl

Ответственность: каталог использует широкий main на больших экранах.

- В обоих грид-блоках (loading-скелетоны и data) заменить:
  ```tsx
  grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4
  ```
  на:
  ```tsx
  grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5
  ```
- `2xl` — стандартный Tailwind брейкпоинт 1536px. Больше ничего не меняется.

## Поведение по ширинам (ожидаемое)

- **1280:** контейнер ≈ full-width минус ~30px поля; sidebar+main+rail заполняют
  ширину; каталог 4 кол.
- **1440:** поля ~43px; main шире; каталог 4 кол; нет прыжка пустоты (clamp
  непрерывен).
- **1536+:** каталог 5 кол; main ещё шире.
- **1600:** поля ~48-56px; контент близок к cap.
- **1920:** контент capped на 1560, лишнее в авто-margin (~180px/сторона);
  контент читаем, не растянут.
- **/feed** (с rail): main ~1000-1016px → посты в целевом диапазоне 960-1100.
- **/ads** (без rail): main ~1296px → 5 карточек по ~250px.

## Что НЕ трогаем

- Mobile-брейкпоинты (`px-3`, 360-430) и mobile-компоненты.
- Backend, routes, auth.
- Per-route inner max-width'ы (my-ads 960, notifications 640, ad-detail 1100,
  subscription 960 и т.д.) — остаются; их контент центрируется в более широком
  main (осознанно: management/reading-ширина, не растягиваем).
- `messenger.tsx` высота (меняется только ширина, высоту не трогаем).
- Состояния данных.

**Известный безвредный побочный эффект:** `onboarding.tsx` использует
`--container-pad` (`padding: "16px var(--container-pad)"`). После смены на clamp
его боковой паддинг станет responsive вместо фиксированного 32px — это
приемлемо (full-screen flow, inner `maxWidth: 920` не меняется). Не цель фичи, но
и не регресс. Проверить бегло в QA.

## Backend endpoints

Не требуются. Чисто layout/CSS.

## Acceptance criteria

- На 1440px нет ощущения «узкая колонка в пустоте».
- Боковые поля пропорциональны ширине экрана (clamp), а не фиксированы одним
  числом для всех десктопных размеров.
- На 1920px+ контент не растягивается до нечитаемой ширины (cap 1560).
- Каталог: 2→3→4→5 колонок по брейкпоинтам.
- DesktopTopBar выровнен с sidebar/rail на всех ширинах.
- `npx tsc --noEmit` чистый; mobile не задет.

## Manual QA

Preview на **1280 / 1440 / 1600 / 1920** для `/ads` и `/feed` (+ бегло /profile,
/messenger, /my-ads):
- поля пропорциональны, нет резкого прыжка пустоты на 1440;
- каталог 4 кол на 1280-1440, 5 кол на ≥1536;
- на 1920 контент не растянут (cap), поля симметричны;
- topbar логотип/avatar выровнены с sidebar/rail;
- mobile (preview_resize mobile) не изменился.
