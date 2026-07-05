# Премиум-доводка (раунд) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть 4 премиум-пробела на demo-стенде: видимая кнопка «три точки» на каждом чате, работающее избранное объявлений (store + топ-бар сердечко + `/favorites`), смена фото профиля (Avito-style), рабочий поиск по каталогу.

**Architecture:** Всё чисто frontend поверх существующих паттернов. Избранное — новый слайс стора `favoriteAdIds` (как `blockedUserIds`/`hiddenUserIds`). Смена аватара — существующий `uploadMedia(file, "avatar")` + `setCurrentUser`. Поиск — `validateSearch` на `/ads` + навигация из топ-бара. Три точки на чате — переиспользование готового `DialogContextMenu`.

**Tech Stack:** React 18, TypeScript strict, TanStack Router, Tailwind v4 (CSS-переменные), lucide-react, sonner.

## Global Constraints

- Работать строго внутри `frontend/`.
- Backend не трогать; недостающие эндпоинты — фиксировать в `docs/backend-endpoints-needed.md`.
- Избранное живёт в store (переживает SPA-навигацию, сбрасывается на hard-reload — консистентно с demo). localStorage-персист НЕ добавляем.
- Счётчики-бейджи на иконках НЕ добавляем. Отдельную иконку «Сообщения» в топ-бар НЕ добавляем. BottomNav НЕ расширяем.
- Обычный клик по строке диалога открывает чат — НЕ ломать.
- После каждой задачи `npx tsc --noEmit` чист.
- Юнит-тестов в проекте нет — верификация через `tsc --noEmit`, `grep`, ручной QA через `preview_*` MCP.

---

### Task 1: Store — слайс избранного объявлений

**Files:**
- Modify: `src/lib/store.ts`

**Interfaces:**
- Produces: `AppState.favoriteAdIds: ID[]`; `actions.toggleFavoriteAd(adId: ID)`; `selectors.isAdFavorite(adId: ID) => (s) => boolean`. Используются Task 2 и Task 3.

- [ ] **Step 1: Добавить поле в `AppState` и `createInitialState`**

Найти в `interface AppState`:

```ts
  blockedUserIds: ID[];
  hiddenUserIds: ID[];
  currentUserId: ID;
```

Заменить на:

```ts
  blockedUserIds: ID[];
  hiddenUserIds: ID[];
  favoriteAdIds: ID[];
  currentUserId: ID;
```

Найти в `createInitialState()`:

```ts
    blockedUserIds: [],
    hiddenUserIds: [],
    currentUserId: GUEST_USER.id,
```

Заменить на:

```ts
    blockedUserIds: [],
    hiddenUserIds: [],
    favoriteAdIds: [],
    currentUserId: GUEST_USER.id,
```

- [ ] **Step 2: Добавить Action-вариант**

Найти:

```ts
  | { type: "HIDE_USER"; userId: ID };
```

Заменить на:

```ts
  | { type: "HIDE_USER"; userId: ID }
  | { type: "TOGGLE_FAVORITE_AD"; adId: ID };
```

- [ ] **Step 3: Добавить reducer-кейс**

Найти кейс `case "HIDE_USER":` (целиком):

```ts
    case "HIDE_USER":
      return {
        ...s,
        hiddenUserIds: s.hiddenUserIds.includes(a.userId)
          ? s.hiddenUserIds
          : [...s.hiddenUserIds, a.userId],
      };
```

Добавить сразу после него:

```ts
    case "TOGGLE_FAVORITE_AD":
      return {
        ...s,
        favoriteAdIds: s.favoriteAdIds.includes(a.adId)
          ? s.favoriteAdIds.filter((id) => id !== a.adId)
          : [...s.favoriteAdIds, a.adId],
      };
```

- [ ] **Step 4: Добавить action**

Найти:

```ts
  hideUser: (userId: ID) => dispatch({ type: "HIDE_USER", userId }),
```

Добавить сразу после:

```ts
  toggleFavoriteAd: (adId: ID) => dispatch({ type: "TOGGLE_FAVORITE_AD", adId }),
```

- [ ] **Step 5: Добавить selector**

Найти:

```ts
  isBlocked: (userId: ID) => (s: AppState): boolean => s.blockedUserIds.includes(userId),
```

Добавить сразу после (внутри объекта `selectors`, перед закрывающей `};`):

```ts
  isAdFavorite: (adId: ID) => (s: AppState): boolean => s.favoriteAdIds.includes(adId),
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 7: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat(store): favoriteAdIds slice + toggleFavoriteAd/isAdFavorite"
```

---

### Task 2: Карточки — сердечко пишет в store

**Files:**
- Modify: `src/components/ads/CatalogCard.tsx`
- Modify: `src/routes/ads.$id.tsx`

**Interfaces:**
- Consumes: `selectors.isAdFavorite`, `actions.toggleFavoriteAd` (Task 1).

- [ ] **Step 1: `CatalogCard` — заменить локальный `fav` на store**

Найти вверху файла:

```tsx
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MapPin } from "lucide-react";
import type { Ad } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { categoryPlaceholder } from "@/lib/placeholder-image";
import { cn } from "@/lib/utils";

export function CatalogCard({ ad, className }: { ad: Ad; className?: string }) {
  const [fav, setFav] = useState(false);
  const initial = ad.gallery?.[0] ?? ad.image ?? "";
  const [src, setSrc] = useState(initial);
```

Заменить на:

```tsx
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { Ad } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { categoryPlaceholder } from "@/lib/placeholder-image";
import { cn } from "@/lib/utils";
import { useStore, actions, selectors } from "@/lib/store";

export function CatalogCard({ ad, className }: { ad: Ad; className?: string }) {
  const fav = useStore(selectors.isAdFavorite(ad.id));
  const initial = ad.gallery?.[0] ?? ad.image ?? "";
  const [src, setSrc] = useState(initial);
```

- [ ] **Step 2: `CatalogCard` — обновить onClick сердечка**

Найти:

```tsx
          onClick={(e) => {
            e.preventDefault();
            setFav((v) => !v);
          }}
```

Заменить на:

```tsx
          onClick={(e) => {
            e.preventDefault();
            actions.toggleFavoriteAd(ad.id);
            toast.success(fav ? "Убрано из избранного" : "В избранное");
          }}
```

- [ ] **Step 3: `ads.$id.tsx` — источник `saved` из store**

Найти:

```tsx
import { useStore, selectors } from "@/lib/store";
```

Заменить на:

```tsx
import { useStore, selectors, actions } from "@/lib/store";
```

Найти:

```tsx
  const [saved, setSaved] = useState(false);
```

Заменить на:

```tsx
  const saved = useStore(selectors.isAdFavorite(id));
```

(`useState` может стать неиспользуемым импортом — в проекте `noUnusedLocals: false`, ошибки не будет; `useState` всё ещё используется для `ad`/`state`/`similar`, так что импорт остаётся.)

- [ ] **Step 4: `ads.$id.tsx` — переписать `toggleSave`**

Найти:

```tsx
  const toggleSave = () => {
    setSaved((v) => {
      toast.success(v ? "Убрано из избранного" : "В избранное");
      return !v;
    });
  };
```

Заменить на:

```tsx
  const toggleSave = () => {
    actions.toggleFavoriteAd(id);
    toast.success(saved ? "Убрано из избранного" : "В избранное");
  };
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/components/ads/CatalogCard.tsx src/routes/ads.$id.tsx
git commit -m "feat(ads): heart favorites persist to store (CatalogCard + ad detail)"
```

---

### Task 3: Страница `/favorites` + сердечко в топ-баре + sidebar-пункт

**Files:**
- Create: `src/routes/favorites.tsx`
- Modify: `src/components/layout/DesktopTopBar.tsx`
- Modify: `src/lib/routes.ts` (ROUTES + SIDEBAR_ROUTE_MAP)
- Modify: `src/components/layout/Sidebar.tsx` (пункт «Избранное»)

**Interfaces:**
- Consumes: `AppState.favoriteAdIds` (Task 1), `fetchListings` (`src/lib/api/listings.ts`), `CatalogCard`, `AdCardSkeleton`, `EmptyState`.

- [ ] **Step 1: Добавить роут в `ROUTES`**

В `src/lib/routes.ts` найти:

```ts
  myAds: "/my-ads",
```

Добавить сразу после:

```ts
  favorites: "/favorites",
```

- [ ] **Step 2: Добавить в `SIDEBAR_ROUTE_MAP`**

Найти:

```ts
  "my-ads": ["/my-ads"],
```

Добавить сразу после:

```ts
  favorites: ["/favorites"],
```

- [ ] **Step 3: Создать `src/routes/favorites.tsx`**

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CatalogCard } from "@/components/ads/CatalogCard";
import { AdCardSkeleton } from "@/components/ads/AdCardSkeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { fetchListings } from "@/lib/api/listings";
import { useStore } from "@/lib/store";
import type { Ad } from "@/lib/mock";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "Избранное — МоДелизМ" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    await requireAuth(location);
  },
  component: FavoritesPage,
});

function FavoritesPage() {
  const navigate = useNavigate();
  const favoriteAdIds = useStore((s) => s.favoriteAdIds);
  const [allAds, setAllAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchListings()
      .then((list) => { if (alive) setAllAds(list); })
      .catch(() => { if (alive) setAllAds([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const favorites = useMemo(
    () => allAds.filter((a) => favoriteAdIds.includes(a.id)),
    [allAds, favoriteAdIds],
  );

  return (
    <AppLayout rightColumn={false} footer>
      <div className="space-y-[16px] pb-[24px]">
        <header>
          <h1 className="font-display text-[22px] font-bold leading-tight" style={{ color: "var(--foreground)" }}>
            Избранное
          </h1>
          <p className="mt-[1px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
            Объявления, которые вы отметили сердечком
          </p>
        </header>

        {loading ? (
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <AdCardSkeleton key={i} />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="В избранном пусто"
            description="Добавляйте объявления сердечком в каталоге — они появятся здесь."
          >
            <Button onClick={() => navigate({ to: "/ads" })}>В каталог</Button>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {favorites.map((ad) => (
              <CatalogCard key={ad.id} ad={ad} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 4: Сердечко в топ-баре**

В `src/components/layout/DesktopTopBar.tsx` найти строку импорта иконок:

```tsx
import { Search, Bell } from "lucide-react";
```

Заменить на:

```tsx
import { Search, Bell, Heart } from "lucide-react";
```

Найти:

```tsx
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <LanguageSwitcher />
        <Link
          to={ROUTES.notifications}
```

Заменить на:

```tsx
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <LanguageSwitcher />
        <Link
          to={ROUTES.favorites}
          aria-label="Избранное"
          className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-70)" }}
        >
          <Heart size={20} />
        </Link>
        <Link
          to={ROUTES.notifications}
```

- [ ] **Step 5: Пункт «Избранное» в Sidebar**

В `src/components/layout/Sidebar.tsx` найти строку импорта иконок:

```tsx
import { Newspaper, Users2, Radio, MessageSquare, Megaphone, UserPlus, ClipboardList, Plus, ShoppingBag, ExternalLink } from "lucide-react";
```

Заменить на:

```tsx
import { Newspaper, Users2, Radio, MessageSquare, Megaphone, UserPlus, ClipboardList, Plus, ShoppingBag, ExternalLink, Heart } from "lucide-react";
```

Найти тип `Item` (поле `to`):

```tsx
interface Item {
  to: "/feed" | "/ads" | "/ads/new" | "/my-ads" | "/communities" | "/channels" | "/messenger" | "/friends";
  labelKey: string;
  icon: typeof Newspaper;
  section: string;
  authOnly?: boolean;
}
```

Заменить на:

```tsx
interface Item {
  to: "/feed" | "/ads" | "/ads/new" | "/my-ads" | "/favorites" | "/communities" | "/channels" | "/messenger" | "/friends";
  labelKey: string;
  icon: typeof Newspaper;
  section: string;
  authOnly?: boolean;
}
```

Найти в массиве `items`:

```tsx
  { to: ROUTES.myAds,        labelKey: "nav.myAds",    icon: ClipboardList, section: "my-ads", authOnly: true },
```

Добавить сразу после:

```tsx
  { to: ROUTES.favorites,    labelKey: "nav.favorites", icon: Heart,        section: "favorites", authOnly: true },
```

- [ ] **Step 6: Добавить локаль-ключ `nav.favorites`**

В `src/lib/i18n/locales/ru.ts` найти:

```ts
    myAds: "Мои объявления",
```

Добавить сразу после:

```ts
    favorites: "Избранное",
```

В `src/lib/i18n/locales/en.ts` найти строку с `myAds:` и добавить после неё `favorites: "Favorites",`.
В `src/lib/i18n/locales/zh.ts` найти строку с `myAds:` и добавить после неё `favorites: "收藏",`.

- [ ] **Step 7: Регенерировать `routeTree.gen.ts`**

`src/routeTree.gen.ts` — генерируемый (но закоммиченный) файл; отдельного
`tsr generate` скрипта нет — дерево роутов пересобирает vite-плагин TanStack
Router при запуске dev-сервера. Типизированный `<Link to="/favorites">` и
`Route.useSearch` НЕ пройдут `tsc`, пока `/favorites` не попадёт в
routeTree.gen.ts. Поэтому: запустить dev-сервер (через `preview_start`),
дождаться, пока плагин перегенерирует `src/routeTree.gen.ts` (появится
`favorites` в файле — проверить `grep -c "favorites" src/routeTree.gen.ts` > 0),
затем продолжать.

Run (после старта preview): `grep -c "/favorites" src/routeTree.gen.ts`
Expected: ≥ 1 (роут зарегистрирован).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 9: Manual verify (dev)**

Открыть `/ads`, кликнуть сердечко на карточке → toast «В избранное». Кликнуть сердечко в топ-баре → `/favorites` показывает эту карточку. Убрать из избранного → карточка исчезает со страницы.

- [ ] **Step 10: Commit** (включая перегенерированный routeTree.gen.ts)

```bash
git add src/routes/favorites.tsx src/components/layout/DesktopTopBar.tsx src/lib/routes.ts src/components/layout/Sidebar.tsx src/lib/i18n/locales/ru.ts src/lib/i18n/locales/en.ts src/lib/i18n/locales/zh.ts src/routeTree.gen.ts
git commit -m "feat(favorites): /favorites page + topbar heart + sidebar entry"
```

---

### Task 4: Три точки на каждом чате

**Files:**
- Modify: `src/routes/messenger.tsx`

**Interfaces:**
- Consumes: существующий `DialogContextMenu` + state `dialogCtxMenu`/`setDialogCtxMenu` (уже в файле).

- [ ] **Step 1: Добавить кнопку «три точки» в строку диалога**

Найти блок бейджа непрочитанного в рендере строки диалога:

```tsx
                        {!!d.unread && !getMeta(d.id).muted && (
                          <Badge
                            variant="default"
                            withIcon={false}
                            className="h-[20px] min-w-[20px] shrink-0 justify-center rounded-full px-[6px] py-0 text-[11px] leading-none"
                          >
                            {d.unread}
                          </Badge>
                        )}
```

Добавить сразу ПОСЛЕ этого блока (внутри того же `<button>` строки, перед его закрытием):

```tsx
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Действия с чатом"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setDialogCtxMenu({ dialogId: d.id, point: { x: r.left, y: r.bottom } });
                          }}
                          className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                          style={{ color: "var(--foreground-50)" }}
                        >
                          <MoreHorizontal size={16} />
                        </span>
```

(Кнопка строки диалога уже содержит нужные touch/contextmenu-хендлеры; добавляем `role="button"` span, чтобы не вкладывать `<button>` в `<button>`. `stopPropagation` не даёт открыться чату. Базово visible на mobile, hover-gated от `sm`.)

- [ ] **Step 2: Убедиться, что строка — `group` и импорт `MoreHorizontal` есть**

Найти `<button` строки диалога (`onClick={...handleSelect...}`) — проверить, что у неё нет класса `group`; добавить `group` в её `className`. Найти:

```tsx
                        className="flex w-full items-center gap-[12px] px-[16px] py-[12px] text-left transition-colors duration-150"
```

Заменить на:

```tsx
                        className="group flex w-full items-center gap-[12px] px-[16px] py-[12px] text-left transition-colors duration-150"
```

Проверить импорт `MoreHorizontal`:

Run: `grep -n "MoreHorizontal" src/routes/messenger.tsx`
Expected: если пусто — добавить `MoreHorizontal` в блок импорта из `"lucide-react"` (строки 5-7). Если уже есть — ничего не делать.

Если импорта нет, найти:

```tsx
  ArrowLeft, Check, CheckCheck, CornerUpLeft, MessageSquare, Pin,
```

Заменить на:

```tsx
  ArrowLeft, Check, CheckCheck, CornerUpLeft, MessageSquare, Pin, MoreHorizontal,
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Manual verify (dev)**

Desktop: навести на строку чата → появляется «три точки»; клик → то же меню (Отметить непрочитанным/Закрепить/Отключить уведомления/Очистить историю); чат при этом НЕ открывается. Обычный клик по строке (не по точкам) открывает чат. Mobile 390: «три точки» видны всегда, клик открывает меню.

- [ ] **Step 5: Commit**

```bash
git add src/routes/messenger.tsx
git commit -m "feat(messenger): visible 3-dots button on each dialog row (hover desktop, always mobile) opens same context menu"
```

---

### Task 5: Смена фото профиля (Avito-style)

**Files:**
- Modify: `src/routes/profile.tsx` (`ProfileAvatar` + вызов)
- Modify: `src/lib/api/social.ts` (`updateOwnProfile` доп. параметр)
- Modify: `frontend/docs/backend-endpoints-needed.md`

**Interfaces:**
- Consumes: `uploadMedia` (`src/lib/api/media.ts`), `setCurrentUser` + `selectors.currentUser` (store), `updateOwnProfile` (social.ts).

- [ ] **Step 1: Расширить `updateOwnProfile`**

В `src/lib/api/social.ts` найти:

```ts
export async function updateOwnProfile(input: {
  display_name?: string;
  bio?: string;
  slug?: string;
}): Promise<void> {
  if (isDemoMode()) return;
  await api("/users/me", { method: "PATCH", json: input });
}
```

Заменить на:

```ts
export async function updateOwnProfile(input: {
  display_name?: string;
  bio?: string;
  slug?: string;
  avatar_media_id?: string | null;
}): Promise<void> {
  if (isDemoMode()) return;
  await api("/users/me", { method: "PATCH", json: input });
}
```

- [ ] **Step 2: Импорты в `profile.tsx`**

Найти:

```tsx
import { useStore, actions, selectors, setCurrentUser } from "@/lib/store";
```

(уже есть `setCurrentUser` и `selectors`). Добавить после блока импортов store новые импорты (найти строку `import { createConversation } from "@/lib/api/chat";` и добавить после неё):

```tsx
import { uploadMedia } from "@/lib/api/media";
import { updateOwnProfile } from "@/lib/api/social";
```

Проверить: `updateOwnProfile` уже импортируется в profile.tsx?

Run: `grep -n "updateOwnProfile\|uploadMedia" src/routes/profile.tsx`
Expected: если `updateOwnProfile` уже импортирован (в `saveProfile`) — не дублировать, добавить только `uploadMedia`. Иначе добавить оба.

Также нужны иконки `Camera` и `Trash2` в lucide-импорте profile.tsx. Найти строку импорта из `"lucide-react"` (строки 4-7) и добавить `Camera` и `Trash2`, если их там нет (проверить `grep -n "Camera\|Trash2" src/routes/profile.tsx` — если нет, добавить в импорт).

- [ ] **Step 3: Переписать `ProfileAvatar` с редактированием**

Найти весь компонент `ProfileAvatar`:

```tsx
function ProfileAvatar({ src, name }: { src?: string; name: string }) {
  const hasSrc = Boolean(src && src.trim());
  return (
    <Avatar
      className="h-[88px] w-[88px] md:h-[112px] md:w-[112px]"
      style={{
        border: "4px solid var(--background)",
        boxShadow: "0 10px 30px -10px rgba(0,0,0,.45), 0 0 0 1px var(--border)",
        background: "var(--background)",
      }}
    >
      {hasSrc && <AvatarImage src={src} alt="" className="object-cover" />}
      <AvatarFallback
        className="font-display text-[28px] font-bold md:text-[36px]"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
```

Заменить на:

```tsx
function ProfileAvatar({ src, name, editable }: { src?: string; name: string; editable?: boolean }) {
  const hasSrc = Boolean(src && src.trim());
  const currentUser = useStore(selectors.currentUser);
  const fileRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл слишком большой", { description: "Максимум 5 МБ" });
      return;
    }
    setUploading(true);
    try {
      const media = await uploadMedia(file, "avatar");
      const url = media.url ?? "";
      setCurrentUser({ ...currentUser, avatar: url });
      void updateOwnProfile({ avatar_media_id: media.uuid });
      toast.success("Фото профиля обновлено");
    } catch {
      toast.error("Не удалось загрузить фото");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    setMenuOpen(false);
    setCurrentUser({ ...currentUser, avatar: "" });
    void updateOwnProfile({ avatar_media_id: null });
    toast.success("Фото удалено");
  };

  return (
    <div className="group relative h-[88px] w-[88px] md:h-[112px] md:w-[112px]">
      <Avatar
        className="h-full w-full"
        style={{
          border: "4px solid var(--background)",
          boxShadow: "0 10px 30px -10px rgba(0,0,0,.45), 0 0 0 1px var(--border)",
          background: "var(--background)",
        }}
      >
        {hasSrc && <AvatarImage src={src} alt="" className="object-cover" />}
        <AvatarFallback
          className="font-display text-[28px] font-bold md:text-[36px]"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {initials(name)}
        </AvatarFallback>
      </Avatar>

      {editable && (
        <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button
            type="button"
            aria-label="Изменить фото"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={uploading}
            className="absolute inset-0 grid place-items-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            style={{ background: "rgba(0,0,0,0.45)", color: "#fff", border: "4px solid transparent" }}
          >
            <Camera size={22} />
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              role="menu"
              className="absolute left-1/2 top-full z-[60] mt-[8px] w-[190px] -translate-x-1/2 overflow-hidden rounded-[12px] border"
              style={{ background: "var(--background-elevated)", borderColor: "var(--border)", boxShadow: "var(--shadow-float)" }}
            >
              <button
                role="menuitem"
                type="button"
                onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}
                className="flex w-full items-center gap-[10px] px-[14px] py-[11px] text-left text-[13px] transition-colors hover:bg-[var(--background-surface)]"
                style={{ color: "var(--foreground)" }}
              >
                <Camera className="h-[16px] w-[16px]" /> Загрузить фото
              </button>
              {hasSrc && (
                <button
                  role="menuitem"
                  type="button"
                  onClick={removePhoto}
                  className="flex w-full items-center gap-[10px] px-[14px] py-[11px] text-left text-[13px] transition-colors hover:bg-[var(--background-surface)]"
                  style={{ color: "var(--error)" }}
                >
                  <Trash2 className="h-[16px] w-[16px]" /> Удалить
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Передать `editable` при вызове**

Найти:

```tsx
            <ProfileAvatar src={user.avatar} name={user.name} />
```

Заменить на:

```tsx
            <ProfileAvatar src={user.avatar} name={user.name} editable={isOwn} />
```

- [ ] **Step 5: Проверить импорты `useRef`/`useEffect`/`useState` в profile.tsx**

Run: `grep -n "^import { .*useRef.*useState.*from \"react\"\|useRef\|useEffect\|useState" src/routes/profile.tsx | head -3`
Expected: `useState`, `useEffect`, `useRef` уже импортируются из `"react"` (файл их использует). Если чего-то нет — добавить в существующий импорт из `"react"`.

- [ ] **Step 6: Backend-заметка**

В `frontend/docs/backend-endpoints-needed.md` добавить в конец:

```md

---

## 14. Обновление аватара профиля

**Задача:** Премиум-доводка (2026-07-05) — смена фото профиля.
**Endpoint:** `PATCH /users/me` с полем `avatar_media_id` (uuid из
`POST /media`, purpose=avatar) для установки; `avatar_media_id: null` — сброс.
**Статус:** `Existing?` — фронт уже шлёт это поле (`updateOwnProfile`).
**Нужно уточнить у бэкенда:** принимает ли `PATCH /users/me` поле
`avatar_media_id` (или оно называется иначе, напр. `avatar_id`/`avatar`).
Если да — ничего не требуется; если нет — добавить.
**Demo/mock fallback:** `uploadMedia("avatar")` в demo возвращает blob-URL,
`setCurrentUser({...me, avatar: url})` обновляет аватар в сторе; сбрасывается
на hard-reload (как весь demo-стейт).
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 8: Manual verify (dev)**

`/profile` (свой): навести на аватар → затемнение + камера; клик → меню
«Загрузить фото / Удалить»; выбрать картинку → аватар меняется в профиле И в
топ-баре/сайдбаре (тот же store-user). «Удалить» → инициалы.

- [ ] **Step 9: Commit**

```bash
git add src/routes/profile.tsx src/lib/api/social.ts docs/backend-endpoints-needed.md
git commit -m "feat(profile): Avito-style avatar upload/delete on hover (uploadMedia + setCurrentUser)"
```

---

### Task 6: Рабочий поиск по каталогу

**Files:**
- Modify: `src/components/layout/DesktopTopBar.tsx`
- Modify: `src/routes/ads.index.tsx`

**Interfaces:**
- Consumes: `useNavigate` (router). Каталог уже фильтрует по `q` (`buildParams`/`demoListingsFiltered`).

- [ ] **Step 1: `/ads` — принять `q` из URL**

В `src/routes/ads.index.tsx` найти определение роута:

```tsx
export const Route = createFileRoute("/ads/")({
  head: () => ({
    meta: [
      { title: "Объявления — МоДелизМ" },
      { name: "description", content: "Каталог объявлений: RC авто, самолёты, квадрокоптеры, корабли. Купить и продать модели и запчасти." },
    ],
  }),
  component: CatalogPage,
});
```

Заменить на:

```tsx
export const Route = createFileRoute("/ads/")({
  head: () => ({
    meta: [
      { title: "Объявления — МоДелизМ" },
      { name: "description", content: "Каталог объявлений: RC авто, самолёты, квадрокоптеры, корабли. Купить и продать модели и запчасти." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: CatalogPage,
});
```

- [ ] **Step 2: `/ads` — инициализировать и синхронизировать `q`**

Найти в `CatalogPage`:

```tsx
function CatalogPage() {
  const navigate = useNavigate();
  const isAuthed = !!getToken() || isDemoMode();

  const [ads, setAds] = useState<Ad[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [q, setQ] = useState("");
```

Заменить на:

```tsx
function CatalogPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const isAuthed = !!getToken() || isDemoMode();

  const [ads, setAds] = useState<Ad[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [q, setQ] = useState(search.q ?? "");

  useEffect(() => {
    setQ(search.q ?? "");
  }, [search.q]);
```

(Существующий `useEffect(() => { void load(); }, [load])` пересоберёт запрос при
смене `q`, т.к. `q` — в зависимостях `load` через `buildParams`. `useEffect`
уже импортирован в файле.)

- [ ] **Step 3: Топ-бар — управляемый поиск + Enter**

В `src/components/layout/DesktopTopBar.tsx` найти начало компонента:

```tsx
export function DesktopTopBar() {
  const unread = useUnreadNotifications();
  const { t } = useTranslation();
```

Заменить на:

```tsx
export function DesktopTopBar() {
  const unread = useUnreadNotifications();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
```

Добавить импорты в начало файла — найти:

```tsx
import { Link } from "@tanstack/react-router";
```

Заменить на:

```tsx
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
```

Найти `<input type="search" ...>`:

```tsx
        <input
          type="search"
          placeholder={t("common.search")}
          className="w-full text-[14px] outline-none transition-colors"
          style={{
            background: "var(--background-elevated)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-input)",
            height: 40,
            padding: "0 12px 0 36px",
          }}
        />
```

Заменить на:

```tsx
        <input
          type="search"
          placeholder={t("common.search")}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = searchValue.trim();
              void navigate({ to: "/ads", search: v ? { q: v } : {} });
            }
          }}
          className="w-full text-[14px] outline-none transition-colors"
          style={{
            background: "var(--background-elevated)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-input)",
            height: 40,
            padding: "0 12px 0 36px",
          }}
        />
```

Убрать устаревший комментарий над input — найти и удалить строку:

```tsx
      {/* presentational search — no submit logic (see spec) */}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Manual verify (dev)**

В топ-баре ввести «двигатель» → Enter → переход на `/ads?q=двигатель`,
каталог показывает только совпадающие объявления, тег-фильтр «двигатель»
активен. Очистка URL (перейти на `/ads` без q) → полный каталог.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/DesktopTopBar.tsx src/routes/ads.index.tsx
git commit -m "feat(search): working catalog search — topbar Enter navigates to /ads?q=…, catalog reads q param"
```

---

## После завершения плана

Использовать `superpowers:finishing-a-development-branch` — merge в `master`,
затем в `neeklo` (fetch первым, merge не rebase), деплой на VPS через
`deploy/scripts/deploy-neeklo-frontend.sh`, обновить
`memory/project_neeklo_stand.md` новым HEAD.
