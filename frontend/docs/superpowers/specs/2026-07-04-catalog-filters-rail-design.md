# Catalog Filters Rail — Design Spec

**Дата:** 2026-07-04
**Проект:** ModelizmClub / МоДелизМ (frontend)
**Область:** строго `frontend/`. Backend, routes, mobile-брейкпоинты (360-430), содержательные поля фильтров — не трогать.

## Product goal

Каталог `/ads` ближе к Avito: фильтры — постоянная узкая колонка слева (не
полноэкранный drawer), category-chips не обрезаются немо (fade + скролл), над
заголовком — хлебные крошки с иерархией Каталог › Категория › Подкатегория.

## Основание

Сравнение `/ads` с Avito: (1) фильтры сейчас drawer (полноэкранный оверлей снизу)
— тяжело, у Avito это persistent-колонка; (2) chips обрезаются по правому краю без
fade/affordance; (3) нет breadcrumb — при выбранной подкатегории пользователь не
видит, где он.

## Ключевые решения (утверждены)

1. **A — panel + collapse:** на `/ads` (только там) на xl+ (≥1280) основной
   app-sidebar схлопывается в иконочный рейл, а persistent-панель фильтров видна
   всегда; collapse **автоматический** (пер-роут, без тоггла). На <xl — как
   сейчас (полный sidebar + drawer).
2. **B — chips:** fade-градиент по краю + доступный скролл.
3. **C — breadcrumb:** корень **«Каталог»** (клик → сброс категории до «Все»,
   остаёмся на /ads); уровни Категория/Подкатегория только если выбраны; без
   пустых ›.
4. Тултипы иконочного sidebar — нативный `title`.
5. Кнопка «Фильтры» в sort-bar — скрыта на xl+ (`xl:hidden`), т.к. панель видна.
6. При видимой панели каталог может стать 4 колонки вместо 5 — это ожидаемо.

## Найденное в коде (базис дизайна)

- `AdFilters.tsx`: экспортирует `FiltersState`, `DEFAULT_FILTERS`,
  `AdFiltersSheet` (drawer). Приватный `Body({ value, onChange, onReset }: Props)`
  содержит все поля фильтров. `AdFiltersDesktop` был удалён ранее — persistent
  панель надо ввести заново.
- `Sidebar.tsx`: `<aside className="hidden lg:block w-60 …">`, nav с лейблами
  всегда; иконочного режима нет. Внизу: маркет-ссылка, статус подписки,
  `FeedbackDialog`.
- `AppLayout.tsx`: всегда рендерит `<Sidebar />` + `<main className="min-w-0
  flex-1 lg:overflow-y-auto">` + опциональный rail. `/ads` — `rightColumn={false}`.
- `CategoryChips.tsx`: `<div className="flex gap-[8px] overflow-x-auto pb-[4px]"
  style={{ scrollbarWidth: "none" }}>` — без fade/affordance.
- `ads.index.tsx`: header (h1 «Объявления» + CTA «Разместить»), `CategoryChips`
  (`value=filters.category onChange=handleCategoryChip`), контент с `AdSortBar`
  (кнопка «Фильтры» → `setSheetOpen(true)`). `filters.category`/`filters.subcategory`
  доступны; `handleCategoryChip(name)` ставит категорию + subcategory="Все".
- `RightCategories.tsx`: готовый collapse-паттерн (иконочная полоса) —
  переиспользуем ВИЗУАЛЬНУЮ идею (узкий рейл), не сам компонент.
- Брейкпоинты: Tailwind `lg`=1024, `xl`=1280, `2xl`=1536.

## Архитектура

Один брейкпоинт-переключатель — `xl` (1280):
- **xl+ на /ads:** icon-sidebar (`w-16`) + persistent `AdFiltersPanel` (`w-280`) +
  grid; кнопка «Фильтры» и drawer скрыты.
- **<xl (lg–xl и mobile):** полный sidebar + grid full-width + кнопка «Фильтры» →
  drawer (текущее поведение, без изменений).

Collapse включается только когда `/ads` передаёт `navCollapsed` в `AppLayout`.
Прочие страницы — без изменений.

## Компоненты и файлы

### 1. `components/layout/Sidebar.tsx` (MODIFY) — иконочный вариант

Ответственность: полный sidebar + (по пропу) иконочный рейл на xl+.

- Добавить проп: `export function Sidebar({ collapsed = false }: { collapsed?: boolean })`.
- Когда `collapsed === false` (по умолчанию, все страницы кроме /ads): текущий
  рендер без изменений, `hidden lg:block w-60`.
- Когда `collapsed === true` (/ads):
  - Полный вариант виден только на lg–xl: обёртка `hidden lg:block xl:hidden w-60`
    (тот же контент, что сейчас).
  - Иконочный рейл виден на xl+: `hidden xl:flex w-16 shrink-0 flex-col`. Рендерит
    те же `items` (nav), но только иконку по центру, с `title={t(labelKey)}` для
    тултипа, активная подсветка (тот же `activeSection`-механизм, но компактно:
    квадрат `h-10 w-10`, фон `--accent-soft`/бордер при active). Внизу — иконка
    маркета (внешняя ссылка `title="Маркет"`, иконка `ShoppingBag`).
  - В иконочном режиме **скрыты**: блок статуса подписки и `FeedbackDialog`
    (вторичное; доступны на прочих страницах с полным sidebar). `FeedbackDialog`
    не модифицируется — просто не рендерится в icon-ветке.
- `getActiveSection`/`useRouterState`/`selectors`/i18n — переиспользуются как есть.

### 2. `components/layout/AppLayout.tsx` (MODIFY) — проп navCollapsed

Ответственность: прокинуть collapse в Sidebar.

- Сигнатура: `AppLayout({ children, rightColumn, navCollapsed }: Props)` — добавить
  `navCollapsed?: boolean` в `Props`.
- Заменить `<Sidebar />` на `<Sidebar collapsed={navCollapsed} />`.
- Больше ничего (main/rail/контейнер без изменений).

### 3. `components/ads/AdFilters.tsx` (MODIFY) — persistent панель

Ответственность: persistent-обёртка вокруг приватного `Body`.

- Добавить экспорт:
  ```tsx
  export function AdFiltersPanel(props: Props) {
    return (
      <aside className="hidden xl:block w-[280px] shrink-0">
        <div
          className="sticky top-0 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - var(--desktop-topbar-h) - 32px)", scrollbarWidth: "thin" }}
        >
          <h3 className="mb-[12px] font-display text-[15px] font-bold" style={{ color: "var(--foreground)" }}>Фильтры</h3>
          <Body {...props} />
        </div>
      </aside>
    );
  }
  ```
  (`Props` = `{ value, onChange, onReset }` — уже существует. `Body` — приватный, в
  том же файле. Поля фильтров не трогаю.)

### 4. `components/ads/CategoryChips.tsx` (MODIFY) — fade + scroll

Ответственность: видимая подсказка, что чипы скроллятся.

- Обернуть скролл-контейнер в `relative`-обёртку. Скролл-строку оставить
  (`overflow-x-auto`, `scrollbarWidth: none`). Добавить fade-оверлеи по краям:
  правый всегда (пока есть overflow), левый — при `scrollLeft > 0`.
- Реализация без внешних либ: `useRef` на скролл-контейнер + `useState` для
  `atStart`/`atEnd`, обновляемых на `scroll` и на маунте; fade — абсолютные
  `div`-оверлеи (`w-[32px]`, `linear-gradient` от `var(--background)` к
  `transparent`), `pointer-events-none`, показываются по `atStart`/`atEnd`.
- Токены/цвета — существующие. Опционально мелкая стрелка внутри правого fade
  (не обязательно; fade достаточно как affordance).

### 5. `components/ads/CatalogBreadcrumb.tsx` (NEW) — хлебные крошки

Ответственность: путь Каталог › Категория › Подкатегория над заголовком.

- Пропсы: `{ category: string; subcategory: string; onResetToRoot: () => void; onResetToCategory: () => void }`.
- Рендер (flex, `text-[12px]`, `--foreground-50`, разделитель `›`):
  - «Каталог» — кнопка `onResetToRoot` (если выбрана категория/подкатегория) или
    просто текст (если ничего не выбрано).
  - Если `category !== "Все"`: `›` + звено категории. Если ещё и подкатегория
    выбрана — категория кликабельна (`onResetToCategory`), иначе текущий уровень
    (текст, `--foreground-70`).
  - Если `subcategory !== "Все"`: `›` + подкатегория (текущий уровень, текст).
- Никаких пустых `›`: уровни добавляются только для выбранных значений.

### 6. `routes/ads.index.tsx` (MODIFY) — сборка

Ответственность: включить collapse, panel, breadcrumb; скрыть кнопку фильтров на xl.

- `<AppLayout rightColumn={false} navCollapsed>`.
- Над заголовком «Объявления» вставить `<CatalogBreadcrumb category={filters.category}
  subcategory={filters.subcategory} onResetToRoot={() => setFilters((p) => ({ ...p,
  category: "Все", subcategory: "Все" }))} onResetToCategory={() => setFilters((p) =>
  ({ ...p, subcategory: "Все" }))} />`.
- Контент-область: обернуть `[AdFiltersPanel][grid-колонка]` во flex-row:
  ```tsx
  <div className="flex gap-[20px]">
    <AdFiltersPanel value={filters} onChange={setFilters} onReset={resetFilters} />
    <div className="min-w-0 flex-1 space-y-[12px]">
      {/* AdSortBar, filter tags, states/grid — как сейчас */}
    </div>
  </div>
  ```
  (`AdFiltersPanel` сам `hidden xl:block`, поэтому на <xl колонка отсутствует и grid
  занимает всю ширину.)
- `AdSortBar` кнопка «Фильтры» — скрыть на xl+ (см. Task в плане: добавить
  `xl:hidden` на кнопку в `AdSortBar.tsx`; drawer/`sheetOpen` остаётся для <xl).

### 7. `components/ads/AdSortBar.tsx` (MODIFY) — скрыть кнопку на xl

Ответственность: на xl+ панель видна → кнопка «Фильтры» избыточна.

- Добавить `xl:hidden` на класс кнопки «Фильтры» (открывающей drawer). Бейдж
  `filterCount` остаётся на <xl.

## Состояния для покрытия

- xl+ /ads: icon-sidebar + panel + breadcrumb; кнопка фильтров скрыта.
- <xl /ads: полный sidebar + кнопка «Фильтры» + drawer (как сейчас).
- breadcrumb: только «Каталог» / +Категория / +Подкатегория; клики сбрасывают
  уровень.
- chips: fade справа (overflow) / слева (scrollLeft>0) / оба.
- active nav в иконочном режиме.

## Что НЕ трогаем

- Содержательные поля фильтров (`Body`).
- Backend, routes, auth.
- Mobile-брейкпоинты и mobile-компоненты; collapse только на /ads (прочие
  страницы — полный sidebar).
- `messenger.tsx`, другие роуты.

## Backend endpoints

Не требуются. Чисто отображение/навигация.

## Acceptance criteria

- На /ads при ≥1280: panel фильтров видна постоянно (не drawer), app-sidebar —
  иконочный рейл с тултипами, кнопка «Фильтры» скрыта.
- На /ads при <1280: полный sidebar + кнопка «Фильтры» + drawer (без регресса).
- Category-chips: виден fade и есть доступный скролл; обрезки «немо» нет.
- Breadcrumb над заголовком: Каталог › Категория › Подкатегория, только для
  выбранных уровней, клики сбрасывают до уровня; без пустых ›.
- Другие страницы (sidebar) не изменились.
- `npx tsc --noEmit` чистый; mobile не задет.

## Manual QA

Preview на 1280/1440/1600 (/ads): panel + icon-sidebar + breadcrumb + chips fade;
клики breadcrumb сбрасывают фильтр; на 1024–1279 и mobile — drawer как раньше;
бегло /feed (sidebar полный, не изменился).
