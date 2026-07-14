# Админка: Иконки (SVG + перекраска токенами, фаза 2b) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать админу загружать кастомные монохромные SVG-иконки, назначать их на именованные UI-слоты и централизованно перекрашивать через 9 токенов UI Kit 2.0, с публикацией «для всех» + предпросмотром + откатом; на фронте — с гарантированным fallback на lucide, пока бэкенд-эндпоинты не готовы.

**Architecture:** Один модуль-стор `icon-overrides` (по образцу `config/featureFlags.ts`: `useSyncExternalStore` + module-cache + серверный fetch публичного `GET /icon-overrides` + локальный draft-оверлей). Компонент `<Icon slot=… />` читает опубликованную карту → инлайнит санитизированный SVG в `currentColor` под цветом токена, иначе рендерит дефолтную lucide-иконку слота. Назначения публикуются через существующий `PATCH /admin/settings` (`key='icon_overrides'`), история/откат — через существующий audit log. В demo-режиме весь цикл (загрузка → назначение → публикация → откат) работает локально на `localStorage`, без бэкенда.

**Tech Stack:** React 19 + TypeScript (strict), TanStack Start, Vite. Иконки: `lucide-react`. Стор: `useSyncExternalStore`. Загрузка: существующий `uploadMedia()`. Без нового рантайм-зависимостей.

## Global Constraints

- **Только фронтенд.** Бэкенд (`IconAsset`, серверная санитизация, `POST /media purpose=icon`, `GET/DELETE /admin/icon-assets`, публичный `GET /icon-overrides`) — задокументирован в `frontend/docs/backend-endpoints-needed.md` #26, делает бэкендер. Этот план его НЕ реализует.
- **Fallback обязателен и гарантирован.** Пока эндпоинты не готовы / карта пуста / сеть недоступна — каждый слот рендерит свою `defaultLucide`. Ничего не пропадает.
- **Demo-режим самодостаточен.** В `isDemoMode()` весь цикл работает на `localStorage`, без сетевых запросов к несуществующим эндпоинтам. Тот же принцип, что у `uploadMedia()` (blob) и `setFeatureFlag()` (localStorage).
- **Цвет строго из 9 токенов** (`accent | foreground | success | warning | info | danger | commercial | neutral | foreground-70`) — произвольный hex запрещён.
- **Загружаемые иконки монохромные.** Многоцветные отклоняются (на бэке — жёстко; на фронте в demo — best-effort проверка + предупреждение).
- **SVG-инлайн только санитизированной разметки.** Фронт перед вставкой проверяет `isSafeSvgMarkup()` (корень `<svg>`, нет `<script>`/`on*`/`javascript:`) как defense-in-depth поверх серверной санитизации. Никогда не инлайнить SVG, не прошедший эту проверку.
- **Роли (фаза 1 RBAC):** вкладка Design System уже `roles: ["admin"]` — модератор её не видит; новых гейтов не требуется.
- **Гейт задачи = `npx tsc --noEmit` чист + живая проверка на demo-стенде** (в проекте нет unit-тест-раннера; это устоявшийся способ верификации). Деплой стенда: `git pull origin neeklo` + `bash deploy/scripts/deploy-neeklo-frontend.sh` на `root@31.207.75.124`, стенд `/var/www/modelizmclub-neeklo`.
- **Коммит после каждой задачи**, отдельным сообщением. Пуш в ветку `neeklo`. Без разрешения пользователя — не мержить/не деплоить прод.

---

## File Structure

- `frontend/src/lib/icon-slots.ts` — **создать.** Реестр `ICON_SLOTS` (статические слоты), тип `TokenKey`, `TOKEN_OPTIONS` (label + css-var), хелперы `tokenCssVar()`, `categorySlotKey()`. Чистые данные/типы, без side-effects.
- `frontend/src/lib/safe-svg.ts` — **создать.** `isSafeSvgMarkup(svg): boolean` — клиентская проверка перед инлайном.
- `frontend/src/lib/api/icons.ts` — **создать.** Сетевые/demo обёртки: типы `IconAsset`/`IconOverrideMap`, `fetchIconOverrides()`, `fetchIconAssets()`, `uploadIconAsset()`, `deleteIconAsset()`, `publishIconOverrides()`, `fetchLastIconOverrideRollback()`.
- `frontend/src/lib/icon-overrides.ts` — **создать.** Модуль-стор (published map + draft overlay) на `useSyncExternalStore`; `useIconOverride(slotKey)`, `useAllIconOverrides()`, `loadIconOverridesFromServer()`, `setDraftOverride()`, `clearDraftOverride()`, `resetDraft()`, `getPublishedOverrides()`, применение опубликованной карты в demo из localStorage. Само-инициализируется при импорте (как `featureFlags.ts`).
- `frontend/src/components/ui/Icon.tsx` — **создать.** `<Icon slot=… />` и `<CategoryIcon categoryId name … />`.
- `frontend/src/lib/lucide-icon.ts` — **без изменений** (переиспользуется `resolveLucideIcon`).
- `frontend/src/components/layout/RightCategories.tsx` — **модифицировать** (локальный `CategoryIcon` → общий из `Icon.tsx`).
- `frontend/src/components/feed/FeedRightRail.tsx` — **модифицировать** (то же).
- `frontend/src/routes/__root.tsx` — **модифицировать** (импорт стора для бутстрапа на старте приложения).
- `frontend/src/routes/admin.tsx` — **модифицировать** (`DesignSystemSection` → добавить вкладку «Иконки»).

---

## Task 1: Реестр слотов + токены (`icon-slots.ts`)

**Files:**
- Create: `frontend/src/lib/icon-slots.ts`

**Interfaces:**
- Produces:
  - `type TokenKey = "accent" | "foreground" | "success" | "warning" | "info" | "danger" | "commercial" | "neutral" | "foreground-70"`
  - `interface IconSlot { key: string; label: string; group: "nav" | "section" | "category"; defaultLucide: string; defaultToken: TokenKey }`
  - `const ICON_SLOTS: IconSlot[]` — статические слоты (group `nav`/`section`).
  - `const TOKEN_OPTIONS: { key: TokenKey; label: string; cssVar: string }[]`
  - `function tokenCssVar(token: TokenKey): string` → `"var(--accent)"` и т.п.
  - `function categorySlotKey(categoryId: string | number): string` → `"category:<id>"`
  - `const GROUP_LABELS: Record<IconSlot["group"], string>`

- [ ] **Step 1: Создать файл с реестром и токенами**

```ts
// frontend/src/lib/icon-slots.ts
// Конечный реестр переопределяемых иконок ("слотов") + допустимые токены цвета.
// Чистые данные, без side-effects. Категории — динамические слоты (см.
// categorySlotKey), поэтому их нет в ICON_SLOTS; статические слоты (навигация,
// заголовки разделов) перечислены явно.

export type TokenKey =
  | "accent"
  | "foreground"
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "commercial"
  | "neutral"
  | "foreground-70";

export interface IconSlot {
  /** Стабильный ключ. Для статических слотов — "group.name"; для категорий — categorySlotKey(). */
  key: string;
  /** Человекочитаемо для админ-select. */
  label: string;
  group: "nav" | "section" | "category";
  /** Имя lucide-иконки по умолчанию (fallback), см. resolveLucideIcon. */
  defaultLucide: string;
  /** Токен цвета по умолчанию. */
  defaultToken: TokenKey;
}

export const GROUP_LABELS: Record<IconSlot["group"], string> = {
  nav: "Навигация",
  section: "Разделы",
  category: "Категории",
};

// Первый набор статических слотов фазы 2b. Имена lucide взяты из nav.tsx/Sidebar.
// Расширяется по мере надобности — добавление слота не ломает существующие.
export const ICON_SLOTS: IconSlot[] = [
  { key: "nav.feed", label: "Навигация — Лента", group: "nav", defaultLucide: "Newspaper", defaultToken: "foreground-70" },
  { key: "nav.ads", label: "Навигация — Каталог объявлений", group: "nav", defaultLucide: "Megaphone", defaultToken: "foreground-70" },
  { key: "nav.reviews", label: "Навигация — Обзоры", group: "nav", defaultLucide: "Clapperboard", defaultToken: "foreground-70" },
  { key: "nav.channels", label: "Навигация — Каналы", group: "nav", defaultLucide: "Radio", defaultToken: "foreground-70" },
  { key: "nav.messenger", label: "Навигация — Мессенджер", group: "nav", defaultLucide: "MessageCircle", defaultToken: "foreground-70" },
  { key: "nav.friends", label: "Навигация — Друзья", group: "nav", defaultLucide: "Users", defaultToken: "foreground-70" },
  { key: "section.directions", label: "Раздел — Направления", group: "section", defaultLucide: "Compass", defaultToken: "accent" },
  { key: "section.safe-deal", label: "Раздел — Безопасная сделка", group: "section", defaultLucide: "ShieldCheck", defaultToken: "success" },
];

export const TOKEN_OPTIONS: { key: TokenKey; label: string; cssVar: string }[] = [
  { key: "accent", label: "Акцент", cssVar: "var(--accent)" },
  { key: "foreground", label: "Основной текст", cssVar: "var(--foreground)" },
  { key: "foreground-70", label: "Приглушённый текст", cssVar: "var(--foreground-70)" },
  { key: "success", label: "Успех / зелёный", cssVar: "var(--success)" },
  { key: "warning", label: "Предупреждение", cssVar: "var(--warning)" },
  { key: "info", label: "Инфо / синий", cssVar: "var(--info)" },
  { key: "danger", label: "Опасность / красный", cssVar: "var(--danger)" },
  { key: "commercial", label: "Коммерческий / оранжевый", cssVar: "var(--accent-commercial)" },
  { key: "neutral", label: "Нейтральный", cssVar: "var(--neutral-400)" },
];

const TOKEN_CSS_VAR: Record<TokenKey, string> = TOKEN_OPTIONS.reduce(
  (acc, t) => { acc[t.key] = t.cssVar; return acc; },
  {} as Record<TokenKey, string>,
);

export function tokenCssVar(token: TokenKey): string {
  return TOKEN_CSS_VAR[token] ?? "var(--foreground)";
}

export function isTokenKey(v: string): v is TokenKey {
  return v in TOKEN_CSS_VAR;
}

export function categorySlotKey(categoryId: string | number): string {
  return `category:${categoryId}`;
}
```

- [ ] **Step 2: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок (файл ни от чего не зависит).

- [ ] **Step 3: Быстрая проверка в браузер-консоли (после следующего `vite dev` или на стенде)**

Отложенная проверка: значения `tokenCssVar("accent") === "var(--accent)"`, `categorySlotKey(7) === "category:7"`. Формально проверяется на этапе интеграции (Task 6). На этом шаге достаточно чистого tsc.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/lib/icon-slots.ts
git commit -m "feat(icons): add icon slot registry + color token definitions"
```

---

## Task 2: Клиентский SVG-guard (`safe-svg.ts`)

**Files:**
- Create: `frontend/src/lib/safe-svg.ts`

**Interfaces:**
- Produces: `function isSafeSvgMarkup(svg: string | null | undefined): boolean`

Defense-in-depth: сервер санитизирует жёстко (см. backend #26), но фронт НИКОГДА не инлайнит разметку, не прошедшую эту проверку.

- [ ] **Step 1: Создать guard**

```ts
// frontend/src/lib/safe-svg.ts
// Клиентская защита перед инлайном SVG через dangerouslySetInnerHTML.
// Это defense-in-depth поверх обязательной серверной санитизации, НЕ замена ей.
// Возвращает true только для строки, которая:
//  - после trim начинается с "<svg" и заканчивается на "</svg>";
//  - не содержит <script, <foreignObject, <iframe;
//  - не содержит inline-обработчиков onXxx=;
//  - не содержит "javascript:" и подозрительных data:-URI в атрибутах.

const FORBIDDEN_TAGS = /<\s*(script|foreignObject|iframe|object|embed|link|meta|style)\b/i;
const INLINE_HANDLER = /\son[a-z]+\s*=/i;
const JS_URI = /(javascript:|data:text\/html)/i;

export function isSafeSvgMarkup(svg: string | null | undefined): boolean {
  if (!svg || typeof svg !== "string") return false;
  const s = svg.trim();
  if (s.length === 0 || s.length > 100_000) return false;
  if (!/^<svg[\s>]/i.test(s)) return false;
  if (!/<\/svg>\s*$/i.test(s)) return false;
  if (FORBIDDEN_TAGS.test(s)) return false;
  if (INLINE_HANDLER.test(s)) return false;
  if (JS_URI.test(s)) return false;
  return true;
}
```

- [ ] **Step 2: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Смоук-проверка логики (throwaway, удалить после)**

Создать временно `frontend/scratch-safe-svg.mjs` (JS-копия логики недоступна из TS напрямую; вместо этого проверить вручную в браузер-консоли на Task 6). Здесь достаточно рассуждения по кейсам:
- `isSafeSvgMarkup('<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>')` → `true`.
- `isSafeSvgMarkup('<svg><script>alert(1)</script></svg>')` → `false` (FORBIDDEN_TAGS).
- `isSafeSvgMarkup('<svg onload="x()"></svg>')` → `false` (INLINE_HANDLER).
- `isSafeSvgMarkup('<div>no</div>')` → `false` (не начинается с `<svg`).
- `isSafeSvgMarkup(null)` → `false`.

Не оставлять scratch-файлов в коммите.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/lib/safe-svg.ts
git commit -m "feat(icons): add client-side SVG safety guard for inline rendering"
```

---

## Task 3: API-обёртки + модуль-стор icon-overrides (`api/icons.ts` + `icon-overrides.ts`)

**Files:**
- Create: `frontend/src/lib/api/icons.ts`
- Create: `frontend/src/lib/icon-overrides.ts`

**Interfaces:**
- `api/icons.ts` Produces:
  - `interface IconAsset { id: string; name: string; svg: string; createdAt?: string }`
  - `interface IconOverride { assetId: string; svg: string; token: TokenKey }`
  - `type IconOverrideMap = Record<string, IconOverride>`
  - `async function fetchIconOverrides(): Promise<IconOverrideMap>`
  - `async function fetchIconAssets(): Promise<IconAsset[]>`
  - `async function uploadIconAsset(file: File): Promise<IconAsset>`
  - `async function deleteIconAsset(id: string): Promise<void>`
  - `async function publishIconOverrides(map: IconOverrideMap): Promise<void>`
  - `async function fetchLastPublishedIconOverrides(): Promise<IconOverrideMap | null>` (для отката — предыдущее опубликованное значение из audit log; `null` если откатывать нечего/неоднозначно)
- `icon-overrides.ts` Consumes: `IconOverrideMap`, `IconOverride` из `api/icons.ts`; `TokenKey` из `icon-slots.ts`.
- `icon-overrides.ts` Produces:
  - `function useIconOverride(slotKey: string): IconOverride | null` (draft поверх published)
  - `function useIconAssetsVersion(): number` (для перерисовки библиотеки — опционально)
  - `function getPublishedOverride(slotKey: string): IconOverride | null`
  - `function setDraftOverride(slotKey: string, override: IconOverride | null): void` (null = сброс слота на дефолт в черновике)
  - `function resetDraft(): void`
  - `function getMergedMap(): IconOverrideMap` (published + draft — то, что публикуется)
  - `function applyPublishedMap(map: IconOverrideMap): void` (после успешной публикации)
  - `async function loadIconOverridesFromServer(): Promise<void>`

- [ ] **Step 1: Создать `api/icons.ts`**

```ts
// frontend/src/lib/api/icons.ts
import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { uploadMedia } from "@/lib/api/media";
import { updateAdminSettings, fetchAuditLogPage } from "@/lib/api/admin";
import { isSafeSvgMarkup } from "@/lib/safe-svg";
import type { TokenKey } from "@/lib/icon-slots";

export interface IconAsset {
  id: string;
  name: string;
  svg: string;
  createdAt?: string;
}
export interface IconOverride {
  assetId: string;
  svg: string;
  token: TokenKey;
}
export type IconOverrideMap = Record<string, IconOverride>;

// Ключи localStorage для demo-режима (нет бэкенда).
const DEMO_ASSETS_KEY = "modelizm_icon_assets";
const DEMO_OVERRIDES_KEY = "modelizm_icon_overrides";

function readDemoAssets(): IconAsset[] {
  try { return JSON.parse(localStorage.getItem(DEMO_ASSETS_KEY) || "[]"); } catch { return []; }
}
function writeDemoAssets(list: IconAsset[]): void {
  localStorage.setItem(DEMO_ASSETS_KEY, JSON.stringify(list));
}

// --- Публичная карта назначений ---

export async function fetchIconOverrides(): Promise<IconOverrideMap> {
  if (isDemoMode()) {
    try { return JSON.parse(localStorage.getItem(DEMO_OVERRIDES_KEY) || "{}"); } catch { return {}; }
  }
  try {
    const res = await api<{ data: IconOverrideMap }>("/icon-overrides", { auth: false });
    return res.data ?? {};
  } catch {
    return {}; // fallback: пустая карта → все слоты на lucide-дефолтах
  }
}

// --- Библиотека иконок ---

export async function fetchIconAssets(): Promise<IconAsset[]> {
  if (isDemoMode()) return readDemoAssets();
  const res = await api<{ data: IconAsset[] }>("/admin/icon-assets");
  return res.data ?? [];
}

// Клиентская best-effort токенизация для DEMO (на бэке — жёсткая версия).
// Убирает fill/stroke → currentColor; отклоняет очевидно многоцветные (>1 fill-цвет / градиент).
function demoTokenizeSvg(raw: string): { svg: string } | { error: string } {
  const s = raw.trim();
  if (!isSafeSvgMarkup(s)) return { error: "Файл не распознан как безопасный SVG" };
  if (/<(linearGradient|radialGradient)\b/i.test(s)) return { error: "Иконка должна быть одноцветной (обнаружен градиент)" };
  const fills = new Set(
    Array.from(s.matchAll(/fill\s*=\s*"([^"]*)"/gi))
      .map((m) => m[1].toLowerCase())
      .filter((c) => c && c !== "none" && c !== "currentcolor"),
  );
  if (fills.size > 1) return { error: "Иконка должна быть одноцветной (найдено несколько цветов)" };
  const tokenized = s
    .replace(/\sfill\s*=\s*"(?!none)[^"]*"/gi, ' fill="currentColor"')
    .replace(/\sstroke\s*=\s*"(?!none)[^"]*"/gi, ' stroke="currentColor"');
  return { svg: tokenized };
}

export async function uploadIconAsset(file: File): Promise<IconAsset> {
  if (isDemoMode()) {
    const raw = await file.text();
    const result = demoTokenizeSvg(raw);
    if ("error" in result) throw new Error(result.error);
    const asset: IconAsset = {
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name.replace(/\.svg$/i, ""),
      svg: result.svg,
      createdAt: new Date().toISOString(),
    };
    writeDemoAssets([asset, ...readDemoAssets()]);
    return asset;
  }
  // Реальный режим: бэкенд санитизирует+токенизирует и создаёт IconAsset.
  const media = await uploadMedia(file, "icon");
  // Бэкенд возвращает IconAsset в ответе confirm/upload; здесь читаем список,
  // либо (по контракту #26) POST /media purpose=icon вернёт сразу asset.
  // Контракт: uploadMedia отдаёт { uuid }, поэтому дочитываем ассет по id.
  const res = await api<{ data: IconAsset }>(`/admin/icon-assets/${media.uuid}`);
  return res.data;
}

export async function deleteIconAsset(id: string): Promise<void> {
  if (isDemoMode()) {
    writeDemoAssets(readDemoAssets().filter((a) => a.id !== id));
    return;
  }
  await api(`/admin/icon-assets/${id}`, { method: "DELETE" });
}

// --- Публикация назначений ---

export async function publishIconOverrides(map: IconOverrideMap): Promise<void> {
  if (isDemoMode()) {
    localStorage.setItem(DEMO_OVERRIDES_KEY, JSON.stringify(map));
    return;
  }
  await updateAdminSettings([{ key: "icon_overrides", value: map, group: "design" }]);
}

// Откат: предыдущее опубликованное значение icon_overrides из audit log.
// Возвращает null, если записей нет или предыдущее значение нельзя однозначно
// вычленить (батч-апдейт с другими ключами) — тогда UI прячет кнопку отката.
export async function fetchLastPublishedIconOverrides(): Promise<IconOverrideMap | null> {
  if (isDemoMode()) return null; // в demo откат не нужен — стенд одноразовый
  try {
    const page = await fetchAuditLogPage({ action: "admin.settings.update", perPage: 20 });
    for (const entry of page.items) {
      const oldVals = entry.oldValues as Record<string, unknown> | undefined;
      if (oldVals && Object.prototype.hasOwnProperty.call(oldVals, "icon_overrides")) {
        const prev = oldVals["icon_overrides"];
        if (prev && typeof prev === "object") return prev as IconOverrideMap;
        if (prev === null) return {}; // предыдущее состояние — «карта не была задана»
      }
    }
    return null;
  } catch {
    return null;
  }
}
```

> ПРИМЕЧАНИЕ для реализатора: точную форму `fetchAuditLogPage` (параметры `action`/`perPage`, поля `items`/`oldValues`) сверить с `frontend/src/lib/api/admin.ts` строки ~100–157 перед реализацией. Если сигнатура иная — адаптировать вызов, сохранив контракт `fetchLastPublishedIconOverrides(): Promise<IconOverrideMap | null>`. Это единственное место с зависимостью от фазы 1; если формат `oldValues` не позволяет однозначно вычленить `icon_overrides`, честно возвращать `null` (кнопка отката скрыта), не откатывать частично.

- [ ] **Step 2: Создать модуль-стор `icon-overrides.ts`** (шаблон — `config/featureFlags.ts`)

```ts
// frontend/src/lib/icon-overrides.ts
// Модуль-стор опубликованной карты icon_overrides + локального draft-оверлея
// (превью в браузере админа до публикации). По образцу config/featureFlags.ts.
import { useSyncExternalStore } from "react";
import { isDemoMode } from "@/lib/demo-mode";
import { fetchIconOverrides, type IconOverride, type IconOverrideMap } from "@/lib/api/icons";

const EVENT = "modelizm:icon-overrides-changed";

let published: IconOverrideMap = {};
let draft: IconOverrideMap = {};              // slotKey → override (для превью)
const draftCleared = new Set<string>();       // слоты, сброшенные на дефолт в черновике
let fetchStarted = false;

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function getPublishedOverride(slotKey: string): IconOverride | null {
  return published[slotKey] ?? null;
}

function mergedFor(slotKey: string): IconOverride | null {
  if (draftCleared.has(slotKey)) return null;    // явный сброс в черновике
  return draft[slotKey] ?? published[slotKey] ?? null;
}

export function getMergedMap(): IconOverrideMap {
  const map: IconOverrideMap = { ...published };
  for (const k of draftCleared) delete map[k];
  for (const [k, v] of Object.entries(draft)) map[k] = v;
  return map;
}

export function setDraftOverride(slotKey: string, override: IconOverride | null): void {
  if (override === null) {
    delete draft[slotKey];
    draftCleared.add(slotKey);
  } else {
    draftCleared.delete(slotKey);
    draft[slotKey] = override;
  }
  notify();
}

export function resetDraft(): void {
  draft = {};
  draftCleared.clear();
  notify();
}

export function applyPublishedMap(map: IconOverrideMap): void {
  published = map ?? {};
  draft = {};
  draftCleared.clear();
  notify();
}

export async function loadIconOverridesFromServer(): Promise<void> {
  if (typeof window === "undefined") return;
  const map = await fetchIconOverrides(); // demo → localStorage; real → GET /icon-overrides; ошибка → {}
  published = map;
  notify();
}

// Само-инициализация при импорте (как featureFlags.ts). В demo тоже грузим —
// fetchIconOverrides сам читает localStorage.
if (typeof window !== "undefined" && !fetchStarted) {
  fetchStarted = true;
  void loadIconOverridesFromServer();
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Реактивно возвращает актуальный override (draft поверх published) или null. */
export function useIconOverride(slotKey: string): IconOverride | null {
  return useSyncExternalStore(
    subscribe,
    () => mergedFor(slotKey),
    () => null, // SSR: всегда fallback на lucide
  );
}
```

> ПРИМЕЧАНИЕ: `useSyncExternalStore` со снапшотом, возвращающим новый объект каждый вызов, вызовет бесконечный цикл. Здесь `mergedFor` возвращает **ссылку** на существующий объект (`draft[k]`/`published[k]`) или `null`, а не новый объект — стабильно. Не менять на конструирование нового объекта в снапшоте.

- [ ] **Step 3: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок. Если `fetchAuditLogPage` имеет другую сигнатуру — поправить вызов согласно примечанию в Step 1.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/lib/api/icons.ts src/lib/icon-overrides.ts
git commit -m "feat(icons): add icon-overrides store + api wrappers (demo + real paths)"
```

---

## Task 4: Компонент `<Icon>` + `<CategoryIcon>` (`components/ui/Icon.tsx`)

**Files:**
- Create: `frontend/src/components/ui/Icon.tsx`

**Interfaces:**
- Consumes: `useIconOverride` из `icon-overrides.ts`; `ICON_SLOTS`, `tokenCssVar`, `categorySlotKey`, `TokenKey` из `icon-slots.ts`; `resolveLucideIcon` из `lucide-icon.ts`; `isSafeSvgMarkup` из `safe-svg.ts`.
- Produces:
  - `function Icon(props: { slot: string; className?: string; size?: number }): JSX.Element`
  - `function CategoryIcon(props: { categoryId: string | number; name?: string | null; className?: string; size?: number }): JSX.Element`

- [ ] **Step 1: Создать компонент**

```tsx
// frontend/src/components/ui/Icon.tsx
// <Icon slot> — единая точка рендера иконки для переопределяемого слота.
// Если для слота опубликован (или в превью-черновике) кастомный SVG — инлайнит
// его в currentColor под цветом токена; иначе рендерит дефолтную lucide-иконку.
// Fallback на lucide гарантирован всегда.
import { resolveLucideIcon } from "@/lib/lucide-icon";
import { isSafeSvgMarkup } from "@/lib/safe-svg";
import { useIconOverride } from "@/lib/icon-overrides";
import { ICON_SLOTS, tokenCssVar, categorySlotKey, type TokenKey } from "@/lib/icon-slots";

const SLOT_BY_KEY: Record<string, (typeof ICON_SLOTS)[number]> = ICON_SLOTS.reduce(
  (acc, s) => { acc[s.key] = s; return acc; },
  {} as Record<string, (typeof ICON_SLOTS)[number]>,
);

function InlineSvg({ svg, token, className, size }: { svg: string; token: TokenKey; className?: string; size?: number }) {
  return (
    <span
      className={className}
      aria-hidden
      style={{
        display: "inline-flex",
        color: tokenCssVar(token),
        width: size ?? undefined,
        height: size ?? undefined,
      }}
      // Разметка уже санитизирована сервером и повторно проверена isSafeSvgMarkup
      // перед этим рендером (см. вызывающие места). Инлайн нужен, чтобы SVG
      // наследовал currentColor от токена.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function LucideFallback({ lucideName, token, className, size }: { lucideName: string; token: TokenKey; className?: string; size?: number }) {
  const LucideIcon = resolveLucideIcon(lucideName);
  return <LucideIcon className={className} style={{ color: tokenCssVar(token) }} size={size} />;
}

export function Icon({ slot, className, size }: { slot: string; className?: string; size?: number }) {
  const override = useIconOverride(slot);
  const def = SLOT_BY_KEY[slot];
  const defaultLucide = def?.defaultLucide ?? "Box";
  const defaultToken: TokenKey = def?.defaultToken ?? "foreground";

  if (override && isSafeSvgMarkup(override.svg)) {
    return <InlineSvg svg={override.svg} token={override.token} className={className} size={size} />;
  }
  return <LucideFallback lucideName={defaultLucide} token={defaultToken} className={className} size={size} />;
}

// Иконка категории — динамический слот "category:<id>". Дефолт — lucide по имени
// из category.icon (текущее поведение resolveLucideIcon).
export function CategoryIcon({
  categoryId, name, className, size,
}: { categoryId: string | number; name?: string | null; className?: string; size?: number }) {
  const override = useIconOverride(categorySlotKey(categoryId));
  if (override && isSafeSvgMarkup(override.svg)) {
    return <InlineSvg svg={override.svg} token={override.token} className={className} size={size} />;
  }
  const LucideIcon = resolveLucideIcon(name);
  return <LucideIcon className={className} size={size} />;
}
```

- [ ] **Step 2: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Бутстрап стора на старте приложения (`__root.tsx`)**

Стор само-инициализируется при первом импорте. Чтобы карта грузилась при старте (а не при первом рендере `<Icon>`), добавить сайд-эффект-импорт в `frontend/src/routes/__root.tsx` рядом с существующими импортами:

```ts
import "@/lib/icon-overrides"; // bootstrap published icon-override map on app start
```

Проверить, что импорт не дублируется и стоит среди других модульных импортов вверху файла.

- [ ] **Step 4: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/components/ui/Icon.tsx src/routes/__root.tsx
git commit -m "feat(icons): add <Icon>/<CategoryIcon> with override→lucide fallback + bootstrap"
```

---

## Task 5: Подключить `<CategoryIcon>` в существующие места

**Files:**
- Modify: `frontend/src/components/layout/RightCategories.tsx` (локальный `CategoryIcon`, ~строки 11–18, использование ~строка 95)
- Modify: `frontend/src/components/feed/FeedRightRail.tsx` (локальный `CategoryIcon`, использование `<CategoryIcon name={c.icon} … />`)

**Interfaces:**
- Consumes: `CategoryIcon` из `@/components/ui/Icon`.

Замена локальных `CategoryIcon` (которые сейчас только резолвят lucide по имени) на общий, передавая `categoryId={c.id}`. Поведение без override идентично текущему (тот же lucide), поэтому визуальной регрессии быть не должно.

- [ ] **Step 1: `RightCategories.tsx` — удалить локальный `CategoryIcon`, импортировать общий**

Удалить локальное определение (строки ~11–18):
```tsx
function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ??
    Hash;
  return <Icon className={className} />;
}
```
Добавить импорт вверху:
```tsx
import { CategoryIcon } from "@/components/ui/Icon";
```
Заменить использование (строка ~95):
```tsx
<CategoryIcon categoryId={c.id} name={c.icon} className="h-[14px] w-[14px]" />
```
Если после удаления не остаётся использований `Icons`/`Hash` из lucide — убрать их из импортов, чтобы не словить `no-unused-vars`.

- [ ] **Step 2: `FeedRightRail.tsx` — то же**

Найти локальный `CategoryIcon` (использует `Icons[name] ?? Hash`), удалить его, импортировать общий:
```tsx
import { CategoryIcon } from "@/components/ui/Icon";
```
Заменить использование (сейчас `<CategoryIcon name={c.icon} className="h-[14px] w-[14px]" />`) на:
```tsx
<CategoryIcon categoryId={c.id} name={c.icon} className="h-[14px] w-[14px]" />
```
Убрать ставшие неиспользуемыми импорты (`Hash`, `* as Icons`), если больше нигде в файле не используются — проверить перед удалением (в `FeedRightRail` `Icons`/`Hash` использовались только для CategoryIcon).

- [ ] **Step 3: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок (в т.ч. никаких unused-import ошибок TS).

- [ ] **Step 4: Live-проверка (после деплоя стенда) — регрессии нет**

На `/feed`: правый рейл «Направления» показывает те же lucide-иконки категорий, что и раньше (override пустой). На страницах с `RightCategories` — то же. Скролл рейла (UI-3) не сломан.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/components/layout/RightCategories.tsx src/components/feed/FeedRightRail.tsx
git commit -m "refactor(icons): route category icons through shared <CategoryIcon> (override-aware)"
```

---

## Task 6: Вкладка «Иконки» в `DesignSystemSection` (`admin.tsx`)

**Files:**
- Modify: `frontend/src/routes/admin.tsx` (`DesignSystemSection`, ~строки 378–…; импорты вверху файла)

**Interfaces:**
- Consumes: `fetchIconAssets`, `uploadIconAsset`, `deleteIconAsset`, `publishIconOverrides`, `fetchLastPublishedIconOverrides`, типы `IconAsset`/`IconOverrideMap` из `@/lib/api/icons`; `getMergedMap`, `setDraftOverride`, `resetDraft`, `applyPublishedMap`, `getPublishedOverride` из `@/lib/icon-overrides`; `ICON_SLOTS`, `GROUP_LABELS`, `TOKEN_OPTIONS`, `categorySlotKey`, `tokenCssVar`, `type TokenKey` из `@/lib/icon-slots`; `fetchAdminCategories` из `@/lib/api/admin` (для динамических слотов категорий); `useIconOverride` для превью в списке слотов; `toast` из `@/lib/toast`; `isDemoMode`.

Раздел «Иконки» — под существующим управлением цветом внутри `DesignSystemSection` (одна страница Design System). Полностью no-JSON: загрузка файла, три `<select>`, кнопки.

- [ ] **Step 1: Добавить импорты вверху `admin.tsx`**

```tsx
import {
  fetchIconAssets, uploadIconAsset, deleteIconAsset,
  publishIconOverrides, fetchLastPublishedIconOverrides,
  type IconAsset, type IconOverrideMap,
} from "@/lib/api/icons";
import {
  getMergedMap, setDraftOverride, resetDraft, applyPublishedMap, useIconOverride,
} from "@/lib/icon-overrides";
import {
  ICON_SLOTS, GROUP_LABELS, TOKEN_OPTIONS, categorySlotKey, tokenCssVar, type TokenKey,
} from "@/lib/icon-slots";
```
(`fetchAdminCategories`, `toast`, `isDemoMode`, `useState`, `useEffect`, `useMemo` уже импортированы в `admin.tsx` — проверить и добавить недостающее.)

- [ ] **Step 2: Добавить под-компонент `IconsPanel` и отрендерить его в `DesignSystemSection`**

В конце JSX, возвращаемого `DesignSystemSection` (перед закрывающим `</div>` внешнего контейнера), добавить `<IconsPanel />`. Затем добавить сам компонент (рядом с `DesignSystemSection`):

```tsx
interface SlotOption { key: string; label: string; group: string; }

function IconsPanel() {
  const [assets, setAssets] = useState<IconAsset[]>([]);
  const [categorySlots, setCategorySlots] = useState<SlotOption[]>([]);
  const [slotKey, setSlotKey] = useState<string>(ICON_SLOTS[0]?.key ?? "");
  const [assetId, setAssetId] = useState<string>("");           // "" = по умолчанию (lucide)
  const [token, setToken] = useState<TokenKey>("foreground");
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [canRollback, setCanRollback] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Загрузка библиотеки + динамических слотов категорий.
  useEffect(() => {
    let alive = true;
    fetchIconAssets().then((a) => alive && setAssets(a)).catch(() => {});
    fetchAdminCategories("post")
      .then((cats) => {
        if (!alive) return;
        setCategorySlots(cats.map((c) => ({
          key: categorySlotKey(c.id), label: `Категория — ${c.name}`, group: "category",
        })));
      })
      .catch(() => {});
    fetchLastPublishedIconOverrides().then((prev) => alive && setCanRollback(prev !== null)).catch(() => {});
    return () => { alive = false; };
  }, []);

  const allSlots: SlotOption[] = useMemo(
    () => [
      ...ICON_SLOTS.map((s) => ({ key: s.key, label: s.label, group: GROUP_LABELS[s.group] })),
      ...categorySlots.map((s) => ({ ...s, group: GROUP_LABELS.category })),
    ],
    [categorySlots],
  );

  async function onUpload(file: File) {
    setUploading(true);
    try {
      const asset = await uploadIconAsset(file);
      setAssets((prev) => [asset, ...prev]);
      setAssetId(asset.id);
      toast.success("Иконка загружена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить иконку");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDeleteAsset(id: string) {
    try {
      await deleteIconAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      if (assetId === id) setAssetId("");
    } catch {
      toast.error("Не удалось удалить иконку");
    }
  }

  function onApply() {
    if (!slotKey) return;
    if (assetId === "") {
      setDraftOverride(slotKey, null); // сброс слота на дефолт (в превью)
      toast("Слот сброшен на иконку по умолчанию (превью)");
      return;
    }
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    setDraftOverride(slotKey, { assetId: asset.id, svg: asset.svg, token });
    toast("Применено в превью — опубликуйте, чтобы увидели все");
  }

  async function onPublish() {
    setPublishing(true);
    try {
      const map: IconOverrideMap = getMergedMap();
      await publishIconOverrides(map);
      applyPublishedMap(map); // published := map, draft очищается
      setCanRollback(true);
      toast.success(isDemoMode()
        ? "Опубликовано (demo — только в этом браузере)"
        : "Иконки опубликованы для всех");
    } catch {
      toast.error("Не удалось опубликовать");
    } finally {
      setPublishing(false);
    }
  }

  async function onRollback() {
    try {
      const prev = await fetchLastPublishedIconOverrides();
      if (prev === null) { setCanRollback(false); return; }
      await publishIconOverrides(prev);
      applyPublishedMap(prev);
      toast.success("Откат выполнен");
    } catch {
      toast.error("Не удалось откатить");
    }
  }

  return (
    <div style={{ ...card, padding: 24, maxWidth: 760, marginTop: 20 }}>
      <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--foreground)", marginBottom: 4 }}>
        Иконки
      </h4>
      <p style={{ fontSize: 12, color: "var(--foreground-50)", marginBottom: 16 }}>
        Загрузите монохромный SVG, назначьте на место в интерфейсе и выберите цвет из палитры токенов.
        Превью применяется только у вас; «Опубликовать» — для всех пользователей.
      </p>

      {/* Библиотека */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground-70)", marginBottom: 8 }}>Библиотека</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 8 }}>
          {assets.map((a) => (
            <div key={a.id} title={a.name}
              style={{
                position: "relative", aspectRatio: "1", display: "grid", placeItems: "center",
                border: `1px solid ${assetId === a.id ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 10, cursor: "pointer", color: "var(--foreground)",
              }}
              onClick={() => setAssetId(a.id)}
            >
              <span aria-hidden style={{ width: 22, height: 22, display: "inline-flex" }}
                dangerouslySetInnerHTML={{ __html: isSafeSvgMarkup(a.svg) ? a.svg : "" }} />
              <button type="button" aria-label="Удалить" onClick={(e) => { e.stopPropagation(); void onDeleteAsset(a.id); }}
                style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: 6,
                  background: "var(--background-surface)", color: "var(--foreground-50)", fontSize: 12, lineHeight: "16px" }}>
                ×
              </button>
            </div>
          ))}
          <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
            style={{ aspectRatio: "1", border: "1px dashed var(--border)", borderRadius: 10,
              color: "var(--foreground-50)", fontSize: 12, opacity: uploading ? 0.6 : 1 }}>
            {uploading ? "…" : "+ SVG"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/svg+xml,.svg" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }} />
      </div>

      {/* Назначение */}
      <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--foreground-70)" }}>Слот (место в интерфейсе)</span>
          <select value={slotKey} onChange={(e) => setSlotKey(e.target.value)} style={selectStyle}>
            {allSlots.map((s) => <option key={s.key} value={s.key}>{s.group} · {s.label}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--foreground-70)" }}>Иконка</span>
          <select value={assetId} onChange={(e) => setAssetId(e.target.value)} style={selectStyle}>
            <option value="">По умолчанию (lucide)</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--foreground-70)" }}>Цвет (токен)</span>
          <select value={token} onChange={(e) => setToken(e.target.value as TokenKey)} style={selectStyle}>
            {TOKEN_OPTIONS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={onApply}
          style={{ justifySelf: "start", padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: "1px solid var(--accent)", color: "var(--accent)", background: "var(--accent-soft)" }}>
          Применить (превью)
        </button>
      </div>

      {/* Публикация */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" disabled={publishing} onClick={onPublish}
          style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: "var(--accent)", color: "var(--accent-foreground)", opacity: publishing ? 0.6 : 1 }}>
          {publishing ? "Публикация…" : "Опубликовать для всех"}
        </button>
        <button type="button" onClick={resetDraft}
          style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500,
            border: "1px solid var(--border)", color: "var(--foreground-70)" }}>
          Сбросить превью
        </button>
        {canRollback && (
          <button type="button" onClick={onRollback}
            style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500,
              border: "1px solid var(--border)", color: "var(--foreground-70)" }}>
            Откатить последнее изменение
          </button>
        )}
      </div>
    </div>
  );
}
```

> ПРИМЕЧАНИЕ: `card` — уже существующий инлайн-стиль-объект в `admin.tsx` (используется в `DesignSystemSection`/`SettingsSection`). `selectStyle` — если такого общего объекта в файле нет, объявить локально в `IconsPanel`: `const selectStyle: React.CSSProperties = { height: 38, padding: "0 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: 13 };`. Сверить наличие `useRef` в импортах React (добавить, если нет). `fetchAdminCategories("post")` — сверить, что `"post"` — валидный `CategoryKind` (см. `admin.ts`); если категории объявлений нужны отдельно — использовать соответствующий kind.

- [ ] **Step 3: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок. Устранить возможные unused-imports, несоответствия `CategoryKind`, отсутствие `useRef`/`selectStyle`/`card` согласно примечанию.

- [ ] **Step 4: Deploy + live-проверка на demo-стенде**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM && git push origin neeklo
ssh root@31.207.75.124 "cd /var/www/modelizmclub-neeklo && git pull origin neeklo && bash deploy/scripts/deploy-neeklo-frontend.sh"
```
Затем в браузере (demo-режим стенда) в `/admin` → Design System → раздел «Иконки»:
- Загрузить валидный монохромный SVG → появляется в библиотеке (в `currentColor`).
- Загрузить многоцветный SVG / с градиентом → тост-ошибка «должна быть одноцветной», в библиотеку не попадает.
- Выбрать слот «Раздел — Направления», выбранную иконку, токен «Успех/зелёный» → «Применить» → превью: на `/feed` иконка раздела «Направления» меняется у меня (в demo published читается из localStorage; проверить, что после «Опубликовать» иконка сохраняется после reload).
- Слот категории: выбрать «Категория — …», применить+опубликовать → в правом рейле `/feed` иконка этой категории заменяется на загруженную в цвете токена.
- Сменить токен + опубликовать → цвет иконки меняется.
- «Сбросить превью» → возвращает опубликованное состояние.
- Слот → «По умолчанию (lucide)» → Применить+Опубликовать → иконка возвращается к lucide.
- Overflow-пробы 360/390/430 на разделе «Иконки» (сетка библиотеки и селекты не ломают вёрстку).
- Fallback: очистить `localStorage["modelizm_icon_overrides"]` (demo) → все слоты снова lucide, ничего не пропало.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/routes/admin.tsx
git commit -m "feat(icons): admin Design System «Иконки» tab — upload, assign, preview, publish, rollback"
```

---

## Self-Review (заполнено при написании плана)

**1. Spec coverage:**
- Загрузка кастомных SVG в библиотеку → Task 3 (`uploadIconAsset`) + Task 6 (UI). ✓
- «Загрузил → выбрал место → применил» → Task 6 (три селекта + «Применить»). ✓
- Централизованная перекраска через токены, меняется у всех → Task 3 (`publishIconOverrides`) + Task 4 (`tokenCssVar` в рендере) + Task 6 (публикация). ✓
- Опора строго на 9 токенов, не произвольный hex → Task 1 (`TOKEN_OPTIONS`, `TokenKey`). ✓
- Только selects/inputs/кнопки, без JSON → Task 6 (весь UI). ✓
- Реестр слотов (не полная замена) → Task 1 + Task 4/5. ✓
- Мини-библиотека сейчас, без ожидания медиаменеджера → Task 3 (demo localStorage + real `POST /media`). ✓
- Монохром-ограничение, отклонение многоцветных → Task 3 (`demoTokenizeSvg`) + backend #26 (реальный режим). ✓
- Предпросмотр (только у админа) → Task 3 (draft overlay) + Task 6. ✓
- Откат последнего изменения, скрыт если нечего → Task 3 (`fetchLastPublishedIconOverrides`) + Task 6 (`canRollback`). ✓
- Fallback на lucide гарантирован → Task 4 (`<Icon>`/`<CategoryIcon>`). ✓
- Demo-режим самодостаточен → Task 3 (все demo-ветки). ✓
- SVG-безопасность на фронте → Task 2 (`isSafeSvgMarkup`), применяется в Task 4/6. ✓
- Иконки категорий через слот `category:<id>` → Task 1 (`categorySlotKey`) + Task 4/5/6. ✓
- Роли (только admin видит Design System) → используется существующий гейт, новых задач не нужно. ✓

**2. Placeholder scan:** Явных TBD/TODO в шагах нет. Два «ПРИМЕЧАНИЯ для реализатора» указывают на конкретную сверку сигнатур (`fetchAuditLogPage`, `card`/`selectStyle`/`CategoryKind`) — это не placeholder, а требование сверить реальную сигнатуру перед использованием, с указанием, что делать в каждом исходе.

**3. Type consistency:** `IconOverride`/`IconOverrideMap`/`IconAsset` определены в Task 3 и используются одинаково в Task 4/6. `TokenKey` — Task 1, консистентно везде. `categorySlotKey`/`tokenCssVar` — Task 1, вызовы совпадают. `setDraftOverride(slotKey, null)` для сброса — определено в Task 3, используется в Task 6. Store snapshot возвращает стабильную ссылку (примечание в Task 3 Step 2) — консистентно с требованием `useSyncExternalStore`.

**Известные зависимости от реального кода (сверить при реализации, не гадать):** сигнатура `fetchAuditLogPage` и формат `oldValues`/`items` (Task 3); наличие `card`/`selectStyle`/`useRef` и валидный `CategoryKind` в `admin.tsx` (Task 6). В каждом месте плана указано, что делать при несоответствии.
