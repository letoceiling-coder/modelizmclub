# Единый механизм заявок «Создать канал/сообщество» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать пользователю единый frontend-путь «хочу свой канал/сообщество» — форма заявки, CTA на чужих страницах, пункты в настройках, admin-обзор заявок — demo-first, с документированием недостающего бэкенда.

**Architecture:** Один общий API-слой (`entity-requests.ts`, demo-first) и один параметризованный компонент формы (`EntityRequestForm`, `kind: "channel"|"community"`) переиспользуются из всех точек входа (страницы-детали, настройки) и админки. Всё работает против demo-режима; реальные эндпоинты (обзор заявок, approve→создать→назначить-владельца, роль owner) документируются в `backend-endpoints-needed.md`, не кодятся.

**Tech Stack:** TanStack Start/React 19/TypeScript strict, TanStack Router (`createFileRoute`, `Link`), lucide-react, inline-style + CSS-переменные (паттерн проекта), `@/lib/api/client` `api()`, `@/lib/demo-mode` `isDemoMode()`, `@/lib/toast`.

## Global Constraints

- **Frontend-only.** Ни строки backend-кода. Все недостающие эндпоинты — в `frontend/docs/backend-endpoints-needed.md` (§27), не реализуются.
- **Demo-first:** каждая сетевая функция начинается с `if (isDemoMode()) return demoX();` (паттерн `communities.ts`). На `neeklo.modelizmclub.ru` всегда demo по хосту — реальные ветки не выполняются, но должны быть корректно типизированы.
- **Никаких выдуманных полей.** Форма сообщества = ровно поля `ApplyCommunityRequest` (`proposed_name` min3/max120, `description` optional/max5000, `category_id`). Форма канала = поля модели `Channel` (`name`, `description`, `category`-строка). `kind` канала (official/brand/…) в форму заявителя НЕ входит.
- **Не фабрикуем сущность локально при успехе** — apply показывает только тост «Заявка отправлена на рассмотрение», ничего не создаёт в стейте.
- **Плюрализация фиксированная:** `community → communities`, `channel → channels` (не наивное `+s`).
- **Мобильная адаптация обязательна** (вьюпорты 360/390/430) для формы и всех новых экранов; форма — не «десктопное окно впритык».
- В проекте **нет фронтенд-теста-раннера** — верификация каждой задачи = `npx tsc --noEmit` чист + ручная/живая проверка в браузере (как во всех планах этой сессии). Финальная задача — живая регрессия на neeklo + деплой.
- Spec: `frontend/docs/superpowers/specs/2026-07-14-entity-creation-requests-design.md`. Аудит: `docs/communities-channels-ownership-audit.md`.

---

## File Structure

- **Create:** `src/lib/api/entity-requests.ts` — единый API-слой заявок (типы + функции, demo-first).
- **Modify:** `src/lib/demo-data.ts` — demo-функции заявок и категорий сообществ.
- **Modify:** `frontend/docs/backend-endpoints-needed.md` — §27 с выделенными 🔴-звеньями.
- **Create:** `src/components/entity-requests/EntityRequestForm.tsx` — общая форма-модалка.
- **Modify:** `src/routes/channel.$id.tsx` — CTA «Хочу свой канал».
- **Modify:** `src/routes/communities.$id.tsx` — CTA «Хочу своё сообщество».
- **Create:** `src/routes/settings.spaces.tsx` — раздел настроек «Мой канал и сообщество».
- **Modify:** `src/components/settings/SettingsNav.tsx` — строка навигации.
- **Modify:** `src/routes/admin.tsx` — секция «Заявки».

---

### Task 1: API-слой + demo-данные + backend-doc §27

**Files:**
- Create: `frontend/src/lib/api/entity-requests.ts`
- Modify: `frontend/src/lib/demo-data.ts`
- Modify: `frontend/docs/backend-endpoints-needed.md`

**Interfaces:**
- Produces: типы `EntityKind = "channel" | "community"`, `RequestStatus = "pending" | "approved" | "rejected"`, `EntityRequest`, `CommunityCategoryOption`; функции `fetchCommunityCategories()`, `applyCommunity({proposedName,description?,categoryId})`, `applyChannel({name,description?,category})`, `fetchMyEntityRequests()`, `fetchEntityRequests(status?)`, `approveEntityRequest(kind,id)`, `rejectEntityRequest(kind,id,reason?)`. Задачи 2/4/5 импортируют их по этим точным именам.
- Consumes: `api` (`@/lib/api/client`), `isDemoMode` (`@/lib/demo-mode`), новые demo-функции (этой же задачи).

- [ ] **Step 1: Создать `entity-requests.ts`**

Создай `frontend/src/lib/api/entity-requests.ts`:

```ts
import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import {
  demoEntityRequests,
  demoMyEntityRequests,
  demoDecideEntityRequest,
  demoCommunityCategories,
} from "@/lib/demo-data";

export type EntityKind = "channel" | "community";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface EntityRequest {
  id: string;
  kind: EntityKind;
  proposedName: string;
  description: string | null;
  category: string;
  status: RequestStatus;
  createdAt: string;
  applicant: { id: string; name: string; slug?: string };
}

export interface CommunityCategoryOption {
  id: number;
  name: string;
  slug: string;
}

const KIND_SEGMENT: Record<EntityKind, string> = {
  community: "communities",
  channel: "channels",
};

export async function fetchCommunityCategories(): Promise<CommunityCategoryOption[]> {
  if (isDemoMode()) return demoCommunityCategories();
  const res = await api<{ data: { id: number; name: string; slug: string }[] }>("/categories/communities");
  return (res.data ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
}

export async function applyCommunity(input: { proposedName: string; description?: string; categoryId: number }): Promise<void> {
  if (isDemoMode()) return;
  await api("/communities/apply", {
    method: "POST",
    json: {
      proposed_name: input.proposedName,
      description: input.description || null,
      category_id: input.categoryId,
    },
  });
}

export async function applyChannel(input: { name: string; description?: string; category: string }): Promise<void> {
  if (isDemoMode()) return;
  // Documented, not yet implemented — see backend-endpoints-needed.md §27.
  await api("/channels/apply", {
    method: "POST",
    json: {
      name: input.name,
      description: input.description || null,
      category: input.category,
    },
  });
}

export async function fetchMyEntityRequests(): Promise<EntityRequest[]> {
  if (isDemoMode()) return demoMyEntityRequests();
  const res = await api<{ data: EntityRequest[] }>("/me/entity-requests");
  return res.data ?? [];
}

export async function fetchEntityRequests(status?: RequestStatus): Promise<EntityRequest[]> {
  if (isDemoMode()) return demoEntityRequests(status);
  const [communities, channels] = await Promise.all([
    api<{ data: EntityRequest[] }>("/admin/communities/applications", { query: { status } }).catch(() => ({ data: [] as EntityRequest[] })),
    api<{ data: EntityRequest[] }>("/admin/channels/applications", { query: { status } }).catch(() => ({ data: [] as EntityRequest[] })),
  ]);
  return [...(communities.data ?? []), ...(channels.data ?? [])];
}

export async function approveEntityRequest(kind: EntityKind, id: string): Promise<void> {
  if (isDemoMode()) { demoDecideEntityRequest(id); return; }
  await api(`/admin/${KIND_SEGMENT[kind]}/applications/${id}/approve`, { method: "POST" });
}

export async function rejectEntityRequest(kind: EntityKind, id: string, reason?: string): Promise<void> {
  if (isDemoMode()) { demoDecideEntityRequest(id); return; }
  await api(`/admin/${KIND_SEGMENT[kind]}/applications/${id}/reject`, { method: "POST", json: { reason } });
}
```

- [ ] **Step 2: Добавить demo-функции в `demo-data.ts`**

В конец `frontend/src/lib/demo-data.ts` добавь:

```ts
// ---- Entity creation requests (Channel / Community) — demo ----
import type { EntityRequest, RequestStatus, CommunityCategoryOption } from "@/lib/api/entity-requests";

let demoRequestsList: EntityRequest[] = [
  { id: "req-1", kind: "community", proposedName: "RC-моделисты Краснодара", description: "Хотим отдельное сообщество по нашему городу, чтобы не засорять общий чат Автомоделей.", category: "Автомодели", status: "pending", createdAt: "2026-07-13T10:00:00Z", applicant: { id: "u2", name: "Сергей ДВС", slug: "u2" } },
  { id: "req-2", kind: "channel", proposedName: "Мастерская стендовых моделей", description: "Канал про сборку и покраску стендовых моделей.", category: "Стендовые модели", status: "pending", createdAt: "2026-07-13T12:30:00Z", applicant: { id: "u3", name: "Андрей Самолёты", slug: "u3" } },
];

export function demoEntityRequests(status?: RequestStatus): EntityRequest[] {
  return status ? demoRequestsList.filter((r) => r.status === status) : demoRequestsList;
}

export function demoMyEntityRequests(): EntityRequest[] {
  return [];
}

export function demoDecideEntityRequest(id: string): void {
  demoRequestsList = demoRequestsList.filter((r) => r.id !== id);
}

export function demoCommunityCategories(): CommunityCategoryOption[] {
  return [
    { id: 1, name: "Автомодели", slug: "avtomodeli" },
    { id: 2, name: "Самолёты", slug: "samolyoty" },
    { id: 3, name: "Стендовые модели", slug: "stendovye-modeli" },
    { id: 4, name: "Квадрокоптеры", slug: "kvadrokoptery" },
    { id: 5, name: "Корабли", slug: "korabli" },
  ];
}
```

(`import type` в середине файла допустимо — TS-компилятор его вынесет; тип-импорт полностью стирается, рантайм-цикла demo-data → entity-requests нет.)

- [ ] **Step 3: Добавить §27 в `backend-endpoints-needed.md`**

В конец `frontend/docs/backend-endpoints-needed.md` добавь:

```markdown
## 27. Заявки на создание Канала / Сообщества (frontend готов, бэкенд нужен)

Фронт (форма заявки, CTA «Хочу свой», настройки, admin-обзор «Заявки»)
реализован demo-first. Реальный режим включится сам при готовом бэке.
Аудит: `docs/communities-channels-ownership-audit.md`.

### 🔴 CRITICAL — approve → создать сущность → назначить владельца
Без этого фича не работает даже при готовом фронте.

- **Сообщество:** одобрение `CommunityApplication` должно СОЗДАВАТЬ `Community`
  (`created_by = applicant`, `status = active`, `slug = CommunityService::uniqueSlug(name)`)
  и attach заявителя ВЛАДЕЛЬЦЕМ в `community_members`. Для этого добавить
  значение `owner` в enum `App\Enums\CommunityMemberRole` (сейчас только
  `member`/`moderator`). Текущий `ModerationService::approve` для `Community`
  лишь флипает `status` существующей записи и никого не назначает — разрыв.
- **Канал:** одобрение должно СОЗДАВАТЬ `Channel` с `owner_id = applicant`.

### 🔴 CRITICAL — admin-стек обзора заявок
- **Сообщество:** `GET /admin/communities/applications?status=` (список),
  `POST /admin/communities/applications/{id}/approve`,
  `POST /admin/communities/applications/{id}/reject` (пишет
  `moderator_comment`, `reviewed_by`, `reviewed_at` — поля модели уже есть).
  Сейчас `community_applications` пишется через `POST /communities/apply`, но
  **никто не читает** (нет роута/контроллера).
- **Канал:** весь стек новый — таблица+модель `channel_applications` (по
  образцу `community_applications`), `POST /channels/apply` (+guard «уже
  pending»), `GET /admin/channels/applications`,
  `POST /admin/channels/applications/{id}/{approve|reject}`.

### Контракт ответа для фронта (все list-эндпоинты)
`GET .../applications` и `GET /me/entity-requests` должны вернуть
`{ data: EntityRequest[] }`, где `EntityRequest`:
`{ id: string, kind: "channel"|"community", proposedName, description|null,
category (имя категории строкой), status: "pending"|"approved"|"rejected",
createdAt (ISO), applicant: { id, name, slug? } }`.

### 🟡 Прочее
- Подключить `applyCommunity` фронта к **существующему** `POST /communities/apply`
  (guard «уже pending» бэк уже отдаёт `422` с ключом `application`).
- `GET /me/entity-requests` — свои заявки со статусом (для «на рассмотрении»);
  может агрегировать community+channel.
- «Мои сообщества, где я владелец» — для «Моё сообщество» в настройках и для
  скрытия CTA у владельца (сейчас владение сообществом на фронте неопределимо:
  роли owner нет, `created_by` не отдаётся в `CommunityResource`).

### 🟢 Уже существует
- `GET /categories/communities` (`CommunityCategoryTreeController`) — для пикера
  категорий в форме сообщества; нужен только фронт-фетч (сделан в §A фронта).
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api/entity-requests.ts frontend/src/lib/demo-data.ts frontend/docs/backend-endpoints-needed.md
git commit -m "feat(entity-requests): API layer + demo data + backend needs doc"
```

---

### Task 2: Компонент формы заявки `EntityRequestForm`

**Files:**
- Create: `frontend/src/components/entity-requests/EntityRequestForm.tsx`

**Interfaces:**
- Consumes: `applyChannel`, `applyCommunity`, `fetchCommunityCategories`, `type EntityKind`, `type CommunityCategoryOption` (Task 1); `toast` (`@/lib/toast`).
- Produces: `EntityRequestForm({ kind, onClose, onSubmitted }: { kind: EntityKind; onClose: () => void; onSubmitted: () => void })`. Задачи 3 и 4 монтируют его по этому имени/пропсам.

- [ ] **Step 1: Создать компонент**

Создай `frontend/src/components/entity-requests/EntityRequestForm.tsx`:

```tsx
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  applyChannel, applyCommunity, fetchCommunityCategories,
  type EntityKind, type CommunityCategoryOption,
} from "@/lib/api/entity-requests";

interface Props {
  kind: EntityKind;
  onClose: () => void;
  onSubmitted: () => void;
}

const TITLE: Record<EntityKind, string> = {
  channel: "Заявка на создание канала",
  community: "Заявка на создание сообщества",
};

const inputStyle = {
  background: "var(--background-surface)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
} as const;

export function EntityRequestForm({ kind, onClose, onSubmitted }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");            // channel: free string
  const [categoryId, setCategoryId] = useState<number | "">(""); // community
  const [cats, setCats] = useState<CommunityCategoryOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (kind !== "community") return;
    fetchCommunityCategories().then((list) => {
      setCats(list);
      if (list.length > 0) setCategoryId(list[0].id);
    }).catch(() => {});
  }, [kind]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const submit = async () => {
    if (name.trim().length < 3) { toast.error("Название — минимум 3 символа"); return; }
    setSubmitting(true);
    try {
      if (kind === "community") {
        if (!categoryId) { toast.error("Выберите категорию"); setSubmitting(false); return; }
        await applyCommunity({ proposedName: name.trim(), description: description.trim() || undefined, categoryId: Number(categoryId) });
      } else {
        if (!category.trim()) { toast.error("Укажите тематику"); setSubmitting(false); return; }
        await applyChannel({ name: name.trim(), description: description.trim() || undefined, category: category.trim() });
      }
      toast.success("Заявка отправлена на рассмотрение");
      onSubmitted();
    } catch (e) {
      const already = e instanceof Error && /рассмотрении|pending|application/i.test(e.message);
      toast.error(already ? "У вас уже есть заявка на рассмотрении" : "Не удалось отправить заявку");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col overflow-hidden rounded-t-[20px] sm:max-w-[520px] sm:rounded-[16px]"
        style={{ background: "var(--background-elevated)", border: "1px solid var(--border)", maxHeight: "90dvh" }}
      >
        <header className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <h2 className="flex-1 text-[16px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
            {TITLE[kind]}
          </h2>
          <button
            type="button" aria-label="Закрыть" onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground-70)" }}
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Название</span>
            <input
              value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
              placeholder={kind === "channel" ? "Название канала" : "Название сообщества"}
              className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
              Описание <span style={{ color: "var(--foreground-50)" }}>(необязательно)</span>
            </span>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} rows={3}
              placeholder="Коротко о теме"
              className="resize-none rounded-[10px] border px-3 py-2 text-[14px] outline-none" style={inputStyle}
            />
          </label>

          {kind === "community" ? (
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Категория</span>
              <select
                value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}
                className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle}
              >
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Тематика</span>
              <input
                value={category} onChange={(e) => setCategory(e.target.value)} maxLength={120}
                placeholder="Например: Стендовые модели"
                className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle}
              />
            </label>
          )}
        </div>

        <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <button
            type="button" onClick={submit} disabled={submitting}
            className="h-12 w-full rounded-[12px] text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {submitting ? "Отправляем…" : "Отправить заявку"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок (компонент не смонтирован — проверяется только само собой типами).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/entity-requests/EntityRequestForm.tsx
git commit -m "feat(entity-requests): shared EntityRequestForm modal"
```

---

### Task 3: CTA «Хочу свой» на страницах канала и сообщества

**Files:**
- Modify: `frontend/src/routes/channel.$id.tsx`
- Modify: `frontend/src/routes/communities.$id.tsx`

**Interfaces:**
- Consumes: `EntityRequestForm` (Task 2).

- [ ] **Step 1: Канал — импорт + состояние**

В `frontend/src/routes/channel.$id.tsx`, добавь импорт рядом с другими компонент-импортами (после строки `import { VideoUploadField } ...` / `import { uploadMedia } ...` — в любом месте блока импортов):

```ts
import { EntityRequestForm } from "@/components/entity-requests/EntityRequestForm";
```

В компоненте `ChannelPage` (начинается `function ChannelPage() {`, строка ~47), сразу после строки `const [showOwnerView, setShowOwnerView] = useState<boolean>(false);` добавь:

```ts
  const [requestOpen, setRequestOpen] = useState(false);
```

- [ ] **Step 2: Канал — CTA после блока подписки**

Найди закрытие блока кнопок подписки/владельца (после блока `{channel.isOwner && (…Вы — владелец канала…)}`):

```tsx
                    Вы — владелец канала
                  </div>
                )}
              </div>
```

и вставь СРАЗУ ПОСЛЕ этого `</div>`:

```tsx

              {!channel.isOwner && (
                <button
                  type="button"
                  onClick={() => setRequestOpen(true)}
                  className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-[12px] border text-[14px] font-semibold transition-colors hover:bg-[var(--background-surface)]"
                  style={{ borderColor: "var(--border)", color: "var(--foreground-70)" }}
                >
                  Хочу свой канал
                </button>
              )}
```

- [ ] **Step 3: Канал — монтирование формы**

`ChannelPage`'s основной `return` открывается `<AppLayout rightColumn={false}>` (строка ~48) и закрывается `</AppLayout>` (строка ~220) — это НЕ тот `</AppLayout>` из ранней loading-ветки (строка ~28). Вставь блок формы непосредственно ПЕРЕД закрывающим `</AppLayout>` основного return-а `ChannelPage`:

```tsx
      {requestOpen && (
        <EntityRequestForm
          kind="channel"
          onClose={() => setRequestOpen(false)}
          onSubmitted={() => setRequestOpen(false)}
        />
      )}
    </AppLayout>
```

(Т.е. old_string для правки — этот финальный `</AppLayout>`, new_string — блок формы + `</AppLayout>`. Форма `position:fixed`, от места монтирования не зависит; важно лишь, чтобы рендерилась при `requestOpen` внутри JSX `ChannelPage`.)

- [ ] **Step 4: Сообщество — импорт + состояние**

В `frontend/src/routes/communities.$id.tsx`, добавь импорт в блок импортов:

```ts
import { EntityRequestForm } from "@/components/entity-requests/EntityRequestForm";
```

В компоненте `CommunityDetailPage` (строка ~395), после строки `const [submitOpen, setSubmitOpen] = useState(false);` добавь:

```ts
  const [requestOpen, setRequestOpen] = useState(false);
```

- [ ] **Step 5: Сообщество — CTA в ряду кнопок**

Найди кнопку «Поделиться» в ряду кнопок сообщества:

```tsx
              <Button variant="outline" onClick={() => setShareOpen(true)} size="lg" className="w-full gap-[8px] rounded-[12px] sm:w-auto">
                <Share2 size={16} /> Поделиться
              </Button>
            </div>
```

и вставь CTA-кнопку СРАЗУ ПОСЛЕ кнопки «Поделиться», перед закрывающим `</div>` ряда:

```tsx
              <Button variant="outline" onClick={() => setShareOpen(true)} size="lg" className="w-full gap-[8px] rounded-[12px] sm:w-auto">
                <Share2 size={16} /> Поделиться
              </Button>
              <Button variant="outline" onClick={() => setRequestOpen(true)} size="lg" className="w-full gap-[8px] rounded-[12px] sm:w-auto">
                <Plus size={16} /> Хочу своё сообщество
              </Button>
            </div>
```

(`Plus` уже импортирован в этом файле — используется в кнопке «Подписаться».)

- [ ] **Step 6: Сообщество — монтирование формы**

Найди строку монтирования `SubmitPostSheet`:

```tsx
      <SubmitPostSheet open={submitOpen} onOpenChange={setSubmitOpen} communityName={community.name} />
```

и добавь СРАЗУ ПОСЛЕ неё:

```tsx
      {requestOpen && (
        <EntityRequestForm
          kind="community"
          onClose={() => setRequestOpen(false)}
          onSubmitted={() => setRequestOpen(false)}
        />
      )}
```

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 8: Ручная проверка (dev-сервер, demo)**

Открой чью-то страницу канала (`/channel/<slug>` где ты не владелец) — виден «Хочу свой канал», клик открывает форму канала (поля name/описание/тематика). Открой страницу сообщества (`/communities/<slug>`) — виден «Хочу своё сообщество», клик открывает форму сообщества (пикер категорий заполнен). Сабмит в demo → тост «Заявка отправлена на рассмотрение», форма закрывается.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/routes/channel.\$id.tsx frontend/src/routes/communities.\$id.tsx
git commit -m "feat(entity-requests): «Хочу свой» CTA on channel and community pages"
```

---

### Task 4: Настройки — раздел «Мой канал и сообщество»

**Files:**
- Create: `frontend/src/routes/settings.spaces.tsx`
- Modify: `frontend/src/components/settings/SettingsNav.tsx`

**Interfaces:**
- Consumes: `EntityRequestForm` (Task 2); `useChannels` (`@/lib/channels`).

- [ ] **Step 1: Создать страницу настроек**

Создай `frontend/src/routes/settings.spaces.tsx`:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Radio, Users2, Plus, ChevronRight } from "lucide-react";
import { useChannels } from "@/lib/channels";
import { EntityRequestForm } from "@/components/entity-requests/EntityRequestForm";
import type { EntityKind } from "@/lib/api/entity-requests";

export const Route = createFileRoute("/settings/spaces")({
  head: () => ({ meta: [{ title: "Мой канал и сообщество — МоДелизМ" }] }),
  component: SettingsSpacesPage,
});

function SettingsSpacesPage() {
  const { channels } = useChannels();
  const myChannel = channels.find((c) => c.isOwner);
  const [requestKind, setRequestKind] = useState<EntityKind | null>(null);

  return (
    <div className="flex flex-col gap-[16px]">
      <h1 className="text-[20px] font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
        Мой канал и сообщество
      </h1>

      {/* Канал */}
      <Card
        icon={<Radio size={20} />}
        title="Канал"
        subtitle={myChannel ? myChannel.name : "У вас пока нет канала"}
        action={
          myChannel ? (
            <Link
              to="/channel/$id"
              params={{ id: myChannel.slug }}
              className="inline-flex h-10 items-center gap-1 rounded-[10px] border px-4 text-[14px] font-semibold transition-colors hover:bg-[var(--background-surface)]"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Мой канал <ChevronRight size={16} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setRequestKind("channel")}
              className="inline-flex h-10 items-center gap-1 rounded-[10px] px-4 text-[14px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              <Plus size={16} /> Создать канал
            </button>
          )
        }
      />

      {/* Сообщество — владение сообществом фронт определить не может
          (нет роли owner; см. backend-endpoints-needed.md §27). До появления
          бэка всегда показываем ветку «Создать». */}
      <Card
        icon={<Users2 size={20} />}
        title="Сообщество"
        subtitle="Создайте своё сообщество по городу или узкой теме"
        action={
          <button
            type="button"
            onClick={() => setRequestKind("community")}
            className="inline-flex h-10 items-center gap-1 rounded-[10px] px-4 text-[14px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            <Plus size={16} /> Создать сообщество
          </button>
        }
      />

      {requestKind && (
        <EntityRequestForm
          kind={requestKind}
          onClose={() => setRequestKind(null)}
          onSubmitted={() => setRequestKind(null)}
        />
      )}
    </div>
  );
}

function Card({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle: string; action: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-[14px] border p-4 sm:flex-row sm:items-center"
      style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{title}</div>
        <div className="truncate text-[13px]" style={{ color: "var(--foreground-50)" }}>{subtitle}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
```

- [ ] **Step 2: Добавить строку в `SettingsNav`**

В `frontend/src/components/settings/SettingsNav.tsx`, измени импорт иконок (строка 2), добавив `Radio`:

```ts
import { UserCog, Bell, Wallet, CreditCard, ClipboardList, FileText, Star, History, ShieldCheck, Palette, BarChart3, ChevronRight, ExternalLink, Radio } from "lucide-react";
```

И добавь строку в массив `ROWS` — после строки `{ to: "/settings/rating", ... }`:

```ts
  { to: "/settings/spaces", label: "Мой канал и сообщество", icon: Radio },
```

- [ ] **Step 3: Typecheck (регенерирует routeTree)**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок. Если TanStack Router выдаёт «route /settings/spaces not registered» — запусти dev-сервер один раз (`npm run dev`) или сборку, чтобы `routeTree.gen.ts` перегенерировался, затем повтори tsc. Закоммить `routeTree.gen.ts` вместе с новым роутом.

- [ ] **Step 4: Ручная проверка**

`/settings` → в списке новая строка «Мой канал и сообщество» → открой `/settings/spaces`. Две карточки: Канал (demo: владения нет → «Создать канал» открывает форму), Сообщество («Создать сообщество» открывает форму). Формы работают, тост при сабмите.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/settings.spaces.tsx frontend/src/components/settings/SettingsNav.tsx frontend/src/routeTree.gen.ts
git commit -m "feat(entity-requests): settings «Мой канал и сообщество» section"
```

---

### Task 5: Админка — раздел «Заявки»

**Files:**
- Modify: `frontend/src/routes/admin.tsx`

**Interfaces:**
- Consumes: `fetchEntityRequests`, `approveEntityRequest`, `rejectEntityRequest`, `type EntityRequest`, `type RequestStatus`, `type EntityKind` (Task 1).

- [ ] **Step 1: Расширить тип `Section` и добавить navItem**

В `frontend/src/routes/admin.tsx`, в типе `Section` (строки ~63-66) добавь `"applications"`. Изменившийся union:

```ts
type Section =
  | "dashboard" | "users" | "content" | "ads" | "moderation" | "delivery"
  | "monetization" | "categories" | "reviews" | "notifications" | "analytics" | "design" | "feedback" | "settings"
  | "auditLog" | "applications";
```

В массив `navItems` добавь после строки `{ id: "moderation", ... }`:

```ts
  { id: "applications", label: "Заявки", icon: Inbox, roles: ["admin"] },
```

(`Inbox` уже импортирован — используется в navItem «Обращения».)

- [ ] **Step 2: Добавить диспетчеризацию в `SectionView`**

В функции `SectionView` (строка ~364), рядом с другими `if (section === ...)`, добавь:

```tsx
  if (section === "applications") return <ApplicationsSection />;
```

- [ ] **Step 3: Добавить импорт API и компонент секции**

Добавь импорт (рядом с другими `@/lib/api/*` импортами в шапке `admin.tsx`):

```ts
import { fetchEntityRequests, approveEntityRequest, rejectEntityRequest, type EntityRequest, type RequestStatus, type EntityKind } from "@/lib/api/entity-requests";
```

И добавь компонент `ApplicationsSection` (в конец файла `admin.tsx`, рядом с другими `*Section`-функциями):

```tsx
function ApplicationsSection() {
  const [status, setStatus] = useState<RequestStatus>("pending");
  const [items, setItems] = useState<EntityRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchEntityRequests(status)
      .then((list) => { if (alive) setItems(list); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [status]);

  const decide = async (r: EntityRequest, approve: boolean) => {
    setItems((cur) => cur.filter((x) => x.id !== r.id)); // optimistic
    try {
      if (approve) await approveEntityRequest(r.kind, r.id);
      else await rejectEntityRequest(r.kind, r.id);
    } catch {
      // на реальном бэке при ошибке перезагрузим список
      fetchEntityRequests(status).then(setItems).catch(() => {});
    }
  };

  const STATUSES: { id: RequestStatus; label: string }[] = [
    { id: "pending", label: "Новые" },
    { id: "approved", label: "Одобрены" },
    { id: "rejected", label: "Отклонены" },
  ];

  const KIND_LABEL: Record<EntityKind, string> = { channel: "Канал", community: "Сообщество" };

  return (
    <div>
      <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "18px", color: "var(--foreground)", marginBottom: "12px" }}>
        Заявки на создание
      </h3>

      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStatus(s.id)}
            style={{
              padding: "7px 14px", borderRadius: "9px", fontSize: "13px", fontWeight: 600,
              background: status === s.id ? "var(--accent-soft)" : "var(--background-surface)",
              color: status === s.id ? "var(--accent)" : "var(--foreground-70)",
              border: `1px solid ${status === s.id ? "var(--border-accent)" : "var(--border)"}`,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: "var(--foreground-50)", fontSize: "13px" }}>Загрузка…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--foreground-50)", fontSize: "13px", border: "1px solid var(--border)", borderRadius: "12px" }}>
          Заявок нет
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", background: "var(--background-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "var(--accent-soft)", color: "var(--accent)" }}>
                  {KIND_LABEL[r.kind]}
                </span>
                <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)" }}>{r.proposedName}</span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--foreground-70)", marginBottom: "8px" }}>
                <Link to="/user/$id" params={{ id: r.applicant.slug ?? r.applicant.id }} style={{ color: "var(--accent)" }}>
                  {r.applicant.name}
                </Link>
                {" · "}{r.category}{" · "}{new Date(r.createdAt).toLocaleDateString("ru-RU")}
              </div>
              {r.description && (
                <p style={{ fontSize: "13px", color: "var(--foreground-70)", marginBottom: "12px" }}>{r.description}</p>
              )}
              {status === "pending" && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button" onClick={() => decide(r, true)}
                    style={{ flex: 1, height: "38px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, background: "var(--accent)", color: "var(--accent-foreground)", border: "none" }}
                  >
                    Одобрить
                  </button>
                  <button
                    type="button" onClick={() => decide(r, false)}
                    style={{ flex: 1, height: "38px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, background: "var(--background-surface)", color: "var(--foreground-70)", border: "1px solid var(--border)" }}
                  >
                    Отклонить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

(`useState`, `useEffect` и `Link` уже импортированы в `admin.tsx` — строка 1: `import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";`, а React-хуки используются во всём файле. Новые импорты добавлять не нужно, кроме API-импорта из Step 3.)

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Ручная проверка**

Открой `/admin` под demo-админом → в левом меню секция «Заявки» → список из 2 мок-заявок (Канал + Сообщество, бейджи), фильтр «Новые/Одобрены/Отклонены». «Одобрить»/«Отклонить» убирают карточку. Переключение на «Одобрены» → пусто (в demo решения не перекладывают в другой статус, просто удаляют — это ок для demo).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/admin.tsx
git commit -m "feat(entity-requests): admin «Заявки» review section"
```

---

### Task 6: Живая регрессия на neeklo + деплой

**Files:** нет (верификация + деплой).

**Interfaces:** нет — потребляет готовую фичу целиком.

- [ ] **Step 1: Полный typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 2: Push + deploy**

```bash
git push origin neeklo
```

Затем деплой по стандартному процессу: `ssh root@31.207.75.124 'cd /var/www/modelizmclub-neeklo && git pull origin neeklo && bash deploy/scripts/deploy-neeklo-frontend.sh'`. Проверь, что HEAD на сервере == локальному.

- [ ] **Step 3: Живая проверка — десктоп (≥1024px)**

На задеплоенном neeklo:
- Чужая страница канала → «Хочу свой канал» → форма канала (name/описание/тематика) → сабмит → тост «Заявка отправлена на рассмотрение».
- Страница сообщества → «Хочу своё сообщество» → форма сообщества (пикер категорий заполнен) → сабмит → тост.
- `/settings/spaces` → две карточки; «Создать канал»/«Создать сообщество» открывают формы.
- `/admin` → «Заявки» → 2 мок-заявки с бейджами; «Одобрить»/«Отклонить» оптимистично убирают карточку; фильтр статусов работает.

- [ ] **Step 4: Живая проверка — мобильные 360/390/430**

На каждом из 360/390/430:
- Форма заявки (из любой точки входа) открывается как нижний лист/полноэкранно, без горизонтального overflow, поля доступны, кнопка «Отправить заявку» видна.
- `/settings/spaces` карточки складываются вертикально, кнопки full-width.
- `/admin` «Заявки» — карточки читаемы, кнопки не клиппятся.

- [ ] **Step 5: Исправить найденное, передеплоить, повторить**

Если живая проверка выявит баг — фикс, коммит, передеплой (повтор Step 2), повторная проверка упавших пунктов до зелёного.
