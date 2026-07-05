# Auth Page Layout Fix — Design Spec

**Дата:** 2026-07-05
**Проект:** ModelizmClub / МоДелизМ (frontend)
**Область:** строго `frontend/`. Auth-логика, submit-обработка, backend — не
трогать.

## Product goal

Страница регистрации выглядит как продуманный экран, а не форма, случайно
прижатая к правому краю.

## UX goal

Левая и правая зона сбалансированы, заголовок не сжат, форма не теснится.

## Основание

`AuthShell` (общий layout для 5 auth-страниц) уже рендерит в левой колонке
лого/заголовок/цитату через `justify-between`, но три блока растянуты на всю
высоту колонки без промежуточного контента — визуально читается как «пустая
левая половина». Заголовок (`h2`, `lineHeight: 1.05`) читается сжато. Форма
справа использует bespoke `<input style={inputStyle}>`/`<button
style={primaryBtn}>` вместо shared `Input`/`Button`.

## Исследованное (важные находки до дизайна)

- **`AuthShell` используется 5 страницами:** `login`, `register`, `recover`,
  `reset-password`, `verify-email`. Ценностный контент («зачем
  регистрироваться», список преимуществ) имеет смысл только на `register`
  (и в облегчённом виде на `login`); остальные 3 — нейтральные утилитарные
  экраны, где текущий generic-контент уместен.
- **3D-иллюстрации из UI Kit не существует.** В `src/assets/` только
  `image_*.png.asset.json` — placeholder-ссылки на внешний editor
  (lovable.dev), не относящиеся к auth-страницам. Нельзя использовать «3D
  illustration из UI Kit», т.к. её нет.
- Shared `Input` (`@/components/ui/input.tsx`) уже поддерживает `error?:
  boolean` проп с готовым UI Kit error-стилем (`border-[var(--danger)]`).
- Shared `Button` (`@/components/ui/button.tsx`) — variants/sizes, стандартный
  UI Kit компонент.
- `Card` — не нужен: форма уже в контейнере `AuthShell`, обёртка в `Card`
  добавит рамку-в-рамке без пользы.

## Ключевые решения (утверждены)

1. **Scope:** только `register.tsx` и `login.tsx` получают кастомный
   `leftContent`. `recover.tsx`, `reset-password.tsx`, `verify-email.tsx` — без
   изменений (используют `AuthShell` без нового пропа → старое поведение).
2. **Замена 3D-иллюстрации:** icon-based список преимуществ — lucide-иконка в
   accent-кружке + короткий текст на каждое преимущество, в том же стиле, что
   уже используется на лендинге. Без новых ассетов.
3. **Login тоже получает `leftContent`** — более лаконичный вариант (без
   списка преимуществ), решает тот же визуальный дисбаланс.

## Архитектура

`AuthShell` получает новый опциональный проп `leftContent?: ReactNode`. Если
передан — заменяет текущий generic-блок (лого/заголовок/цитата) целиком; если
не передан — старое поведение сохраняется байт-в-байт (для 3 нетронутых
страниц). `register.tsx`/`login.tsx` строят свой `leftContent` и передают его.

## Компоненты и файлы

### 1. `components/auth/AuthShell.tsx` (MODIFY)

Ответственность: layout-обёртка с опциональным кастомным левым содержимым.

- `Props` добавляет `leftContent?: ReactNode`.
- Левая колонка (`<div className="relative hidden overflow-hidden lg:block">`)
  рендерит: `{leftContent ?? <DefaultLeftContent />}`, где `DefaultLeftContent`
  — вынесенный в отдельную функцию текущий блок (лого/label/h2/p/цитата) без
  изменений — гарантирует нулевой визуальный diff для `recover`,
  `reset-password`, `verify-email`.
- Fone-подложка (`<img src={cover}>` + gradient overlay) остаётся общей и вне
  `leftContent` — обе кастомные версии (register/login) наследуют её
  автоматически, не дублируют.
- Логотип (`<Logo size={40} />` в левой колонке) — тоже остаётся вне
  `leftContent`, общий для всех вариантов (маркер бренда должен быть на месте
  независимо от контента).
- `inputStyle`/`primaryBtn` экспорты — оставить (используются `recover.tsx`,
  `reset-password.tsx`, `verify-email.tsx`, которые не трогаем).
- Заголовок формы (`h1`, правая колонка, сейчас `fontSize: 32`) — увеличить до
  `fontSize: 38`, `marginBottom` перед `subtitle` слегка увеличить (текущий
  `marginTop: 8` на subtitle → `marginTop: 10`), `lineHeight` явно `1.15` (сейчас
  не задан — используется браузерный default, что и даёт эффект сжатости при
  переносе на 2 строки). Это общее для всех 5 страниц — безопасное точечное
  улучшение типографики без нового bespoke-стиля.

### 2. `routes/register.tsx` (MODIFY)

Ответственность: registration-specific левая колонка + форма на shared UI Kit.

- Новый `leftContent` (JSX-константа или вынесенная функция в этом же файле):
  заголовок «Присоединяйтесь к сообществу моделистов» (`fontSize: 44,
  lineHeight: 1.15`, без сжатия), короткий ценностный абзац (1-2 предложения:
  зачем регистрироваться), список из 3 преимуществ — каждое: `lucide`-иконка
  в `36px` accent-кружке (`background: var(--accent)`, `color: #fff`) + текст
  (`fontSize: var(--fs-sm)`, `color: rgba(255,255,255,0.85)`). Вертикальный
  `flex flex-col gap-[20px]` вместо текущего `justify-between` — убирает
  рваную пустоту.
- Форма: заменить `<input style={inputStyle}>` на `<Input>` (проп `error`
  выставляется при клиентской валидации несовпадения паролей — существующий
  `if (password !== passwordConfirmation)` уже есть, просто подсвечиваем поля
  вместо/вместе с toast). Заменить `<button style={primaryBtn}>` на `<Button>`
  (`disabled={loading}`, содержимое — текущий текст).
- Submit-логика (`register()` вызов, `toast`, `navigate`) — не менять.

### 3. `routes/login.tsx` (MODIFY)

Ответственность: лаконичная левая колонка + форма на shared UI Kit.

- `leftContent`: заголовок «С возвращением» (`fontSize: 44, lineHeight: 1.15`)
  + одна короткая строка-подзаголовок. Без списка преимуществ.
- Форма: тот же переход `input`/`button` → `Input`/`Button`. `error` на поле
  email/password при `ApiError` 401/422 (уже есть `catch` с `toast.error` —
  добавляем локальный `boolean`-state ошибки полей, устанавливаемый в том же
  `catch`, сбрасываемый на новый submit).
- Submit-логика (`login()`, `setCurrentUser`, `navigate`) — не менять.

## Данные и потоки

Нет новых. Только клиентский UI-state (`error` boolean на полях, устанавливается
синхронно с существующей валидацией/catch, не меняет сетевые вызовы).

## Состояния для покрытия

- Default / focus / error полей формы (через `Input error` проп — фокус уже
  встроен в компонент, error триггерится существующей клиентской проверкой).
- Loading при submit (`Button disabled` + текст, как сейчас).
- Mobile (`lg:hidden` ветка `AuthShell` — форма в одну колонку, левая часть не
  рендерится) — не затронуто структурно, `leftContent` используется только в
  desktop-ветке.

## Что НЕ трогаем

- `recover.tsx`, `reset-password.tsx`, `verify-email.tsx` — используют
  `AuthShell` без `leftContent`, нулевой визуальный diff.
- Auth-логику, submit-обработку, backend, routes.
- Grid-структуру `AuthShell` (`lg:grid-cols-[1.05fr_1fr]`), фоновую
  photo+gradient подложку левой колонки.
- Mobile-брейкпоинты (форма в одну колонку уже работает, `leftContent` не
  рендерится на mobile — `hidden lg:block`).

## Backend endpoints

Не требуются. Чисто frontend UI/layout.

## Acceptance criteria

- Нет ощущения «пустая левая половина + форма впритык справа» на `/register`
  и `/login`.
- Заголовок (левая колонка на register/login, и общий h1 формы) читается
  свободно, не сжат.
- Mobile (форма в одну колонку) не затронут негативно — визуально не меняется.
- `recover`, `reset-password`, `verify-email` — визуально идентичны текущему
  состоянию (не переданы `leftContent` → старый рендер).
- Форма использует shared `Input`/`Button`, никакого нового bespoke-стиля.
- `npx tsc --noEmit` чистый.

## Manual QA

Сравнить `/register` и `/login` до/после на 1440px и 1920px (desktop, где
левая колонка видна). Проверить states полей формы: default, focus (клик в
поле), error (несовпадающие пароли на register, неверные данные на login —
если возможно симулировать без реального backend, иначе просто визуально
проверить `error` проп на `Input` через временный проп-toggle в devtools).
Проверить loading-state кнопки при submit. Проверить mobile-ширину — форма в
одну колонку, без изменений. Проверить `recover`/`reset-password`/
`verify-email` — не изменились визуально.
