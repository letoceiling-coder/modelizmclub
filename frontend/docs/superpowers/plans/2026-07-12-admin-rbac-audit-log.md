# Админка: RBAC + Audit Log — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Модератор (`role: "moderator"`) может войти в `/admin` и видеть только свои разделы (Дашборд-упрощённый, Модерация, Обращения); админ видит полный audit log с диффом изменений вместо мини-виджета на дашборде.

**Architecture:** Чисто фронтовые изменения поверх уже готового бэкенда (`UserRole` enum, `role:moderator,admin`/`role:admin` middleware, `AuditService::log()` в 9 контроллерах, `GET /admin/audit-logs` — всё существует и не меняется). Роль пробрасывается через существующий паттерн `mapApiUser()` → `User.role`; `/admin`-гейт и видимость навигации становятся role-aware вместо бинарного `isAdmin`; новый раздел «История изменений» строится над расширенной версией уже существующей `fetchAuditLogs()`.

**Tech Stack:** React 19, TypeScript strict, TanStack Router (file-based), Tailwind + inline CSS vars (existing `admin.tsx` convention — не Tailwind-only). Нет фронтового test-runner'а в проекте — верификация через `npx tsc --noEmit` + live-проверку на deploy-стенде (тот же паттерн, что использовался во всей сессии).

## Global Constraints

- `npx tsc --noEmit` должен быть чист после каждой задачи.
- Никакого JSON в UI администратора — значения audit-диффа рендерятся как список `ключ: было → стало`, не сырым `JSON.stringify` как основной способ подачи (см. Task 4).
- Реальная защита доступа остаётся на бэкенде (`role:` middleware) — фронтовый гейт/фильтр навигации — это только UX, не единственная линия защиты.
- Модератор при прямом обращении к чужому admin-эндпоинту получает 403 от API — это уже работает, не трогаем.
- `subscriber` не назначается вручную через UI ролей — уже так и есть (см. §0 ниже), не менять.
- Overflow-пробы 360/390/430 на новом разделе audit log (`document.documentElement.scrollWidth === innerWidth`).

---

## §0. Важное расхождение со спекой — что НЕ строим

При подготовке плана обнаружено, что часть спеки (`2026-07-12-admin-rbac-audit-log-design.md`, §4 "Назначение ролей") **уже полностью реализована**:

- `frontend/src/routes/admin.tsx:816-822` — `ROLE_OPTIONS` с 4 значениями (`user`/`subscriber`/`moderator`/`admin`), лейблы «Пользователь»/«Подписчик»/«Модератор»/«Суперадмин».
- `UsersSection` (там же, `changeRole()`) — уже `<select>` с этими 4 опциями на каждой строке пользователя, защита «нельзя менять свою роль» (`me.id === uuid`), сохранение через `updateAdminUser(uuid, { role })`, бэкенд уже логирует это действие (`admin.users.update` в `AuditService`).
- `subscriber` в selectе присутствует и назначаем вручную (спека предполагала его скрыть) — **не трогаем и не убираем**: это уже в проде, менять поведение без отдельного запроса не входит в эту задачу.

Эта часть плана **не содержит задачи на роль-select** — он не нужен. Ниже — только то, что реально отсутствует: §1 (роль на клиенте для гейта), §2 (гейт `/admin` + видимость навигации), §3 (упрощённый дашборд для модератора), §4 (полноценный раздел Audit Log).

---

### Task 1: `User.role` — пробросить роль через `mapApiUser`

**Files:**
- Modify: `frontend/src/lib/mock.ts` (после блока `phone`/`profile`/`email_verified`, добавленного ранее в этой сессии)
- Modify: `frontend/src/lib/api/auth.ts` (`mapApiUser`)

**Interfaces:**
- Consumes: `ApiUser.role?: string` (уже существует в `frontend/src/lib/api/auth.ts`, используется сегодня только для вычисления `isAdmin: u.role === "admin"`).
- Produces: `User.role?: "user" | "subscriber" | "moderator" | "admin"` — используется в Task 2 (`AdminPage` гейт) и Task 3 (дашборд).

- [ ] **Step 1: Убедиться, что баг воспроизводим — `User` не несёт роль**

Открыть `frontend/src/lib/mock.ts`, найти интерфейс `User` (после правки текущей сессии он заканчивается полем `email_verified?: boolean;`). Поля `role` там нет — `AdminPage` (Task 2) не сможет узнать роль модератора иначе как через `isAdmin`, которое — плоский булев флаг.

- [ ] **Step 2: Добавить `role` в `User`**

В `frontend/src/lib/mock.ts`, сразу после поля `email_verified?: boolean;` внутри интерфейса `User`, добавить:

```ts
  /** Server role — drives the /admin RBAC gate (Task 2) and moderator-scoped
   *  dashboard (Task 3). Undefined in most demo-mode contexts; the gate
   *  falls back to `isAdmin` there (see Task 2). */
  role?: "user" | "subscriber" | "moderator" | "admin";
```

- [ ] **Step 3: Прокинуть в `mapApiUser`**

В `frontend/src/lib/api/auth.ts`, в функции `mapApiUser` (текущий конец объекта — `email_verified: u.email_verified,`), добавить сразу после:

```ts
    role: (u.role as User["role"]) ?? undefined,
```

Итоговый конец объекта, возвращаемого `mapApiUser`, должен выглядеть так:

```ts
    phone: u.phone ?? undefined,
    profile: u.profile
      ? {
          vk_url: u.profile.vk_url ?? undefined,
          telegram_url: u.profile.telegram_url ?? undefined,
          website_url: u.profile.website_url ?? undefined,
        }
      : undefined,
    email_verified: u.email_verified,
    role: (u.role as User["role"]) ?? undefined,
  };
}
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: чисто, без ошибок в `mock.ts`/`auth.ts`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/mock.ts frontend/src/lib/api/auth.ts
git commit -m "feat(admin): thread role through mapApiUser for RBAC gate"
```

---

### Task 2: Role-aware гейт `/admin` + видимость навигации

**Files:**
- Modify: `frontend/src/routes/admin.tsx`

**Interfaces:**
- Consumes: `User.role` (Task 1).
- Produces: `type Section` gains `"auditLog"` (используется в Task 4); переменная `visibleNavItems` — отфильтрованный по роли массив `navItems`, используемая в Task 3/4 рендере сайдбара/mobile-select.

- [ ] **Step 1: Убедиться, что баг воспроизводим**

Сегодня в `frontend/src/routes/admin.tsx:73` состояние `access` — `"checking" | "granted" | "forbidden"`, а на строке 90 гейт — `selectors.currentUser(getState()).isAdmin ? "granted" : "forbidden"`. Пользователь с `role: "moderator"` (и `isAdmin: false`, т.к. `isAdmin` в `mapApiUser` = `role === "admin"`) получает `"forbidden"` — экран 403, хотя бэкенд уже пускает такого пользователя в `moderation/queue` и `feedback`.

- [ ] **Step 2: Добавить `roles` на каждый пункт `navItems` + новый пункт `auditLog`**

В `frontend/src/routes/admin.tsx`, заменить блок `type Section` (строки 49-51) и `navItems` (строки 53-66) на:

```ts
type Section =
  | "dashboard" | "users" | "content" | "ads" | "moderation" | "delivery"
  | "monetization" | "categories" | "reviews" | "notifications" | "analytics" | "design" | "feedback" | "settings"
  | "auditLog";

type AdminRole = "admin" | "moderator";

const navItems: { id: Section; label: string; icon: typeof Users; roles: AdminRole[] }[] = [
  { id: "dashboard", label: "Дашборд", icon: LayoutDashboard, roles: ["admin", "moderator"] },
  { id: "users", label: "Пользователи", icon: Users, roles: ["admin"] },
  { id: "content", label: "Контент", icon: Newspaper, roles: ["admin"] },
  { id: "ads", label: "Объявления", icon: Megaphone, roles: ["admin"] },
  { id: "delivery", label: "Доставки", icon: Truck, roles: ["admin"] },
  { id: "moderation", label: "Модерация", icon: ShieldCheck, roles: ["admin", "moderator"] },
  { id: "monetization", label: "Монетизация", icon: DollarSign, roles: ["admin"] },
  { id: "categories", label: "Категории", icon: FolderTree, roles: ["admin"] },
  { id: "reviews", label: "Обзоры", icon: Clapperboard, roles: ["admin"] },
  { id: "notifications", label: "Уведомления", icon: Bell, roles: ["admin"] },
  { id: "analytics", label: "Аналитика", icon: BarChart3, roles: ["admin"] },
  { id: "feedback", label: "Обращения", icon: Inbox, roles: ["admin", "moderator"] },
  { id: "design", label: "Design System", icon: Palette, roles: ["admin"] },
  { id: "settings", label: "Настройки", icon: Settings, roles: ["admin"] },
  { id: "auditLog", label: "История изменений", icon: Search, roles: ["admin"] },
];
```

`Search` уже импортирован из `lucide-react` в этом файле (строка 17: `import { Search, Filter, Calendar, Tag } from "lucide-react";`) — новой иконки добавлять не нужно.

- [ ] **Step 3: Role-aware гейт**

В `frontend/src/routes/admin.tsx`, заменить строку 73:

```ts
  const [access, setAccess] = useState<"checking" | "granted" | "forbidden">("checking");
```

на:

```ts
  const [access, setAccess] = useState<"checking" | "granted" | "forbidden">("checking");
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
```

И заменить строку 90 (`setAccess(selectors.currentUser(getState()).isAdmin ? "granted" : "forbidden");`) на:

```ts
      const current = selectors.currentUser(getState());
      // `role` is the source of truth when present (real API sessions);
      // demo-mode sessions only set `isAdmin` (see lib/demo-data.ts DEMO_USER),
      // so fall back to treating isAdmin as "admin" there.
      const resolvedRole: AdminRole | null =
        current.role === "admin" || current.role === "moderator"
          ? current.role
          : current.isAdmin
            ? "admin"
            : null;
      setAdminRole(resolvedRole);
      setAccess(resolvedRole ? "granted" : "forbidden");
```

- [ ] **Step 4: Отфильтрованный список пунктов навигации**

В `frontend/src/routes/admin.tsx`, сразу после блока `if (access === "forbidden") { ... }` (перед `return (` финального JSX, там где сейчас начинается `<div className="min-h-screen" ...>`), добавить:

```ts
  const visibleNavItems = navItems.filter((n) => adminRole !== null && n.roles.includes(adminRole));
```

- [ ] **Step 5: Использовать `visibleNavItems` вместо `navItems` в обоих рендерах навигации**

Заменить `navItems.map((n) => {` (строка 216, десктопный сайдбар) на `visibleNavItems.map((n) => {`.

Заменить `navItems.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)` (строка 267, мобильный select) на `visibleNavItems.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)`.

- [ ] **Step 6: Заблокировать прямой переход на недоступную секцию**

Найти определение `const [section, setSection] = useState<Section>("dashboard");` (строка 74). Сразу после блока `visibleNavItems` (Step 4), добавить эффект, который сбрасывает `section` на первый доступный пункт, если текущая секция не входит в `visibleNavItems` (защищает от случая, когда роль резолвится позже первого рендера, или кто-то насильно вызовет `setSection` с недоступным id):

```ts
  useEffect(() => {
    if (adminRole === null) return;
    if (!visibleNavItems.some((n) => n.id === section)) {
      setSection(visibleNavItems[0]?.id ?? "dashboard");
    }
  }, [adminRole, section, visibleNavItems]);
```

Разместить этот `useEffect` после объявления `visibleNavItems`, до `return (` финального JSX — эффекты в этом компоненте уже используются выше (Step 3 логика), паттерн соответствует остальному файлу.

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: чисто.

- [ ] **Step 8: Live-проверка (демо-режим — админ)**

На локальном dev-сервере (или на neeklo-стенде) зайти на `/admin` под demo-сессией (там `isAdmin: true`, `role` не задан → `resolvedRole` резолвится в `"admin"` по фолбэку из Step 3) — убедиться, что видно **все** пункты навигации, как раньше (регресс не появился).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/routes/admin.tsx
git commit -m "feat(admin): role-aware /admin gate — moderator no longer gets 403"
```

---

### Task 3: Упрощённый дашборд для модератора

**Files:**
- Modify: `frontend/src/routes/admin.tsx` (`Dashboard` function)

**Interfaces:**
- Consumes: `adminRole: AdminRole | null` (Task 2) — нужно прокинуть как проп в `<Dashboard />`.
- Produces: ничего, потребляется только рендером.

- [ ] **Step 1: Воспроизвести — сегодня дашборд одинаков для всех**

`Dashboard` (строка ~703) сегодня не принимает пропов — рендерит одинаковый набор из 6 stat-карточек, график регистраций и таблицу «Последние действия» независимо от роли. Модератору не нужны «Всего пользователей»/«Сообществ»/«Активных баннеров»/«Публикаций» (не его зона) и «Последние действия» (полный audit — только у админа, см. §0 спеки: "видно только admin").

- [ ] **Step 2: Передать `adminRole` в `<Dashboard />`**

В `frontend/src/routes/admin.tsx`, найти `if (section === "dashboard") return <Dashboard />;` (строка 322) и заменить на:

```ts
  if (section === "dashboard") return <Dashboard role={adminRole ?? "admin"} />;
```

(Фолбэк на `"admin"` чисто для типов — этот код недостижим с `adminRole === null`, т.к. рендер попадает сюда только после `access === "granted"`.)

- [ ] **Step 3: Принять проп и отфильтровать stat-карточки**

В `frontend/src/routes/admin.tsx`, найти `function Dashboard() {` (строка ~703) и заменить сигнатуру на:

```ts
function Dashboard({ role }: { role: AdminRole }) {
```

Найти массив `stats` (строка ~715-722):

```ts
  const stats = [
    { v: (data?.usersTotal ?? 0).toLocaleString("ru"), l: "Всего пользователей", icon: Users, ch: "", up: true },
    { v: (data?.communitiesTotal ?? 0).toLocaleString("ru"), l: "Сообществ", icon: Users, ch: "", up: true },
    { v: (data?.bannersActive ?? 0).toLocaleString("ru"), l: "Активных баннеров", icon: Megaphone, ch: "", up: true },
    { v: (data?.postsTotal ?? 0).toLocaleString("ru"), l: "Публикаций", icon: Newspaper, ch: "", up: true },
    { v: String(data?.moderationPending ?? 0), l: "На модерации", icon: ShieldCheck, ch: "", up: true, warn: true },
    { v: String(data?.reportsPending ?? 0), l: "Жалоб", icon: UserPlus, ch: "", up: true },
  ];
```

Заменить на:

```ts
  const allStats = [
    { v: (data?.usersTotal ?? 0).toLocaleString("ru"), l: "Всего пользователей", icon: Users, ch: "", up: true, adminOnly: true },
    { v: (data?.communitiesTotal ?? 0).toLocaleString("ru"), l: "Сообществ", icon: Users, ch: "", up: true, adminOnly: true },
    { v: (data?.bannersActive ?? 0).toLocaleString("ru"), l: "Активных баннеров", icon: Megaphone, ch: "", up: true, adminOnly: true },
    { v: (data?.postsTotal ?? 0).toLocaleString("ru"), l: "Публикаций", icon: Newspaper, ch: "", up: true, adminOnly: true },
    { v: String(data?.moderationPending ?? 0), l: "На модерации", icon: ShieldCheck, ch: "", up: true, warn: true, adminOnly: false },
    { v: String(data?.reportsPending ?? 0), l: "Жалоб", icon: UserPlus, ch: "", up: true, adminOnly: false },
  ];
  const stats = allStats.filter((s) => role === "admin" || !s.adminOnly);
```

- [ ] **Step 4: Скрыть график регистраций и «Последние действия» для модератора**

Найти блок графика — начинается с `{/* Chart */}` (строка ~758) и заканчивается перед `{/* Recent actions */}` (строка ~785). Обернуть оба блока (график + «Последние действия», строки ~758-802) в условие:

```tsx
      {role === "admin" && (
        <>
          {/* Chart */}
          <div style={{ ...card, padding: "20px", marginTop: "20px" }}>
            {/* ...existing chart JSX unchanged... */}
          </div>

          {/* Recent actions */}
          <div style={{ ...card, marginTop: "20px" }}>
            {/* ...existing "Последние действия" JSX unchanged... */}
          </div>
        </>
      )}
```

(Не переписывать внутренности блоков — только обернуть существующий JSX условием, содержимое строк остаётся как есть.)

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: чисто.

- [ ] **Step 6: Live-проверка**

- Под `role: "admin"` (или demo-фолбэк) — дашборд выглядит как раньше (все 6 карточек, график, «Последние действия»).
- Под `role: "moderator"` — только 2 карточки («На модерации», «Жалоб»), без графика и без «Последние действия».

(Тестового модератора на demo-стенде создать через прямую БД-правку `role='moderator'` на тестовом пользователе — стенд без реальной регистрации ролей; либо временно замокать `resolvedRole` в Task 2 Step 3 на `"moderator"` для визуальной проверки, откатить перед коммитом.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/routes/admin.tsx
git commit -m "feat(admin): scoped dashboard for moderator role — operational stats only"
```

---

### Task 4: Раздел «История изменений» (Audit Log)

**Files:**
- Modify: `frontend/src/lib/api/admin.ts` (новая функция + расширение типа)
- Modify: `frontend/src/routes/admin.tsx` (новый компонент `AuditLogSection`, dispatch, import)

**Interfaces:**
- Consumes: `Section` (`"auditLog"`, Task 2), `card`/`H`/`inputStyle` style-хелперы (уже в файле).
- Produces: `fetchAuditLogPage(page: number): Promise<{ entries: AuditLogDetailEntry[]; currentPage: number; lastPage: number }>` — используется только внутри `AuditLogSection`, наружу не идёт.

- [ ] **Step 1: Воспроизвести — раздела нет**

Сегодня `fetchAuditLogs()` (`frontend/src/lib/api/admin.ts:62`) отдаёт только последние 20 записей без диффа (`old_values`/`new_values` не сохраняются в `AuditEntry`) и без пагинации — используется только в мини-виджете «Последние действия» на дашборде (`Dashboard`, Task 3). Полноценного раздела с диффом и постраничной навигацией нет нигде.

- [ ] **Step 2: Расширить `admin.ts` — новый тип и функция, не трогая существующую `fetchAuditLogs`**

В `frontend/src/lib/api/admin.ts`, после существующего блока `fetchAuditLogs` (заканчивается на строке ~74, `}`), добавить:

```ts
export interface AuditLogDetailEntry {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
}

export async function fetchAuditLogPage(
  page: number,
): Promise<{ entries: AuditLogDetailEntry[]; currentPage: number; lastPage: number }> {
  const res = await api<{ data: Paginated<ApiAuditLog & { old_values?: Record<string, unknown> | null; new_values?: Record<string, unknown> | null }> }>(
    "/admin/audit-logs",
    { query: { per_page: 20, page } },
  );
  const rows = res.data?.data ?? [];
  return {
    entries: rows.map((r) => ({
      id: String(r.id ?? Math.random()),
      user: r.user?.name ?? r.user?.email ?? "—",
      action: r.action ?? "",
      target: r.auditable_type ? r.auditable_type.split("\\").pop() ?? "" : "",
      time: r.created_at ?? "",
      oldValues: r.old_values ?? null,
      newValues: r.new_values ?? null,
    })),
    currentPage: res.data?.meta?.current_page ?? page,
    lastPage: res.data?.meta?.last_page ?? page,
  };
}
```

`ApiAuditLog` и `Paginated<T>` уже определены выше в этом файле (строки 3-6 и 53-60) — не переопределять, только расширить локально через intersection-тип `& { old_values?...; new_values?... }`, как показано.

- [ ] **Step 3: Typecheck после Step 2**

Run: `cd frontend && npx tsc --noEmit`
Expected: чисто.

- [ ] **Step 4: Импортировать новые символы в `admin.tsx`**

В `frontend/src/routes/admin.tsx`, в блоке импорта из `@/lib/api/admin` (строки 19-33), добавить `fetchAuditLogPage` в список функций и `type AuditLogDetailEntry` в список типов:

```ts
import {
  fetchDashboard, fetchAuditLogs, fetchAuditLogPage, fetchAdminUsers, updateAdminUser,
  fetchModerationQueue, approveModeration, rejectModeration,
  fetchAdminPlans, updateAdminPlan,
  fetchAdminPromocodes, createPromocode, deletePromocode,
  fetchAdminBanners, updateAdminBanner, deleteAdminBanner,
  fetchAdminCategories, createAdminCategory, updateAdminCategory, deleteAdminCategory,
  fetchAdminSettings, updateAdminSettings,
  fetchAdminPosts, updateAdminPostStatus, deleteAdminPost,
  fetchAdminListings, updateAdminListingStatus, deleteAdminListing,
  broadcastNotification,
  fetchAdminFeedback, updateAdminFeedbackStatus,
  fetchAdminDeliveryStats, fetchAdminShipments, updateAdminShipment,
  type AdminUserRow, type AuditEntry, type AuditLogDetailEntry, type ModerationItem,
  type AdminCategory, type CategoryKind, type AdminSetting,
  type AdminPostRow, type AdminListingRow,
  type FeedbackRow, type FeedbackStatus,
  type AdminDeliveryStats, type AdminShipmentRow,
} from "@/lib/api/admin";
```

- [ ] **Step 5: Добавить dispatch на новую секцию**

В `frontend/src/routes/admin.tsx`, после `if (section === "design") return <DesignSystemSection />;` (строка 334), добавить:

```ts
  if (section === "auditLog") return <AuditLogSection />;
```

- [ ] **Step 6: Написать `AuditLogSection`**

В `frontend/src/routes/admin.tsx`, после функции `SettingsSection` (строка 336, `return <SettingsSection />;` затем закрывающая `}` на строке 336 — компонент `AuditLogSection` добавляется как новая функция сразу после блока `settings`, перед комментарием `// Design System — admin-only theme switcher` на строке 339), вставить:

```tsx
/* ============ AUDIT LOG ============ */
function AuditLogSection() {
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<AuditLogDetailEntry[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAuditLogPage(page)
      .then((r) => {
        if (!active) return;
        setEntries(r.entries);
        setLastPage(r.lastPage);
      })
      .catch(() => active && setEntries([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [page]);

  const userOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.user))).sort(),
    [entries],
  );
  const actionPrefixOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action.split(".")[0]).filter(Boolean))).sort(),
    [entries],
  );

  const filtered = entries.filter((e) => {
    const matchUser = userFilter === "all" || e.user === userFilter;
    const matchAction = actionFilter === "all" || e.action.startsWith(actionFilter + ".");
    return matchUser && matchAction;
  });

  const renderDiffValue = (v: unknown): string => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  const renderDiff = (entry: AuditLogDetailEntry) => {
    const oldV = entry.oldValues ?? {};
    const newV = entry.newValues ?? {};
    const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));
    if (keys.length === 0) {
      return <p style={{ fontSize: 12, color: "var(--foreground-50)" }}>Нет данных об изменении.</p>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {keys.map((k) => (
          <div key={k} style={{ fontSize: 12, color: "var(--foreground-70)" }}>
            <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{k}</span>
            {": "}
            {renderDiffValue((oldV as Record<string, unknown>)[k])}
            {" → "}
            <span style={{ color: "var(--accent)" }}>{renderDiffValue((newV as Record<string, unknown>)[k])}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <H>История изменений</H>
      <div className="flex flex-wrap" style={{ gap: "12px", marginBottom: "16px" }}>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">Все пользователи</option>
          {userOptions.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">Все действия</option>
          {actionPrefixOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        {loading ? (
          <p style={{ padding: 16, fontSize: 13, color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 16, fontSize: 13, color: "var(--foreground-50)" }}>Нет записей.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full" style={{ fontSize: "13px", minWidth: "700px" }}>
              <thead>
                <tr style={{ background: "var(--background-surface)" }}>
                  {["Кто", "Когда", "Действие", "Сущность"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <>
                    <tr
                      key={e.id}
                      onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                      style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
                    >
                      <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>{e.user}</td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-30)", fontSize: "12px" }} title={e.time}>{e.time}</td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{e.action}</td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{e.target}</td>
                    </tr>
                    {expandedId === e.id && (
                      <tr key={`${e.id}-diff`} style={{ background: "var(--background-surface)" }}>
                        <td colSpan={4} style={{ padding: "12px 16px" }}>
                          {renderDiff(e)}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between" style={{ marginTop: "12px" }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: "var(--r-card-sm)", border: "1px solid var(--border)", color: "var(--foreground-70)", opacity: page <= 1 ? 0.5 : 1 }}
        >
          ← Назад
        </button>
        <span style={{ fontSize: 12, color: "var(--foreground-50)" }}>Страница {page} из {lastPage}</span>
        <button
          onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          disabled={page >= lastPage}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: "var(--r-card-sm)", border: "1px solid var(--border)", color: "var(--foreground-70)", opacity: page >= lastPage ? 0.5 : 1 }}
        >
          Вперёд →
        </button>
      </div>
    </div>
  );
}

```

Примечание про `<>...</>` внутри `.map()` внутри `<tbody>`: React допускает фрагмент как элемент списка при наличии `key` на **первом** дочернем элементе внутри него (здесь — на `<tr key={e.id}>`); второй `<tr>` внутри того же фрагмента получает свой отдельный `key` на diff-строке. Это валидный паттерн, используется без обёрточного `<React.Fragment key=...>`, т.к. `key` уже на дочерних `<tr>`.

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: чисто.

- [ ] **Step 8: Live-проверка**

На demo/neeklo-стенде под ролью admin:
- Зайти в «История изменений» — таблица заполняется (если на стенде уже есть записи от промокодов/категорий/etc. из текущей сессии — они видны; если пусто, создать/удалить тестовый промокод в «Монетизации» и обновить раздел).
- Клик по строке — разворачивается дифф `было → стало`.
- Пагинация «Вперёд»/«Назад» работает, если записей больше 20.
- Overflow-пробы 360/390/430: `document.documentElement.scrollWidth === innerWidth`.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/api/admin.ts frontend/src/routes/admin.tsx
git commit -m "feat(admin): full audit log section — pagination, filters, diff view"
```

---

### Task 5: Финальная регрессия + документация

**Files:**
- Modify: `frontend/docs/backend-endpoints-needed.md` (если понадобится — см. Step 2)

- [ ] **Step 1: Полный typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: чисто, 0 ошибок.

- [ ] **Step 2: Проверить, нужна ли правка `backend-endpoints-needed.md`**

Эта фаза не требует новых backend-эндпоинтов (см. design-спеку, раздел «Данные не меняются») — бэкенд полностью готов заранее. Если по факту реализации Task 4 обнаружится, что `old_values`/`new_values` не приходят в ответе `GET /admin/audit-logs` (например, поле не сериализуется в `AuditLog`-модели для каких-то записей), задокументировать это как известный gap в `frontend/docs/backend-endpoints-needed.md` (новый под-раздел под существующим `## Известные проблемы (frontend)` или новый раздел, по аналогии с существующими) — **но не создавать новый отдельный файл**, только дописать в существующий.

- [ ] **Step 3: Live-регрессия на deploy-стенде**

Тот же паттерн, что использовался всей сессией (Playwright против живого стенда, 360/390/430):
- Админ видит все пункты навигации, включая «История изменений».
- Модератор (тестовая роль) видит только Дашборд (2 карточки)/Модерация/Обращения; прямой `?section=users` не даёт доступа (Task 2 Step 6 сбрасывает секцию).
- Смена роли пользователя на «Модератор» через существующий select в «Пользователи» → запись появляется в audit log.
- Существующие функции (создание промокода, изменение категории и т.п.) по-прежнему пишут в audit log и видны в новом разделе.

- [ ] **Step 4: Commit (если были правки Step 2)**

```bash
git add frontend/docs/backend-endpoints-needed.md
git commit -m "docs(admin): note any audit-log data gaps found during RBAC phase 1"
```

---

## Self-Review

**Spec coverage:**
- §1 (роль на фронте) → Task 1.
- §2 (гейт `/admin`) → Task 2 Steps 3, 6.
- §3 (видимость навигации, включая упрощённый дашборд для модератора) → Task 2 Steps 2, 4-6; Task 3.
- §4 (назначение ролей) → **уже реализовано**, задокументировано в §0, задачи не создавалось намеренно.
- §5 (Audit Log раздел, видим только admin) → Task 4 (видимость через `roles: ["admin"]` в Task 2 Step 2).
- «Не входит в эту фазу» (audit для будущих подсистем, server-side фильтры, 2FA, валидация subscriber на бэке) — ничего из этого не создано ни в одной задаче, соответствует спеке.

**Type consistency:** `AdminRole = "admin" | "moderator"` вводится в Task 2 Step 2 и используется без изменений в Task 2 Step 3, Task 3 Step 2-3. `AuditLogDetailEntry` вводится в Task 4 Step 2 и используется без переименования в Step 4, 6.

**Placeholder scan:** нет TBD/TODO; все шаги содержат конкретный код или конкретную команду проверки.
