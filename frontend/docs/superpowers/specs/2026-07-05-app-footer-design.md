# AppFooter — Design Spec

**Дата:** 2026-07-05
**Проект:** ModelizmClub / МоДелизМ (frontend)
**Область:** строго `frontend/`. Backend, auth — не трогать.

## Product goal

Сервис выглядит завершённым на каждой внутренней странице, а не только на
лендинге.

## UX goal

Единый футер, скролл работает корректно, fixed-shell не ломается.

## Основание

Внутренние страницы (`/feed`, `/ads`, `/my-ads`, `/profile`, `/friends`,
`/communities`, `/channels`, `/notifications`) не имеют футера — заканчиваются
резко. Лендинг уже имеет полноценный `Footer` (5 колонок, `index.tsx:740`).

## Исследованное (важные находки до дизайна)

- Лендинг-`Footer` (`index.tsx:740-780`): 5-колоночный full-bleed grid
  (`md:grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr]`, `maxWidth: 1240`). Колонки:
  бренд+копирайт, «МоДелизМ» (О нас/О компании/Партнёрам/Реклама),
  «Документы» (соглашение/приватность/compliance/consent), «Поддержка»
  (FAQ/поддержка/отзыв/обратная связь), «Контакты» (email, телефон,
  **Telegram: @modelizm**, часы работы).
- **Ни Telegram, ни MAX, ни VK не подтверждены как реальные аккаунты
  компании.** Существующая ссылка `t.me/modelizm` на лендинге — не
  верифицирована, визуально выглядит рабочей. **Решение: убрать любое
  упоминание Telegram отовсюду** (не TODO, а полное отсутствие). MAX и VK —
  честные TODO-чипы (не кликабельны, без реального `href`).
- `AppLayout.tsx` (`components/layout/AppLayout.tsx`): shell зажат в `100dvh`,
  скроллится только `<main className="min-w-0 flex-1 lg:overflow-y-auto">`.
  Любой контент, добавленный внутрь `{children}` этого `<main>`, естественно
  скроллится вместе с остальным контентом страницы и не может перекрыть
  `Sidebar`/`RightCategories` (они — отдельные flex-колонки той же строки).
- `/info/$slug` (`routes/info.$slug.tsx`) — generic placeholder-роут,
  `PAGES`-словарь с `{title, desc}` по slug; неизвестный slug → честный
  fallback «Страница в подготовке». Уже резолвит `about`, `company`,
  `partners`, `advertising`, `compliance`, `consent`, `support`, `feedback`.
  **Нет** записей `contacts`, `security` — нужны для колонок из тикета.
- 8 целевых страниц (`feed.tsx`, `ads.index.tsx`, `my-ads.tsx`, `profile.tsx`,
  `friends.tsx`, `communities.index.tsx`, `channels.index.tsx`,
  `notifications.tsx`) — все используют `<AppLayout>` (проверено grep).
- `messenger.tsx` — фиксированная grid-высота чата
  (`h-[calc(100vh-var(--desktop-topbar-h)-var(--mobile-header-h)-28px)]`,
  дважды правленный рисковый файл, см. предыдущие фичи App Shell/Responsive
  Shell). Тикет сам разрешает пропустить футер здесь, если ломает раскладку —
  используем это разрешение: `/messenger` футер не получает.

## Ключевые решения (утверждены)

1. **Соцсети:** ни у кого (Telegram/MAX/VK) нет подтверждённого реального
   аккаунта. Telegram убирается **полностью, отовсюду** (включая
   существующую ссылку на лендинге) — не TODO, а отсутствие. MAX и VK —
   честные неактивные TODO-чипы в обоих футерах.
2. **Синхронизация лендинг/app футеров:** общий источник данных
   (`footer-links.ts`) для пересекающихся ссылок (Поддержка/Компания/
   Документы/Соцсети), два раздельных рендер-компонента (разная ширина/
   контекст). Существующие доп. колонки лендинга (About/Partners/Compliance/
   Consent) не трогаются — они шире скоупа AppFooter, не дублирование.
3. **Contacts/Security:** добавить 2 записи в `/info/$slug` `PAGES`-словарь
   (тот же placeholder-паттерн, что у `about`/`support`/`feedback`) — ссылки
   в футере ведут на реальные, честно помеченные страницы.

## Архитектура

Один общий модуль данных → два рендер-компонента → один новый проп на
`AppLayout` → 8 страниц-потребителей + 2 правки лендинга + 2 записи в
`info.$slug`.

## Компоненты и файлы

### 1. `lib/footer-links.ts` (NEW)

Ответственность: единственный источник правды для ссылок футера,
переиспользуемый обоими рендерами.

```ts
export interface FooterLink { label: string; to: string }
export interface FooterSocial { label: string; href: string | null }

export const SUPPORT_LINKS: FooterLink[] = [
  { label: "Помощь и FAQ", to: "/help" },
  { label: "Написать в поддержку", to: "/info/support" },
  { label: "Оставить отзыв", to: "/info/feedback" },
];

export const COMPANY_LINKS: FooterLink[] = [
  { label: "О компании", to: "/info/company" },
  { label: "Реклама", to: "/info/advertising" },
  { label: "Контакты", to: "/info/contacts" },
];

export const DOCS_LINKS: FooterLink[] = [
  { label: "Правила", to: "/legal/rules" },
  { label: "Безопасность", to: "/info/security" },
];

// href: null — no confirmed real account. Rendered as a disabled/TODO chip,
// never a live link (see spec: no Telegram anywhere, MAX/VK unconfirmed).
export const SOCIAL_LINKS: FooterSocial[] = [
  { label: "MAX", href: null },
  { label: "VK", href: null },
];
```

### 2. `/info/$slug` route (MODIFY)

Ответственность: реальные (не 404) целевые страницы для «Контакты» и
«Безопасность».

Добавить в существующий `PAGES`-словарь (`routes/info.$slug.tsx`):
```ts
  contacts: { title: "Контакты", desc: "Свяжитесь с нами: support@modelizmclub.ru, 8 800 000-00-00, Пн–Вс 10:00–20:00 МСК. Ссылки на соцсети появятся, когда официальные каналы будут запущены." },
  security: { title: "Безопасность", desc: "Принципы безопасной сделки, модерация объявлений и защита персональных данных на платформе МоДелизМ. Полная редакция публикуется при запуске продакшен-версии." },
```

### 3. `components/layout/AppFooter.tsx` (NEW)

Ответственность: компактный футер для узкого центрального `<main>`.

- Пропсы: нет (данные берёт из `footer-links.ts` напрямую — статичный
  контент, состояние не требуется).
- Разметка: `<footer>` с `border-top`, 3 колонки (Поддержка/Компания/
  Документы) в `grid sm:grid-cols-3` (на мобильных — стек), под ними строка
  соцсетей (`SOCIAL_LINKS`, TODO-чипы: `<span>` с приглушённым цветом,
  `title="Скоро"`, не `<a>`), копирайт-строка снизу.
- Токены — те же, что у лендинг-Footer: `var(--border)`,
  `var(--foreground-50)`, `var(--foreground-70)`, `var(--accent)` на hover
  ссылок.
- Ширина: `w-full` (наследует ширину родителя `<main>`, не задаёт свой
  `max-width`/`mx-auto` — уже находится в узкой колонке рядом с
  sidebar/rail).

### 4. `components/layout/AppLayout.tsx` (MODIFY)

Ответственность: опциональный слот футера внутри скроллящегося `<main>`.

- `Props` добавляет `footer?: boolean`.
- `<main className="min-w-0 flex-1 lg:overflow-y-auto">{children}</main>`
  →
  ```tsx
  <main className="min-w-0 flex-1 lg:overflow-y-auto">
    {children}
    {footer && <AppFooter />}
  </main>
  ```
- Больше ничего не меняется — `Sidebar`/`RightCategories`/shell-модель вне
  `<main>`, футер физически не может их перекрыть.

### 5. 8 route-файлов (MODIFY, по одному изменению на файл)

Каждый передаёт `footer` явно в свой вызов `<AppLayout ...>`:
`feed.tsx`, `ads.index.tsx`, `my-ads.tsx`, `profile.tsx`, `friends.tsx`,
`communities.index.tsx`, `channels.index.tsx`, `notifications.tsx`.

`messenger.tsx` — **не изменяется** (не передаёт `footer`, использует
разрешённый тикетом escape hatch из-за фиксированной grid-высоты чата).

### 6. `routes/index.tsx` (MODIFY) — лендинг

- Убрать `<li><a href="https://t.me/modelizm" ...>Telegram: @modelizm</a></li>`
  из блока «Контакты» целиком.
- В том же блоке «Контакты» добавить строку соцсетей из `SOCIAL_LINKS`
  (те же TODO-чипы, что в `AppFooter`) — после удаления Telegram блок не
  остаётся «пустым» без сети.
- Остальные 4 колонки (бренд, МоДелизМ, Документы, Поддержка) и их текущие
  ссылки/лейблы — **не трогаются** (шире скоупа AppFooter, не
  дублирование).

## Данные и потоки

Нет сетевых. Статичные ссылки/тексты, читаемые напрямую из
`footer-links.ts` в обоих компонентах.

## Состояния для покрытия

- Короткий контент страницы (например `/notifications` с малым числом
  элементов) — футер появляется сразу под контентом, не «прилипает» к низу
  вьюпорта искусственно (это нормально: короткая страница = короткий
  скролл, футер просто ближе к верху).
- Длинный контент (например `/ads` с полным списком объявлений) — футер
  доступен после прокрутки до конца, не наезжает на `Sidebar`/`RightCategories`
  по бокам.
- `/messenger` — без футера, раскладка чата не тронута.

## Что НЕ трогаем

- Backend, auth.
- `messenger.tsx`.
- Существующие 4 колонки лендинг-футера (About/Partners/Compliance/Consent) и
  их содержимое.
- App Shell модель (`100dvh`, `overflow-hidden`, fixed topbar/sidebar).

## Backend endpoints

Не требуются. `contacts`/`security` — статичный frontend-контент в уже
существующем placeholder-паттерне `/info/$slug`.

## Acceptance criteria

- Футер есть на всех 8 перечисленных внутренних страницах.
- Футер скроллится вместе с центральным контентом, не фиксирован, не
  перекрывает `Sidebar`/`RightCategories`.
- Ни одного упоминания Telegram нигде в проекте (включая лендинг). MAX и VK
  — честные неактивные TODO-чипы (не мёртвые `<a href>`), в обоих футерах.
- «Контакты» и «Безопасность» в футере ведут на реальные (не 404) страницы
  `/info/contacts` и `/info/security`.
- `/messenger` не изменился визуально/структурно.
- `npx tsc --noEmit` чистый.

## Manual QA

Preview на каждой из 8 страниц: прокрутить до конца, убедиться что футер
появляется корректно, не наезжает на sidebar/rail, скроллится с контентом.
Проверить короткий контент (`/notifications`) и длинный (`/ads`). Проверить
лендинг: Telegram-упоминание отсутствует, MAX/VK — TODO-чипы, не кликабельны.
Проверить `/messenger` — без изменений. Кликнуть «Контакты»/«Безопасность» в
футере — попадают на реальные `/info/*` страницы, не 404.
