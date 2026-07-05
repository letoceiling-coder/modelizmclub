# Landing Hero Fixes — Design Spec

**Дата:** 2026-07-04
**Проект:** ModelizmClub / МоДелизМ (frontend)
**Область:** строго `frontend/src/routes/index.tsx` (+ `backend-endpoints-needed.md`
для TODO-записи). Backend, video-хостинг, auth, `LanguageSwitcher`-компонент,
переводческие словари — не трогать.

## Product goal

Лендинг выглядит как законченный премиальный сервис с первой секунды: логотип
заметен, переключатели реально работают, hero-видео не ломается при смене темы.

## Основание

1. Логотип в header (`size={28}`) слишком мелкий.
2. Языковой переключатель на лендинге реально меняет глобальный i18n (влияет на
   другие страницы приложения), но сам лендинг — 850 строк хардкоженного
   русского текста без единого `useTranslation()`/`t()` — не переводится.
   Пользователь видит toast «Язык: English», но текст остаётся русским →
   вводит в заблуждение.
3+5. Hero-overlay градиент заканчивается на `var(--background)`, который в
   светлой теме — белый. При переключении на светлую тему низ видео замывается
   сплошным белым цветом — воспринимается как «блюр»/«тяжёлая белая дымка».
   Других декоративных blur-элементов на лендинге не найдено (проверено по
   всему файлу) — это единственный источник обоих пунктов.
4. На фоновом decorative-видео есть play/pause и mute кнопки (`HeroCtrl`) —
   неуместны для чисто фонового видео.
6. CTA «Все объявления» уже ведёт на `/ads` в обоих местах (desktop и mobile
   секции `PopularListings`) — проверено, изменений не требует.

## Ключевые решения (утверждены)

1. Логотип: `size={28}` → `size={40}`.
2. Языковой переключатель: убрать с лендинга полностью (header desktop +
   mobile-шторка), оставить `ThemeToggle`. Полный перевод лендинга — TODO в
   `backend-endpoints-needed.md`, вне scope этой фичи.
3+5. Overlay-градиент: последний stop `var(--background)` → фиксированный
   тёмный `rgba(9,11,20,0.92)`, не зависящий от темы.
4. Убрать `HeroCtrl` play/pause и mute кнопки целиком, включая связанный
   state/handlers/ref (не используются больше нигде в файле — проверено).
6. Не трогать (уже корректно).

## Найденное в коде (базис дизайна)

- `src/components/Logo.tsx`: `<Logo size={n}>` рендерит `<img height={n}
  style={{height:n, width:"auto", maxWidth:"100%"}}>` внутри `.logo-plate`
  span — адаптивность и подложка уже масштабируются от `size`, компонент не
  требует изменений.
- `index.tsx:82`: `<Link to="/"><Logo size={28} /></Link>` — единственное
  место логотипа в header (высота шапки 64px, `h-[64px]`).
- `index.tsx:11-12`: импорты `ThemeToggle`, `LanguageSwitcher` (из
  `@/components/messenger/LanguageSwitcher` — тот же компонент, что в App
  Shell, полностью функционален: `setLocale()` → `i18n.changeLanguage` +
  `localStorage` + `<html lang>`).
- `index.tsx:104-105` (desktop) и `~157-158` (mobile sheet): оба места
  рендерят `<LanguageSwitcher /><ThemeToggle />` рядом.
- `index.tsx` не содержит ни одного `useTranslation()`/`t(...)` вызова для
  собственного контента — весь текст (`NAV_LINKS`, hero copy, секции) хардкожен
  по-русски.
- `index.tsx:173-245` (`function Hero()`): `<video autoPlay muted loop
  playsInline ref={videoRef} onError={() => setVideoError(true)}>`, fallback
  `<img src={cover}>` при `videoError` — уже работает корректно, не трогаем.
  Overlay: `<div className="absolute inset-0" style={{ background:
  "linear-gradient(180deg, rgba(9,11,20,0.55) 0%, rgba(9,11,20,0.72) 55%,
  var(--background) 100%)" }} />`.
- `index.tsx:234-244`: блок `{!videoError && (<div className="absolute
  bottom-6 right-6 …"><HeroCtrl onClick={togglePlay}>…</HeroCtrl><HeroCtrl
  onClick={toggleMute}>…</HeroCtrl></div>)}`.
- `index.tsx:176-199`: `videoRef`, `videoError`/`isPlaying`/`isMuted` state,
  `togglePlay`/`toggleMute` функции — используются только этим controls-блоком.
- `index.tsx:327-`: `function HeroCtrl(...)` — приватная функция файла,
  используется только в Hero (проверено grep по всему `src/`).
- `PopularListings` (desktop `index.tsx:409`, mobile `index.tsx:425`): оба CTA
  «Все объявления» — `<Link to="/ads">`. Уже корректно.

## Компоненты и файлы

### `src/routes/index.tsx` (MODIFY)

**1. Логотип** — заменить:
```tsx
<Logo size={28} />
```
на:
```tsx
<Logo size={40} />
```
(единственное место, строка `~82`).

**2. Языковой переключатель** — убрать `<LanguageSwitcher />` из обоих мест
(`~104`, `~157`), оставить только `<ThemeToggle />`. Убрать импорт
`LanguageSwitcher`, если после этого не используется больше нигде в файле
(проверить перед удалением импорта).

**3+5. Overlay-градиент** — заменить:
```tsx
style={{ background: "linear-gradient(180deg, rgba(9,11,20,0.55) 0%, rgba(9,11,20,0.72) 55%, var(--background) 100%)" }}
```
на:
```tsx
style={{ background: "linear-gradient(180deg, rgba(9,11,20,0.55) 0%, rgba(9,11,20,0.72) 55%, rgba(9,11,20,0.92) 100%)" }}
```
Комментарий-строка над блоком («no white fade at the bottom, blends into
--background») тоже обновляется — она больше не точна.

**4. Убрать video controls:**
- Удалить JSX-блок `{!videoError && (<div className="absolute bottom-6
  right-6 …">…HeroCtrl…</div>)}`.
- Удалить `function HeroCtrl(...)` целиком.
- Удалить `videoRef`, `isPlaying`/`setIsPlaying`, `isMuted`/`setIsMuted`,
  `togglePlay`, `toggleMute`.
- На `<video>` убрать `ref={videoRef}` (сам тег `autoPlay muted loop
  playsInline onError` остаётся без изменений — видео продолжает играть
  декоративно, без плеера).
- Убрать неиспользуемые после этого импорты иконок (`Pause`, `Play`,
  `VolumeX`, `Volume2`), если они не нужны больше нигде в файле.

**6. CTA** — без изменений (уже `to="/ads"` в обоих местах).

### `frontend/docs/backend-endpoints-needed.md` (MODIFY)

Добавить запись (не backend endpoint, а зафиксированный frontend TODO, по
формату существующих записей файла):

```markdown
## 8. Полный перевод лендинга (frontend TODO, не backend)

**Задача:** Landing Hero Fixes (2026-07-04) — переключатель языка убран с
лендинга, т.к. страница не была переведена.
**Статус:** `Needed` — `src/routes/index.tsx` не использует `useTranslation()`;
весь текст (NAV_LINKS, hero copy, секции) хардкожен по-русски.
**Что нужно:** обернуть строки лендинга в `t("landing.…")`, добавить ключи в
`ru/en/zh` locale-файлы, вернуть `LanguageSwitcher` в header лендинга.
**Demo/mock fallback:** нет — до перевода лендинг остаётся русскоязычным,
переключатель убран из его header (App Shell и другие страницы продолжают
использовать `LanguageSwitcher` как есть).
```

(Секция 8 — следующая по порядку; текущая последняя секция файла — 7.)

## Данные и потоки

Нет. Чисто визуальные/структурные правки одного файла.

## Состояния для покрытия

- Light theme / dark theme — hero-overlay низ одинаково тёмный в обеих, без
  белой дымки.
- Video loaded / video failed (`videoError=true`) — fallback-картинка
  показывается, без остатков controls-логики.
- Header desktop / mobile-шторка — оба без `LanguageSwitcher`, с логотипом 40px.

## Что НЕ трогаем

- Backend, video-хостинг, auth.
- `LanguageSwitcher` компонент и переводческие словари (`ru/en/zh`) — они
  корректны, используются в App Shell.
- Остальной контент лендинга (кроме удаления языкового переключателя и
  video-controls).
- CTA «Все объявления» (уже верно).

## Backend endpoints

Не требуются. Запись в `backend-endpoints-needed.md` — это frontend TODO
(полный перевод лендинга), не backend-задача; зафиксирована по формату файла
для трекинга.

## Acceptance criteria

- Логотип в header заметно крупнее (40px против 28px), адаптив/подложка не
  сломаны (проверить на mobile-ширине).
- Языкового переключателя на лендинге нет — либо переключение честно, либо не
  вводит в заблуждение (выбран второй вариант: убран + TODO).
- При смене на светлую тему hero-видео не «блюрится»/не покрывается белой
  дымкой — низ overlay остаётся тёмным в обеих темах.
- На hero-видео нет кнопок play/pause/mute.
- Video-fail fallback (картинка вместо видео) продолжает работать.
- CTA «Все объявления» → `/ads` (уже так, подтверждено).
- `npx tsc --noEmit` чистый.

## Manual QA

Preview лендинга (desktop + mobile ширины):
- Логотип крупнее, не растянут, шапка не сломана.
- Header: только `ThemeToggle`, без языкового переключателя (desktop и mobile
  меню).
- Переключить тему light→dark→light несколько раз на hero — низ видео/overlay
  остаётся тёмным каждый раз, без белой вспышки/дымки.
- На видео нет видимых controls в правом нижнem углу.
- Симулировать `videoError` (или временно недоступный src) — fallback-картинка
  показывается корректно, без сломанных контролов.
