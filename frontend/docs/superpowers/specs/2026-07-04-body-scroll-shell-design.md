# Body Scroll Shell — Design Spec

**Дата:** 2026-07-04
**Проект:** ModelizmClub / МоДелизМ (frontend)
**Область:** строго `frontend/`. Backend, routes, mobile-брейкпоинты (360-430),
App Shell модель (fixed topbar/sidebar), messenger.tsx — не трогать.

## Product goal

Скроллбар на страницах без правого rail (`/ads`, `/my-ads`, `/messenger`,
`/channels`, `/communities` index) должен визуально сидеть у края контентного
контейнера, а не иметь видимый зазор `--container-pad` — как на Avito.

## Основание

Сейчас скроллится только `<main>` внутри `100dvh`-зажатого shell (fixed
topbar+sidebar), из-за чего между скроллбаром `<main>` и краем контейнера есть
зазор шириной `--container-pad` (24-60px, fluid из прошлой фичи).

## Исследованные варианты (оба оценены до написания этого спека)

### Вариант 1 — Body-scroll модель (отклонён)

Перевести весь shell на скролл `body`/`html`, сделать `DesktopTopBar` и
`Sidebar`/`RightCategories` `sticky` вместо текущей fixed-высотной модели.

**Почему отклонён:**
- **Архитектурно не может выполнить требование «скроллбар до края
  контейнера, не физического края окна».** Скроллбар `body`/`html` — это
  браузерный root-скроллбар, он всегда рисуется у физического края вьюпорта;
  ограничить его шириной `--container-max` (1560px cap) невозможно. На
  ultrawide (≥1920) это дало бы скроллбар, оторванный от контента широким
  пустым полем — визуально хуже, чем сейчас.
- Требует переписать `Sidebar.tsx`/`RightCategories.tsx` с
  `items-stretch + h-full` на `sticky + max-height` (новый паттерн,
  не protестированный на desktop, хотя частично напоминает уже существующий
  `AdFiltersPanel`).
- `messenger.tsx` — уже дважды правленный рисковый файл. Его
  `h-[calc(100vh - --desktop-topbar-h - --mobile-header-h - 28px)]` полагается
  на то, что shell гарантированно не даёт странице скроллиться сверх этой
  высоты. При body-scroll любой pixel-дрифт (border, gap, padding) создал бы
  вертикальный скролл всей страницы, которого сегодня физически быть не
  может — новый класс регрессий на файле, который уже дважды ломался.
- Объём: минимум 4 файла (AppLayout, DesktopTopBar, Sidebar, RightCategories),
  plus риск для messenger.tsx.

### Вариант 2 — Негативный margin на `<main>` (выбран)

`<main>` получает `margin-right: calc(-1 * var(--container-pad))` +
`padding-right: var(--container-pad)`, только когда он последняя колонка
(`rightColumn === false`).

**Почему выбран:**
- Скроллбар `<main>` рисуется у его border-box edge. После сдвига этот край
  совпадает с внутренней границей паддинга родительской flex-строки
  (`lg:px-[var(--container-pad)]`), а не выходит за её border-box — значит
  родительский `lg:overflow-hidden` **не обрезает** сдвинутый `<main>`,
  трогать его не нужно.
- Естественно даёт «скроллбар до края контейнера, не физического края окна»:
  на 1280-1560px контейнер занимает всю ширину, так что край контейнера
  совпадает с краем вьюпорта; на ultrawide (≥1920, где контейнер центрирован
  с симметричными полями по `--container-max` из прошлой фичи) скроллбар
  сядет на границу контейнера, а не уедет к физическому краю — то есть именно
  то, что архитектурно недостижимо в Варианте 1.
- Затрагивается только `AppLayout.tsx` — один условный класс на `<main>`.
- `DesktopTopBar`, `Sidebar`, `RightCategories`, `messenger.tsx` — не
  трогаются вообще.

## Ключевые решения (утверждены)

1. Фикс применяется **только** на страницах без правого rail
   (`rightColumn === false`): `/ads`, `/my-ads`, `/messenger`, `/channels`,
   `/communities` index. Страницы с rail (`/feed`, `/profile`) — не трогаются;
   там `<main>` не последняя колонка, до края физически не дотянуться без
   отдельной переделки rail (вне scope).
2. На ultrawide скроллбар садится на границу `--container-max`-контейнера, не
   на физический край окна — обеспечивается естественно механикой Варианта 2,
   без дополнительного кода.
3. App Shell модель (fixed topbar/sidebar, `100dvh`-зажатый shell,
   `overflow-hidden`) — не меняется.

## Архитектура

Один файл, один условный класс.

## Компоненты и файлы

### `components/layout/AppLayout.tsx` (MODIFY)

Ответственность: `<main>` дотягивает скроллбар до края контейнера, когда он
последняя колонка.

- Импортировать `cn` из `@/lib/utils` (уже используется в проекте, см.
  `CatalogCard.tsx`).
- `<main className="min-w-0 flex-1 lg:overflow-y-auto">{children}</main>`
  заменить на:
  ```tsx
  <main
    className={cn(
      "min-w-0 flex-1 lg:overflow-y-auto",
      rightColumn === false && "lg:mr-[calc(-1*var(--container-pad))] lg:pr-[var(--container-pad)]",
    )}
  >
    {children}
  </main>
  ```
- Больше ничего в файле не меняется. `rightColumn` уже есть в `Props`
  (существующий проп).

## Данные и потоки

Нет. Чисто CSS-геометрия одного элемента.

## Состояния для покрытия

- `rightColumn === false` (страницы без rail): скроллбар `<main>` у границы
  контейнера на 1280/1440/1600/1920.
- `rightColumn` присутствует (по умолчанию/явный) — `/feed`, `/profile`:
  поведение не меняется, визуальная проверка регресса.
- Mobile (`<lg`): класс скрыт за `lg:`-префиксом — не участвует.

## Что НЕ трогаем

- App Shell модель (`100dvh`, `overflow-hidden`, fixed topbar/sidebar).
- `DesktopTopBar.tsx`, `Sidebar.tsx`, `RightCategories.tsx`.
- `messenger.tsx` — полностью вне scope, изменений не требует и не получает.
- Страницы с rail (`/feed`, `/profile`).
- Mobile-брейкпоинты.

## Backend endpoints

Не требуются.

## Acceptance criteria

- На `/ads`, `/my-ads`, `/messenger`, `/channels`, `/communities` (index) —
  скроллбар `<main>` визуально у края контентного контейнера (зазор
  `--container-pad` устранён), на 1280/1440/1600 это совпадает с краем окна,
  на 1920+ — с краем `--container-max`-контейнера, не физическим краем окна.
- `/feed`, `/profile` — без изменений (rail на месте, зазор там не трогаем).
- Контент внутри `<main>` сохраняет прежний визуальный отступ от края
  (за счёт компенсирующего `padding-right`).
- `npx tsc --noEmit` чистый.
- Mobile не задет.

## Manual QA

Preview на 1280/1440/1600/1920:
- `/ads`: скроллбар у края контейнера (на 1920 — не у физического края окна).
- `/feed`: без изменений, rail и его отступ как прежде.
- Content padding внутри `<main>` на `/ads` не изменился визуально (карточки
  не съехали к краю).
- Mobile (preview_resize mobile): без изменений.
