# Тёмная тема + Welcome v2 + переименование «Клаб» → «Форум»

Большая, многослойная задача. Прежде чем выкатывать всё разом, фиксирую план и подсвечиваю места, где спека не совпадает со стеком проекта — иначе сборка упадёт.

## Несоответствия спеки и проекта (нужно решение)

1. **Стек.** Спека написана под Vite + React Router DOM + `src/pages/*` + `src/index.css`. У нас — **TanStack Start** с file-based routing (`src/routes/*`), `src/styles.css`, без `react-router-dom`, без `App.tsx`, без `src/pages/`. Создавать `src/pages/WelcomePage.tsx` и импортить `react-router-dom`/`react-router` нельзя — сборка упадёт.
   - Welcome v2 заменит существующий `src/routes/welcome.tsx` (и/или `src/routes/landing.tsx`).
   - Логика «неавторизованных редиректит на /» уже частично есть в `src/routes/index.tsx` — добавлю редирект авторизованных с `/welcome` на `/`.
   - Навигация — только `@tanstack/react-router` (`Link`, `useNavigate`).

2. **Существующий дизайн-токен слой.** В `src/styles.css` уже большой набор переменных (`--background`, `--accent`, `--r-card`, шрифты Space Grotesk/Inter/JetBrains Mono и т.д.) и shadcn-токены `@theme inline`. Полностью «заменить :root» как просит спека — снесёт shadcn и сломает половину UI. Сделаю так:
   - Добавлю **новый набор переменных** из спеки (`--bg-primary`, `--text-primary`, `--accent: #e53935` и т.д.) + светлую тему через `[data-theme='light']`.
   - **Перемапплю старые имена** на новые (`--background` → `var(--bg-primary)`, `--foreground` → `var(--text-primary)`, `--accent` → `#e53935` и т.д.), чтобы существующие компоненты автоматически перекрасились без массовой правки 50+ файлов.
   - Шрифты: подгружу Inter + IBM Plex Mono через `<link>` в `src/routes/__root.tsx` (Tailwind v4 запрещает `@import` URL в `styles.css`). Space Grotesk оставлю как fallback для display, чтобы не ломать существующий вид заголовков, либо переключу `--font-display` на Inter — уточню ниже.

3. **Темизация.** Уже есть `src/components/ThemeToggle.tsx`, который пишет класс `dark` на `<html>` и ключ `theme` в localStorage. Спека требует `data-theme="dark"/"light"` атрибут и контекст `ThemeProvider`. Сделаю:
   - Новый `src/components/ThemeProvider.tsx` с контекстом, `data-theme` атрибутом, дефолт = dark.
   - Перепишу `ThemeToggle.tsx` на использование контекста (API совместимое — те же импорты).
   - В `src/styles.css` темы будут селектиться **и** по `[data-theme='dark'/'light']`, **и** по классу `.dark` (для обратной совместимости с shadcn).
   - Обёрну приложение в `<ThemeProvider>` в `src/routes/__root.tsx`.

4. **Видео для Welcome.** Реального URL нет, спека сама помечает PLACEHOLDER. Сделаю постер-фоллбек по умолчанию (используем существующий `src/assets/cover-modelizm.jpg`), видео-блок с `onError` → постер. Без внешних URL, которые могут быть заблокированы.

5. **Акцент меняется с лаймового на красный `#e53935`.** Это глобально перекрасит все кнопки/ссылки/активные состояния. Подтверждаю: это и есть требование спеки.

6. **«Club» / «Клаб» в коде.** По проверке `rg` ранее английских/«Club» строк уже не осталось (в прошлой итерации заменили на «Форум»). Пройдусь ещё раз `rg -i 'club|клаб'` и зачищу остатки если найдутся (включая `index.html` title).

## Что делаю

### Новые файлы
- `src/components/ThemeProvider.tsx` — контекст + `data-theme` атрибут + localStorage + system preference + слушатель prefers-color-scheme.

### Изменяемые файлы
- `src/styles.css` — добавляю полный набор переменных из спеки (dark + light через `[data-theme]`), маплю старые токены (`--background`, `--foreground`, `--accent`, `--border`, `--r-card`, `--shadow-*` и т.д.) на новые значения, ставлю dark как дефолт. Сохраняю `@theme inline` блок для shadcn, переводя его на новые токены. Убираю любые `@import url(...)` шрифтов (если есть) — шрифты грузятся `<link>`.
- `src/routes/__root.tsx` — добавляю `<link>` теги для Inter + IBM Plex Mono в `head()`, оборачиваю выдачу в `<ThemeProvider>`, ставлю `data-theme="dark"` на `<html>` через inline скрипт в head чтобы убрать FOUC.
- `src/components/ThemeToggle.tsx` — перевожу на `useTheme()` из `ThemeProvider`, оставляю текущий внешний вид (Sun/Moon с rotate-анимацией).
- `src/routes/welcome.tsx` — переписываю на новый full-viewport hero: постер `cover-modelizm.jpg` + градиентные overlays, тег «Сообщество моделистов России», заголовок «МОДЕЛИЗМ Форум», подзаголовок, две CTA (Создать аккаунт → `/register`, Войти → `/login`), три stat-блока (5 000+, 12, 24/7), bouncing scroll indicator. Видео опционально: если есть `VIDEO_URL` env — рендерим `<video>` с `onError` фоллбеком на постер, иначе сразу постер. Анимация: stagger 120 ms, delay 400 ms, ease-out, без `layout`/`layoutId`. Mobile (< 480 px): постер, CTA full-width стэком.
- `src/routes/index.tsx` — если пользователь неавторизован, рендерим Welcome inline или редиректим на `/welcome`; авторизованных оставляем на ленте. (Проверю существующую логику и сделаю минимальное изменение.)
- `index.html` — обновляю `<title>` и `<html data-theme="dark">`.
- Любой остаточный `Club`/`Клаб` (если найдётся `rg`) — заменяю на «Форум».
- При необходимости — точечные правки `Logo.tsx` / `AuthShell.tsx` / footer (если где-то осталось старое название).

### Что НЕ делаю
- Не переименовываю файлы (`src/routes/*` → `src/pages/*`) — сломает routing.
- Не добавляю `react-router-dom`.
- Не переписываю 50 страниц вручную под `bg-[var(--bg-primary)]` — благодаря мапу старых токенов на новые они перекрасятся автоматически. Если после визуальной проверки где-то останется белый артефакт (например, хардкод `bg-white` в конкретном компоненте) — точечно поправлю.
- Не трогаю shadcn компоненты — они уже на токенах.

## Технический раздел

### Маппинг старых токенов
В `src/styles.css` в `:root`:
```css
--background: var(--bg-primary);
--foreground: var(--text-primary);
--card: var(--bg-elevated);
--border: var(--border-color);
--input: var(--bg-input);
--primary: var(--accent);
--primary-foreground: #ffffff;
--muted: var(--bg-tertiary);
--muted-foreground: var(--text-tertiary);
--accent-soft: rgba(229, 57, 53, 0.12);
--r-card: 14px;
--shadow-card: var(--shadow-card);
/* и т.д. */
```
Это покрывает 95% существующих компонентов без правок.

### data-theme на html
В `<head>` добавляю inline-скрипт (через `head().scripts`):
```js
(function(){var t=localStorage.getItem('theme');if(!t){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.toggle('dark',t==='dark');})()
```
Это устраняет FOUC до гидрации React.

### Шрифты
В `__root.tsx` `head().links`:
```ts
{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
{ rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap' }
```
В `styles.css`: `--font-body: 'Inter', ...; --font-mono: 'IBM Plex Mono', ...`. `--font-display` оставлю Inter (спека не выделяет display отдельно).

### Welcome page redirect
В `src/routes/index.tsx` или через beforeLoad — если в store нет `currentUserId`, редиректим на `/welcome`. (Проверю текущий код перед изменением.)

## Объём
Реалистично: ~6 файлов изменены, 1 новый. Без массовой правки 50+ страниц — за счёт перемаппинга токенов.

## Подтверждаешь?
Главные решения, которые отличаются от буквы спеки:
- (a) Маппинг старых токенов вместо ручной правки 50+ страниц — **OK?**
- (b) Видео — постер-фоллбек по умолчанию (нет реального URL) — **OK?**
- (c) Стек TanStack Start, не Vite+RRD — пути и импорты адаптирую — **OK?**
