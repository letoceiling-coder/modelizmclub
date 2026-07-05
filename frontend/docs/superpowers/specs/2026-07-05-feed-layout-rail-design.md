# Feed Layout — Compact Meaningful Right Rail — Design Spec

## Контекст

`/feed` (`src/routes/feed.tsx`) рендерится через `AppLayout` без пропа
`rightColumn`, поэтому получает дефолтную правую колонку `RightCategories`
(`src/components/layout/RightCategories.tsx`). Сейчас `RightCategories` —
это высокий скроллящийся список ВСЕХ ~10 категорий с online-счётчиками и
раскрывающимися подкатегориями. Он выглядит как навигационное меню,
«чужеродный» блок, который конкурирует с лентой за внимание — особенно на
1280px, где центр ленты 677px, а rail 256px (rail ≈ 27% контентной ширины).

Дефолтный `RightCategories` показывается на 4 страницах: `/feed`,
`/notifications`, `/friends`, `/profile`. Этот тикет сфокусирован на `/feed`.

## Требование #1 (ширина центра) — уже выполнено, изменений НЕ требуется

Замерено в браузере (`preview_*`): центр ленты уже использует fluid-сетку
`--container-max: 1560px` / `--container-pad: clamp(24px, 7vw-60px, 60px)`
через `AppLayout`, и корректно масштабируется:

| Viewport | Центр ленты | Right rail |
|---|---|---|
| 1280px | 677px | 256px |
| 1440px | 814px | 256px |
| 1920px | 896px | 256px |

Центр НЕ узкий и НЕ использует «старый узкий контейнер» — он уже на новой
сетке (Prompt 3). Ширина центра в этой задаче НЕ меняется. Требование #1
считается выполненным существующим `AppLayout`; фиксируем это фактом, а не
выдумываем работу. (Подтверждено владельцем продукта: единственная реальная
боль — плотность/доминирование rail, не ширина центра.)

## Требование #2 (right rail) — основная работа

Создаётся **feed-специфичный** компонент правой колонки `FeedRightRail`,
передаётся во `feed.tsx` через `rightColumn={<FeedRightRail />}`. Это
ограничивает blast radius строго `/feed`; `RightCategories` остаётся
дефолтным rail на `/notifications`, `/friends`, `/profile` без изменений
(вне scope, нулевой риск регрессии там).

### Файл: `src/components/feed/FeedRightRail.tsx` (новый)

`FeedRightRail` — колонка 256px, `hidden xl:block w-64 shrink-0` (как
`RightCategories`), full-height (родитель `<aside>` растянут `items-stretch`
в `AppLayout`). Спокойный вертикальный стек из **3 компактных карточек**
сверху вниз, без высокого внутреннего скролла. Каждая карточка — стиль
существующего rail: `background: var(--background-elevated)`,
`border: 1px solid var(--border)`, `border-radius: 14px`, компактные отступы.

**Карточка 1 — «Категории»**
- Заголовок «Категории» + ссылка-CTA «Все →» на `/categories`.
- Топ-5 категорий (первые 5 из `usePostCategories()`; порядок как приходит
  из хука — детерминированный). Каждая строка: иконка категории (тот же
  `CategoryIcon`-паттерн — lucide по имени `c.icon`, fallback `Hash`) + имя +
  online-счётчик (детерминированная функция `onlineFor(c)`, идентичная
  используемой в `RightCategories`, вынести общий хелпер — см. ниже) + строка
  ведёт на `/categories/$id`.
- Без раскрывающихся подкатегорий (это и делало старый rail плотным).

**Карточка 2 — «Сообщества для вас»**
- Заголовок «Сообщества» + ссылка «Все →» на `/communities`.
- 2–3 рекомендованных (не вступленных) сообщества. Данные: в компоненте
  `fetchCommunities()` (`src/lib/api/communities.ts`, demo-safe) →
  `.filter((c) => !c.joined)` → `.slice(0, 3)`. Каждая строка: аватар
  (иконка по `c.avatarIcon` через `ICON_MAP`-паттерн из
  `communities.index.tsx`, fallback `Users`; если `c.avatarImage` есть —
  `<img>`) + имя + `{c.members} участников`. Строка ведёт на
  `/communities/$id`.
- Кнопки «Вступить» НЕТ — только навигация (layout-focused, per тикет
  «focus on layout, not functionality»).

**Карточка 3 — «Возможные друзья»**
- Заголовок «Возможные друзья» + ссылка «Все →» на `/friends`.
- 2–3 предложенных пользователя (не-друзья). Данные: `searchUsers("")`
  (`src/lib/api/social.ts`, demo → `demoSearchUsers` возвращает пул
  не-друзей) → `.slice(0, 3)`. Каждая строка: аватар (`<img src={u.avatar}>`)
  + имя + город (`u.city`). Строка ведёт на `/user/$id` (`u.slug ?? u.id`).
- Кнопки «Добавить» НЕТ — только навигация.
- Дополнительно фильтруются заблокированные: `.filter((u) => !isBlocked(u.id))`
  через `selectors.isBlocked` (единая user-level блокировка, добавленная в
  прошлой фиче) — чтобы заблокированный не всплывал в рекомендациях.

### Состояния (loading / empty / data)

- **Loading:** пока данные карточки грузятся — 2–3 крошечных
  skeleton-строки (`Skeleton` из `@/components/ui/skeleton`) внутри карточки.
- **Empty:** если у карточки нет данных (напр. все сообщества joined, или
  пул друзей пуст) — карточка НЕ рендерится вообще (скрывается целиком, без
  «пустой» карточки-заглушки). Категории всегда есть (хардкод-хук), поэтому
  карточка «Категории» показывается всегда.
- **Data:** обычный рендер строк.

### Collapse

Сохранить toggle сворачивания rail для консистентности с шеллом — тот же
идиом, что в `RightCategories`: кнопка `PanelRightClose`/`PanelRightOpen`,
состояние в `localStorage`. Ключ — отдельный (`modelizm:feedrail:collapsed`),
чтобы не конфликтовать с `RightCategories` (`modelizm:rightrail:collapsed`).
В свёрнутом виде — узкая полоса `w-11` с кнопкой развернуть (как в
`RightCategories`).

### Общий хелпер `onlineFor`

Функция `onlineFor(c: Category): number` дублируется в `RightCategories.tsx`
и `FindYourPeopleSheet.tsx`. Чтобы не плодить третью копию в `FeedRightRail`,
вынести её в `src/lib/category-online.ts` (`export function onlineFor`) и
переиспользовать во всех трёх (правка `RightCategories` и
`FindYourPeopleSheet` — только замена локальной функции на импорт, без
изменения поведения; это точечное улучшение в рамках трогаемой области, не
несвязанный рефактор).

### Подключение во `feed.tsx`

Строка 169: `<AppLayout footer>` → `<AppLayout footer rightColumn={<FeedRightRail />}>`.
Импорт `FeedRightRail`. Больше во `feed.tsx` ничего не меняется (композер,
PostCard, EventsHero, FindYourPeopleSheet, фильтры, infinite scroll — всё
как есть; `FindYourPeopleSheet` остаётся мобильной точкой входа, `xl:hidden`,
не конфликтует с desktop-rail).

## Что НЕ делается (YAGNI / scope)

- Ширина центра ленты не меняется (уже корректна).
- `RightCategories` и страницы `/notifications`, `/friends`, `/profile` не
  трогаются.
- Feed API, логика публикации, `PostCard`, композер — не трогаются.
- Кнопки действий (Вступить/Добавить) в rail НЕ добавляются — строки
  навигационные; действия живут на `/friends` и `/communities`.
- Mobile не меняется — rail только `xl+`; `FindYourPeopleSheet` остаётся
  мобильным входом.
- backend не трогается; новых endpoint'ов не требуется (все данные —
  существующие demo/API функции `fetchCommunities`/`searchUsers`/категории).

## Acceptance criteria (из тикета)

- ✅ центр использует новую сетку (уже так — задокументировано замерами).
- ✅ right rail компактный (3 короткие карточки, без tall-скролла),
  наполнен смыслом (категории + сообщества + друзья), не доминирует.
- ✅ typecheck чистый.

## Manual QA

Сравнить `/feed` на 1280 / 1440 / 1920 до/после: rail стал компактным
стеком из 3 карточек вместо длинного списка категорий; центр не изменился;
loading показывает skeleton-строки; пустые секции скрываются; collapse
работает; заблокированный пользователь не появляется в «Возможные друзья».
