# Админка: RBAC + Audit Log (фаза 1 расширения админ-панели) — Design

## Контекст

Это первая из ~7 независимых подсистем в общем запросе «расширить админку до
полного управления сайтом» (RBAC, audit log, Design System с publish/rollback,
CRUD направлений/обзоров/буста, медиаменеджер, массовые действия/CSV-экспорт,
и т.д.). Каждая подсистема получает свою design-спеку и свой implementation
plan — эта спека покрывает **только RBAC + Audit Log**.

Ключевая находка при исследовании кода: бэкенд для этой подсистемы **уже
почти готов**. Разрыв — почти целиком на фронте.

### Что уже есть на бэкенде (не трогаем, только используем)

- `App\Enums\UserRole`: `user | subscriber | moderator | admin` — 4 уровня,
  не 2.
- `App\Http\Middleware\EnsureUserRole` (алиас `role:`), уже применён в
  `backend/app/Modules/Admin/routes/api.php`:
  - `role:moderator,admin` → `moderation/queue`, `moderation/{type}/{id}/{approve,reject,revision}`,
    `reports`, `reports/{id}`, `feedback`
  - `role:admin` → все остальные admin-роуты (users, categories, listings,
    communities, plans, promocodes, banners, notifications, `audit-logs`,
    delivery, dashboard)
- `Modules\Admin\Services\AuditService::log()` — уже вызывается в 9
  контроллерах (users, posts, communities, listings, categories, banners,
  promocodes, plans, settings). Пишет в `audit_logs`
  (`user_id, action, auditable_type, auditable_id, old_values, new_values,
  ip_address, user_agent, created_at`).
- `GET /admin/audit-logs` (`AdminAuditLogController`) — уже отдаёт
  `AuditLog::with('user')->latest()->paginate()`. Ответ: `{ data: { data: [...], current_page, last_page, ... } }`
  (стандартная Laravel-пагинация).

### Что реально сломано/отсутствует (фронт)

1. `frontend/src/lib/mock.ts` `User` не несёт `role` — только вычисленный
   `isAdmin: boolean`. Модератор (`role: "moderator"`) сегодня **не проходит
   гейт `/admin` вообще** — получает экран 403, хотя бэкенд уже готов
   пускать его в очередь модерации.
2. `frontend/src/routes/admin.tsx`:
   - Гейт входа — бинарный (`isAdmin ? granted : forbidden`).
   - `navItems` не фильтруется по роли — только `isAdmin`, значит либо всё,
     либо ничего.
   - Смена роли пользователя — плоский тумблер admin/user (см.
     `toast.success(newRole === "admin" ? "Назначен суперадмином" : "Роль обновлена")`
     в текущем коде), `moderator` назначить нельзя.
   - Раздела «История изменений» (audit log) нет вообще — данные есть,
     UI отсутствует.

## Архитектура

### 1. Роль на фронте — `User.role`

`frontend/src/lib/mock.ts`:

```ts
export type UserRole = "user" | "subscriber" | "moderator" | "admin";

export interface User {
  // ...existing fields unchanged...
  isAdmin?: boolean;
  role?: UserRole; // new — server-driven; undefined only in demo-mode mocks that don't set it
}
```

`isAdmin` остаётся как есть (не убираем — используется по всему коду для
других целей: например, ссылка на /admin в TopNav). Не пытаемся вывести
`isAdmin` из `role` автоматически — оставляем оба поля независимыми, как
приходят с бэка, чтобы не трогать существующую логику `isAdmin`.

`frontend/src/lib/api/auth.ts` `mapApiUser()`: добавить
`role: (u.role as UserRole) ?? undefined` в возвращаемый объект (то же
`ApiUser.role: string` поле уже существует и используется для вычисления
`isAdmin`, просто сейчас не сохраняется как есть).

### 2. Гейт `/admin`

`frontend/src/routes/admin.tsx`, состояние `access`:

```ts
type Access = "checking" | "granted-admin" | "granted-moderator" | "forbidden";
```

Правило:
- `role === "admin"` → `granted-admin`
- `role === "moderator"` → `granted-moderator`
- иначе → `forbidden` (текущий 403-экран, без изменений)

### 3. Видимость навигации

`navItems` — добавить поле `roles: UserRole[]` на каждый пункт:

```ts
const navItems: { id: Section; label: string; icon: ...; roles: UserRole[] }[] = [
  { id: "dashboard", ..., roles: ["admin", "moderator"] }, // упрощённый вид для модератора, см. ниже
  { id: "users", ..., roles: ["admin"] },
  { id: "content", ..., roles: ["admin"] },
  { id: "ads", ..., roles: ["admin"] },
  { id: "delivery", ..., roles: ["admin"] },
  { id: "moderation", ..., roles: ["admin", "moderator"] },
  { id: "monetization", ..., roles: ["admin"] },
  { id: "categories", ..., roles: ["admin"] },
  { id: "reviews", ..., roles: ["admin"] },
  { id: "notifications", ..., roles: ["admin"] },
  { id: "analytics", ..., roles: ["admin"] },
  { id: "feedback", ..., roles: ["admin", "moderator"] },
  { id: "design", ..., roles: ["admin"] },
  { id: "settings", ..., roles: ["admin"] },
  { id: "auditLog", ..., roles: ["admin"] }, // new section, see §5
];
```

Рендер меню: `navItems.filter(i => i.roles.includes(currentRole))`.

**Это только UX-фильтр.** Реальная защита — на бэкенде (`role:` middleware,
уже есть). Если модератор дёрнет чужой admin-эндпоинт напрямую — получит 403
от API, как и сегодня. Фронт не пытается быть источником правды для прав
доступа.

Прямой переход по section-id (например, если кто-то руками поставит
`?section=users` или это как-то станет достижимо) — блокируется тем же
проверочным списком: `setSection` игнорирует id, которого нет в
отфильтрованном `navItems` для текущей роли, редиректит на `"dashboard"`
(или на `"moderation"`, если dashboard тоже недоступен модератору — но по
плану выше dashboard доступен обоим).

**Дашборд для модератора:** тот же компонент, но с усечённым набором
метрик — скрываем выручку/финансовые виджеты (`revenue`, `mrr` и т.п., какие
уже есть в `AdminDashboardController`/`DashboardSection`), оставляем только
операционные (очередь модерации, открытые жалобы). Точный список полей —
на усмотрение реализации по факту существующих виджетов; сейчас в спеке не
детализирую состав дашборда, это отдельная, не-архитектурная деталь.

### 4. Назначение ролей

В разделе «Пользователи» (`frontend/src/routes/admin.tsx`, там же, где
сейчас тумблер): заменить на `<select>` с 4 опциями —
`Пользователь / Модератор / Администратор` (**без** `Подписчик` в списке
выбора — `subscriber` выставляется бэкендом автоматически при активной
подписке, вручную через админку не назначается и не должен быть перезаписан
случайным выбором).

Существующая защита «нельзя менять собственную роль» (`me.id === u.uuid`) —
остаётся без изменений.

Бэкенд: `AdminUserController` уже принимает `role` в update и уже логирует
через `AuditService` (`admin.users.update`) — изменений на бэке не требуется,
кроме, возможно, валидации допустимых для ручной установки значений (не
принимать `subscriber` от фронта на этот эндпоинт, если для чистоты — но это
low-risk и не блокирует MVP; фиксируется как opt-in при реализации).

### 5. Audit Log — новый раздел

Новый `Section` id `"auditLog"`, label «История изменений», видим только
`admin`.

Компонент `AuditLogSection`:
- Таблица: Кто (имя + email из `.user`) / Когда (`created_at`, относительное
  + точное время в title) / Действие (`action`, строка вида
  `admin.users.update` — рендерим как есть, это уже человекочитаемо) /
  Сущность (`auditable_type` без namespace + `auditable_id`).
- Разворачиваемая строка (клик) → показывает `old_values` / `new_values` как
  список `ключ: было → стало` (не сырой JSON — проходит по ключам объекта и
  рендерит `<dl>`/строки, значения примитивов как текст; вложенные
  объекты/массивы — `JSON.stringify` **только для отображения** значения
  внутри строки, не как редактируемое поле и не как основной способ подачи
  данных — это не нарушает "no-JSON-UI", то правило про **ввод**, не про
  показ вложенных диффов).
- Пагинация — по данным ответа (`current_page`/`last_page`), кнопки
  «Назад/Вперёд».
- Клиентские фильтры (над уже загруor страницей, без серверных query-параметров
  в этой фазе): по пользователю (select из уникальных `user.name` на текущей
  странице) и по префиксу действия (select из уникальных `action.split('.')[0]`,
  т.е. "users"/"posts"/"promocodes"/...).

`frontend/src/lib/api/admin.ts` (уже существует, судя по остальным
Admin*-хелперам, добавленным Игорем): добавить
`fetchAuditLog(page?: number): Promise<{ data: AuditLogEntry[]; meta: {...} }>`
как обычный GET-обёртку над `/admin/audit-logs`.

## Данные не меняются

Никаких новых миграций/таблиц/бэкенд-эндпоинтов в этой фазе — только
фронтовая обвязка над уже существующим бэкендом. Если по факту реализации
обнаружится, что `AuditLog.user` не eager-load'ится где-то или пагинация
приходит в другом формате — фиксируется по месту, без изменения архитектуры
этой спеки.

## Тестирование / приёмка

- `tsc --noEmit` чист.
- Live-проверка на demo-стенде (роль подделывается через тестового
  пользователя с `role=moderator`, если такой есть в сидерах, либо через
  прямую БД-правку на deploy-стенде для теста):
  - Модератор видит только Дашборд (урезанный) / Модерация / Обращения,
    прямой переход на `?section=users` не даёт доступа.
  - Админ видит всё, включая новый раздел «История изменений».
  - Смена роли пользователя на "Модератор" через select → он
    действительно получает доступ при следующем логине/refresh токена.
  - Запись в audit log видна после любого CRUD-действия из уже
    залогированных 9 контроллеров (например, создать промокод → строка
    появляется).
- Overflow-пробы 360/390/430 на новом разделе audit log (тот же чек-лист,
  что и в остальной сессии).

## Не входит в эту фазу

- Audit-логирование Design System / медиаменеджера / буста и других
  будущих подсистем — добавится вместе с ними, когда до них дойдёт очередь.
- Server-side фильтры/поиск/экспорт по audit log — сейчас MVP, client-side
  над одной страницей.
- Список активных сессий модераторов, 2FA для входа в саму админку.
- Валидация "нельзя назначить subscriber вручную" на бэкенде — фиксируется
  как желательное улучшение, не блокер MVP (см. §4).
