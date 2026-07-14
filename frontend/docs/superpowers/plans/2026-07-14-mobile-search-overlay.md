# Mobile Full-Screen Search Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen mobile search takeover (tabs by content type + a "recent" block backed by view-history) that opens from the search icon in `MobileHeader`, without changing the existing desktop `GlobalSearch` dropdown's behavior.

**Architecture:** Extract the debounced multi-source search logic already living inside `GlobalSearch.tsx` into a shared `useGlobalSearch` hook, and extract its two presentational sub-components (`SearchGroup`, `ResultRow`) into their own file. Both the (refactored, behavior-identical) desktop dropdown and the new `MobileSearchOverlay` consume these shared pieces. Separately, extend `view-history.ts` to also record profile/community views, which powers the overlay's "Недавние" block.

**Tech Stack:** TanStack Start/React 19/TypeScript strict, TanStack Router (`Link`/`useNavigate`), framer-motion, Tailwind (inline `style` with CSS custom properties per project convention), lucide-react icons.

## Global Constraints

- Frontend-only. No backend changes. All existing API function signatures (`searchUsers`, `fetchCommunities`, `fetchListings`, `fetchListingCategories`) are used exactly as they exist today — do not modify `src/lib/api/*`.
- The new overlay is `lg:hidden`-scoped only. `DesktopTopBar`/`GlobalSearch` must remain visually and functionally unchanged after the Task 3 refactor (behavior-preserving refactor, not a rewrite).
- No new "search query text history" feature. "Недавние" shows previously-viewed entities via the existing `view-history.ts` mechanism only (spec §"Решения" item 1).
- Tabs filter already-fetched results client-side — switching tabs must never trigger a new network request (spec §"Решения" item 4).
- Use `100dvh` (not `100vh`) for the overlay's height — established project pattern for mobile-keyboard-safe full-height UI, per the exact comment in `src/components/layout/AppLayout.tsx:31`: `// 100dvh keeps the shell stable on mobile Safari/Chrome (no 100vh jump).`
- Body-scroll-lock (`document.body.style.overflow = "hidden"` while open, restored on close) — established pattern already used in `CreatePostModal.tsx`.
- The overlay is local UI state (`useState` in `MobileHeader`), not a route. The hardware back button closing the whole tab/app instead of just the overlay is a documented, accepted limitation — do not attempt router/history sync (spec §"Не входит в эту фазу").
- Every task ends with `tsc --noEmit` clean and, for Task 6, live verification on viewports 360/390/430 per the standing project rule (live browser verification, not just tsc, is required before considering the feature done).
- Spec source of truth: `frontend/docs/superpowers/specs/2026-07-14-mobile-search-overlay-design.md`.

---

## File Structure

- **Modify:** `src/lib/view-history.ts` — widen `ViewHistoryItem.kind` union.
- **Modify:** `src/routes/user.$id.tsx` — record profile views.
- **Modify:** `src/routes/communities.$id.tsx` — record community views.
- **Create:** `src/lib/hooks/useGlobalSearch.ts` — shared debounced multi-source search hook.
- **Create:** `src/components/layout/search/SearchResultRow.tsx` — shared `SearchGroup`/`ResultRow` presentational components.
- **Modify:** `src/components/layout/GlobalSearch.tsx` — refactor to consume the two files above (pure refactor, no visible behavior change).
- **Create:** `src/components/layout/MobileSearchOverlay.tsx` — the new full-screen mobile search panel.
- **Modify:** `src/components/layout/MobileHeader.tsx` — wire the search icon to open the new overlay.

---

### Task 1: Extend `view-history.ts` and record profile/community views

**Files:**
- Modify: `frontend/src/lib/view-history.ts:5`
- Modify: `frontend/src/routes/user.$id.tsx` (imports + the `fetchPublicProfile(id).then(...)` block, lines 1-35)
- Modify: `frontend/src/routes/communities.$id.tsx` (imports + the `fetchCommunity(id).then(...)` block, lines 1-25 and ~408-424)

**Interfaces:**
- Produces: `ViewHistoryItem.kind` now includes `"community"` (was `"ad" | "profile" | "review"`, becomes `"ad" | "profile" | "review" | "community"`). This is the exact type later tasks (`MobileSearchOverlay.tsx`) switch over.
- Consumes: `recordView(item: Omit<ViewHistoryItem, "viewedAt">): void` — already exists, unchanged signature.

- [ ] **Step 1: Widen the `kind` union**

In `frontend/src/lib/view-history.ts`, change line 5 from:

```ts
  kind: "ad" | "profile" | "review";
```

to:

```ts
  kind: "ad" | "profile" | "review" | "community";
```

- [ ] **Step 2: Record profile views in `user.$id.tsx`**

In `frontend/src/routes/user.$id.tsx`, add the import (alongside the existing imports at the top of the file):

```ts
import { recordView } from "@/lib/view-history";
```

Then change the effect (currently):

```ts
  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    fetchPublicProfile(id)
      .then((p) => { if (active) { setProfile(p); setLoading(false); } })
      .catch(() => { if (active) { setNotFound(true); setLoading(false); } });
    return () => { active = false; };
  }, [id]);
```

to:

```ts
  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    fetchPublicProfile(id)
      .then((p) => {
        if (active) {
          setProfile(p);
          setLoading(false);
          recordView({ id: p.user.slug ?? p.user.id, kind: "profile", title: p.user.name, thumb: p.user.avatar });
        }
      })
      .catch(() => { if (active) { setNotFound(true); setLoading(false); } });
    return () => { active = false; };
  }, [id]);
```

- [ ] **Step 3: Record community views in `communities.$id.tsx`**

In `frontend/src/routes/communities.$id.tsx`, add the import next to the existing `@/lib/api/communities` import:

```ts
import { recordView } from "@/lib/view-history";
```

Then change the effect (currently, around line 408-424):

```ts
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setBrokenCover(false);
    setBrokenAvatar(false);
    setTab("posts");
    fetchCommunity(id)
      .then((c) => {
        if (!alive) return;
        setCommunity(c);
        setJoined(Boolean(c.joined));
        setMembers(c.members);
      })
      .catch(() => alive && setCommunity(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);
```

to:

```ts
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setBrokenCover(false);
    setBrokenAvatar(false);
    setTab("posts");
    fetchCommunity(id)
      .then((c) => {
        if (!alive) return;
        setCommunity(c);
        setJoined(Boolean(c.joined));
        setMembers(c.members);
        recordView({ id: c.id, kind: "community", title: c.name, thumb: c.avatarImage });
      })
      .catch(() => alive && setCommunity(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual smoke check (no automated test harness in this project)**

Run the dev server, open a profile page (`/user/<id>`) and a community page (`/communities/<id>`) while logged in, then in the browser console run:

```js
JSON.parse(localStorage.getItem("modelizm_view_history"))
```

Expected: an array containing entries with `kind: "profile"` and `kind: "community"` respectively, each with the correct `id`/`title`/`thumb`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/view-history.ts frontend/src/routes/user.\$id.tsx frontend/src/routes/communities.\$id.tsx
git commit -m "feat(search): record profile/community views in view-history"
```

---

### Task 2: Extract `useGlobalSearch` hook

**Files:**
- Create: `frontend/src/lib/hooks/useGlobalSearch.ts`

**Interfaces:**
- Consumes: `searchUsers(q: string): Promise<User[]>` (`@/lib/api/social`), `fetchCommunities(query?: string): Promise<Community[]>` (`@/lib/api/communities`), `fetchListings(params: CatalogParams): Promise<Ad[]>` (`@/lib/api/listings`, `CatalogParams` includes `{ q?: string; perPage?: number; ... }`), `fetchListingCategories(): Promise<Category[]>` (`@/lib/api/categories`, no query param — filtered client-side).
- Produces: `SearchResults` interface (`{ users: User[]; communities: Community[]; ads: Ad[]; categories: Category[] }`), `MIN_QUERY_LENGTH` constant (value `2`), and `useGlobalSearch(query: string, opts?: { perPage?: number }): { results: SearchResults; loading: boolean }`. Task 3 (`GlobalSearch.tsx` refactor) and Task 5 (`MobileSearchOverlay.tsx`) both import all three from this file.

- [ ] **Step 1: Create the hook file**

Create `frontend/src/lib/hooks/useGlobalSearch.ts`:

```ts
import { useEffect, useRef, useState } from "react";
import { searchUsers } from "@/lib/api/social";
import { fetchCommunities } from "@/lib/api/communities";
import { fetchListings } from "@/lib/api/listings";
import { fetchListingCategories } from "@/lib/api/categories";
import type { User, Community, Ad, Category } from "@/lib/mock";

export interface SearchResults {
  users: User[];
  communities: Community[];
  ads: Ad[];
  categories: Category[];
}

const EMPTY: SearchResults = { users: [], communities: [], ads: [], categories: [] };
export const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const DEFAULT_PER_PAGE = { users: 4, communities: 4, ads: 5, categories: 5 };

/** Debounced multi-source search (people/communities/ads/categories) shared
 *  by the desktop dropdown (GlobalSearch) and the mobile full-screen
 *  overlay (MobileSearchOverlay). `perPage` caps every source uniformly;
 *  omitting it keeps the original desktop-dropdown limits. */
export function useGlobalSearch(
  query: string,
  opts?: { perPage?: number },
): { results: SearchResults; loading: boolean } {
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const q = query.trim();
  const perPage = opts?.perPage;

  useEffect(() => {
    if (q.length < MIN_QUERY_LENGTH) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(() => {
      Promise.all([
        searchUsers(q).catch(() => []),
        fetchCommunities(q).catch(() => []),
        fetchListings({ q, perPage: perPage ?? DEFAULT_PER_PAGE.ads }).catch(() => []),
        fetchListingCategories().catch(() => []),
      ]).then(([users, communities, ads, allCategories]) => {
        if (id !== requestId.current) return;
        const qLower = q.toLowerCase();
        const categories = allCategories
          .filter((c) => c.name.toLowerCase().includes(qLower))
          .slice(0, perPage ?? DEFAULT_PER_PAGE.categories);
        setResults({
          users: users.slice(0, perPage ?? DEFAULT_PER_PAGE.users),
          communities: communities.slice(0, perPage ?? DEFAULT_PER_PAGE.communities),
          ads: ads.slice(0, perPage ?? DEFAULT_PER_PAGE.ads),
          categories,
        });
        setLoading(false);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, perPage]);

  return { results, loading };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (the file is not consumed anywhere yet, so this only checks the file itself is well-typed).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/hooks/useGlobalSearch.ts
git commit -m "feat(search): extract shared useGlobalSearch hook"
```

---

### Task 3: Extract `SearchResultRow.tsx` and refactor `GlobalSearch.tsx`

**Files:**
- Create: `frontend/src/components/layout/search/SearchResultRow.tsx`
- Modify: `frontend/src/components/layout/GlobalSearch.tsx` (full rewrite of the file — same visible behavior)

**Interfaces:**
- Consumes: `useGlobalSearch`, `MIN_QUERY_LENGTH` from Task 2's `@/lib/hooks/useGlobalSearch`.
- Produces: `SearchGroup({ label: string; icon: LucideIcon; children: React.ReactNode })` and `ResultRow({ to: string; params?: Record<string, string>; avatar?: string; fallbackIcon: LucideIcon; title: string; subtitle?: string; onNavigate: () => void })`, both exported from `@/components/layout/search/SearchResultRow`. Task 5 (`MobileSearchOverlay.tsx`) imports both by these exact names and prop shapes.

- [ ] **Step 1: Create `SearchResultRow.tsx`**

Create `frontend/src/components/layout/search/SearchResultRow.tsx` — this is `SearchGroup`/`ResultRow` moved out of `GlobalSearch.tsx` verbatim, with `export` added and the icon prop type changed from the ad-hoc `typeof UserIcon` to the proper `LucideIcon` type (so this file doesn't need to import an unrelated icon component just for typing):

```tsx
import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function SearchGroup({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="py-[6px]">
      <div
        className="flex items-center gap-[6px] px-[14px] py-[4px] text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--foreground-50)" }}
      >
        <Icon size={12} />
        {label}
      </div>
      {children}
    </div>
  );
}

export function ResultRow({
  to,
  params,
  avatar,
  fallbackIcon: FallbackIcon,
  title,
  subtitle,
  onNavigate,
}: {
  to: string;
  params?: Record<string, string>;
  avatar?: string;
  fallbackIcon: LucideIcon;
  title: string;
  subtitle?: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      params={params}
      onClick={onNavigate}
      className="flex items-center gap-[10px] px-[14px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
    >
      {avatar ? (
        <img src={avatar} alt="" className="h-[32px] w-[32px] shrink-0 rounded-full object-cover" />
      ) : (
        <div
          className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <FallbackIcon size={16} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{title}</div>
        {subtitle && (
          <div className="truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>{subtitle}</div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Rewrite `GlobalSearch.tsx` to consume the hook and shared row components**

Replace the full contents of `frontend/src/components/layout/GlobalSearch.tsx` with:

```tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, User as UserIcon, Users2, Megaphone, Compass } from "lucide-react";
import { useGlobalSearch, MIN_QUERY_LENGTH } from "@/lib/hooks/useGlobalSearch";
import { SearchGroup, ResultRow } from "@/components/layout/search/SearchResultRow";

/** Header search — live dropdown split by content type (люди, сообщества,
 *  объявления, направления), VK-style. Replaces the old behavior of only
 *  ever being able to search ads via a catalog redirect. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const q = value.trim();
  const { results, loading } = useGlobalSearch(q);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const hasAny =
    results.users.length > 0 || results.communities.length > 0 || results.ads.length > 0 || results.categories.length > 0;

  const goToCatalog = () => {
    setOpen(false);
    void navigate({ to: "/ads", search: q ? { q } : {} });
  };

  return (
    <div className="relative min-w-0 max-w-[420px] flex-1" ref={containerRef}>
      <Search
        size={16}
        className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2"
        style={{ color: "var(--foreground-50)" }}
      />
      <input
        type="search"
        placeholder="Поиск по сайту"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") goToCatalog();
          if (e.key === "Escape") setOpen(false);
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

      {open && q.length >= MIN_QUERY_LENGTH && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] overflow-y-auto"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            boxShadow: "var(--shadow-float)",
          }}
        >
          {!hasAny ? (
            <div className="px-[14px] py-[14px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
              {loading ? "Ищем…" : "Ничего не найдено"}
            </div>
          ) : (
            <>
              {results.categories.length > 0 && (
                <SearchGroup label="Направления" icon={Compass}>
                  {results.categories.map((c) => (
                    <ResultRow
                      key={c.id}
                      to="/categories/$id"
                      params={{ id: c.id }}
                      fallbackIcon={Compass}
                      title={c.name}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </SearchGroup>
              )}
              {results.users.length > 0 && (
                <SearchGroup label="Люди" icon={UserIcon}>
                  {results.users.map((u) => (
                    <ResultRow
                      key={u.id}
                      to="/user/$id"
                      params={{ id: u.slug ?? u.id }}
                      avatar={u.avatar}
                      fallbackIcon={UserIcon}
                      title={u.name}
                      subtitle={u.city}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </SearchGroup>
              )}
              {results.communities.length > 0 && (
                <SearchGroup label="Сообщества" icon={Users2}>
                  {results.communities.map((c) => (
                    <ResultRow
                      key={c.id}
                      to="/communities/$id"
                      params={{ id: c.id }}
                      avatar={c.avatarImage}
                      fallbackIcon={Users2}
                      title={c.name}
                      subtitle={`${c.members} участников`}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </SearchGroup>
              )}
              {results.ads.length > 0 && (
                <SearchGroup label="Объявления" icon={Megaphone}>
                  {results.ads.map((ad) => (
                    <ResultRow
                      key={ad.id}
                      to="/ads/$id"
                      params={{ id: ad.id }}
                      avatar={ad.image}
                      fallbackIcon={Megaphone}
                      title={ad.title}
                      subtitle={`${ad.price.toLocaleString("ru-RU")} ₽`}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </SearchGroup>
              )}
            </>
          )}
          <button
            type="button"
            onClick={goToCatalog}
            className="w-full px-[14px] py-[10px] text-left text-[13px] font-medium transition-colors hover:bg-[var(--background-surface)]"
            style={{ borderTop: "1px solid var(--border)", color: "var(--accent)" }}
          >
            Все объявления по запросу «{q}»
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual regression check on desktop**

Run the dev server at a `lg`+ viewport (≥1024px width), open the header search, type a query matching at least one user/community/ad/category. Confirm the dropdown looks and behaves exactly as before: grouped sections in the same order (Направления, Люди, Сообщества, Объявления), "Ищем…"/"Ничего не найдено" states, Enter/Escape handling, click-outside closing, and the "Все объявления по запросу…" footer link.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/search/SearchResultRow.tsx frontend/src/components/layout/GlobalSearch.tsx
git commit -m "refactor(search): extract SearchResultRow + useGlobalSearch from GlobalSearch"
```

---

### Task 4: Build `MobileSearchOverlay.tsx`

**Files:**
- Create: `frontend/src/components/layout/MobileSearchOverlay.tsx`

**Interfaces:**
- Consumes: `useGlobalSearch`, `MIN_QUERY_LENGTH`, `SearchResults` (Task 2); `SearchGroup`, `ResultRow` (Task 3); `getViewHistory`, `ViewHistoryItem` (Task 1's widened type, `@/lib/view-history`).
- Produces: `MobileSearchOverlay({ open: boolean; onClose: () => void })`. Task 6 (`MobileHeader.tsx`) imports this by this exact name and prop shape.

- [ ] **Step 1: Create the component**

Create `frontend/src/components/layout/MobileSearchOverlay.tsx`:

```tsx
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search as SearchIcon, User as UserIcon, Users2, Megaphone, Compass, Clock, Clapperboard,
  type LucideIcon,
} from "lucide-react";
import { useGlobalSearch, MIN_QUERY_LENGTH, type SearchResults } from "@/lib/hooks/useGlobalSearch";
import { SearchGroup, ResultRow } from "@/components/layout/search/SearchResultRow";
import { getViewHistory, type ViewHistoryItem } from "@/lib/view-history";

type TabKey = "all" | "users" | "communities" | "ads" | "categories";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "users", label: "Люди" },
  { key: "communities", label: "Сообщества" },
  { key: "ads", label: "Объявления" },
  { key: "categories", label: "Направления" },
];

const KIND_ROUTE: Record<ViewHistoryItem["kind"], { to: string; icon: LucideIcon }> = {
  ad: { to: "/ads/$id", icon: Megaphone },
  profile: { to: "/user/$id", icon: UserIcon },
  review: { to: "/reviews/$id", icon: Clapperboard },
  community: { to: "/communities/$id", icon: Users2 },
};

const TAB_RESULT_KEY: Record<Exclude<TabKey, "all">, keyof SearchResults> = {
  users: "users",
  communities: "communities",
  ads: "ads",
  categories: "categories",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Full-screen mobile search takeover — VK-style tabs by content type plus a
 *  "recent" block backed by the shared view-history mechanism. Desktop keeps
 *  the GlobalSearch dropdown; this is lg:hidden-scoped only. */
export function MobileSearchOverlay({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const q = query.trim();
  // Fixed perPage regardless of activeTab: the hook's effect depends on
  // [q, perPage], so a tab-dependent perPage would re-fetch on every tab
  // switch, violating "tabs filter already-fetched results, no new request
  // per tab" (spec §Решения #4). Fetch once at the largest size any tab
  // needs (20), then slice smaller per-group counts locally for the "Все"
  // tab display below.
  const { results, loading } = useGlobalSearch(q, { perPage: 20 });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const close = () => {
    onClose();
    setQuery("");
    setActiveTab("all");
  };

  const hasAny =
    results.users.length > 0 || results.communities.length > 0 || results.ads.length > 0 || results.categories.length > 0;
  const activeHasAny = activeTab === "all" ? hasAny : results[TAB_RESULT_KEY[activeTab]].length > 0;
  const recentItems = q.length === 0 ? getViewHistory() : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex flex-col lg:hidden"
          style={{ height: "100dvh", background: "var(--background)" }}
        >
          <div
            className="flex shrink-0 items-center gap-2 px-4"
            style={{ paddingTop: "calc(var(--safe-top) + 8px)", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}
          >
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                size={16}
                className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2"
                style={{ color: "var(--foreground-50)" }}
              />
              <input
                type="search"
                autoFocus
                placeholder="Поиск по сайту"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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
            </div>
            <button
              type="button"
              onClick={close}
              className="shrink-0 text-[14px] font-medium"
              style={{ color: "var(--accent)" }}
            >
              Отмена
            </button>
          </div>

          <div
            className="flex shrink-0 gap-[6px] overflow-x-auto px-4 py-[10px]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className="shrink-0 whitespace-nowrap text-[13px] font-medium transition-colors"
                style={{
                  background: activeTab === t.key ? "var(--accent-soft)" : "var(--background-elevated)",
                  color: activeTab === t.key ? "var(--accent)" : "var(--foreground-70)",
                  border: `1px solid ${activeTab === t.key ? "var(--border-accent)" : "var(--border)"}`,
                  borderRadius: "var(--r-tag)",
                  padding: "0 14px",
                  height: 32,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {q.length === 0 ? (
              recentItems.length > 0 && (
                <SearchGroup label="Недавние" icon={Clock}>
                  {recentItems.map((item) => {
                    const { to, icon } = KIND_ROUTE[item.kind];
                    return (
                      <ResultRow
                        key={`${item.kind}-${item.id}`}
                        to={to}
                        params={{ id: item.id }}
                        avatar={item.thumb}
                        fallbackIcon={icon}
                        title={item.title}
                        onNavigate={close}
                      />
                    );
                  })}
                </SearchGroup>
              )
            ) : q.length < MIN_QUERY_LENGTH ? null : !activeHasAny ? (
              <div className="px-[14px] py-[14px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
                {loading ? "Ищем…" : "Ничего не найдено"}
              </div>
            ) : activeTab === "all" ? (
              // "Все" mirrors desktop's per-group limits (4/4/5/5) by slicing
              // the already-fetched (up to 20 each) arrays for display only —
              // no extra fetch, see the useGlobalSearch call above.
              <>
                {results.categories.length > 0 && (
                  <SearchGroup label="Направления" icon={Compass}>
                    {results.categories.slice(0, 5).map((c) => (
                      <ResultRow key={c.id} to="/categories/$id" params={{ id: c.id }} fallbackIcon={Compass} title={c.name} onNavigate={close} />
                    ))}
                  </SearchGroup>
                )}
                {results.users.length > 0 && (
                  <SearchGroup label="Люди" icon={UserIcon}>
                    {results.users.slice(0, 4).map((u) => (
                      <ResultRow key={u.id} to="/user/$id" params={{ id: u.slug ?? u.id }} avatar={u.avatar} fallbackIcon={UserIcon} title={u.name} subtitle={u.city} onNavigate={close} />
                    ))}
                  </SearchGroup>
                )}
                {results.communities.length > 0 && (
                  <SearchGroup label="Сообщества" icon={Users2}>
                    {results.communities.slice(0, 4).map((c) => (
                      <ResultRow key={c.id} to="/communities/$id" params={{ id: c.id }} avatar={c.avatarImage} fallbackIcon={Users2} title={c.name} subtitle={`${c.members} участников`} onNavigate={close} />
                    ))}
                  </SearchGroup>
                )}
                {results.ads.length > 0 && (
                  <SearchGroup label="Объявления" icon={Megaphone}>
                    {results.ads.slice(0, 5).map((ad) => (
                      <ResultRow key={ad.id} to="/ads/$id" params={{ id: ad.id }} avatar={ad.image} fallbackIcon={Megaphone} title={ad.title} subtitle={`${ad.price.toLocaleString("ru-RU")} ₽`} onNavigate={close} />
                    ))}
                  </SearchGroup>
                )}
              </>
            ) : (
              <>
                {activeTab === "categories" && results.categories.map((c) => (
                  <ResultRow key={c.id} to="/categories/$id" params={{ id: c.id }} fallbackIcon={Compass} title={c.name} onNavigate={close} />
                ))}
                {activeTab === "users" && results.users.map((u) => (
                  <ResultRow key={u.id} to="/user/$id" params={{ id: u.slug ?? u.id }} avatar={u.avatar} fallbackIcon={UserIcon} title={u.name} subtitle={u.city} onNavigate={close} />
                ))}
                {activeTab === "communities" && results.communities.map((c) => (
                  <ResultRow key={c.id} to="/communities/$id" params={{ id: c.id }} avatar={c.avatarImage} fallbackIcon={Users2} title={c.name} subtitle={`${c.members} участников`} onNavigate={close} />
                ))}
                {activeTab === "ads" && results.ads.map((ad) => (
                  <ResultRow key={ad.id} to="/ads/$id" params={{ id: ad.id }} avatar={ad.image} fallbackIcon={Megaphone} title={ad.title} subtitle={`${ad.price.toLocaleString("ru-RU")} ₽`} onNavigate={close} />
                ))}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. (The component is not mounted anywhere yet, so this only checks the file's own types — `KIND_ROUTE`/`TAB_RESULT_KEY` exhaustiveness over `ViewHistoryItem["kind"]`/`TabKey` in particular.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/MobileSearchOverlay.tsx
git commit -m "feat(search): add MobileSearchOverlay full-screen mobile search panel"
```

---

### Task 5: Wire the overlay into `MobileHeader.tsx`

**Files:**
- Modify: `frontend/src/components/layout/MobileHeader.tsx`

**Interfaces:**
- Consumes: `MobileSearchOverlay` from Task 4 (`@/components/layout/MobileSearchOverlay`).

- [ ] **Step 1: Add the import**

In `frontend/src/components/layout/MobileHeader.tsx`, add near the other local imports (after the `FeedbackDialog` import, line 10):

```ts
import { MobileSearchOverlay } from "@/components/layout/MobileSearchOverlay";
```

- [ ] **Step 2: Add local state and wrap the header in a fragment**

Change the start of the `MobileHeader` function (currently lines 32-37):

```tsx
export function MobileHeader() {
  const { t } = useTranslation();
  const unread = useUnreadNotifications();

  return (
    <header
```

to:

```tsx
export function MobileHeader() {
  const { t } = useTranslation();
  const unread = useUnreadNotifications();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header
```

- [ ] **Step 3: Replace the search `Link` with a `button`, close the fragment**

Change (currently lines 56-63):

```tsx
          <Link
            to="/ads"
            aria-label="Поиск"
            className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground-70)" }}
          >
            <Search size={20} />
          </Link>
```

to:

```tsx
          <button
            type="button"
            aria-label="Поиск"
            onClick={() => setSearchOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground-70)" }}
          >
            <Search size={20} />
          </button>
```

Then change the closing of the function (currently lines 100-105):

```tsx
          <MoreMenu />
        </div>
      </div>
    </header>
  );
}
```

to:

```tsx
          <MoreMenu />
        </div>
      </div>
      </header>
      <MobileSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
```

(Re-indent the `</header>` line to match the rest of the file's formatting — the exact whitespace doesn't matter for compilation, only the JSX structure: one `<header>` and one `<MobileSearchOverlay>` as siblings inside a single top-level fragment.)

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/MobileHeader.tsx
git commit -m "feat(search): open MobileSearchOverlay from the mobile header search icon"
```

---

### Task 6: Live regression pass and deploy

**Files:** none (verification only).

**Interfaces:** none — this task consumes the finished feature end-to-end.

- [ ] **Step 1: Push and deploy to the neeklo stand**

```bash
git push origin neeklo
```

Then SSH-deploy per the project's standing deploy process: `ssh root@31.207.75.124 'cd /var/www/modelizmclub-neeklo && git pull origin neeklo && bash deploy/scripts/deploy-neeklo-frontend.sh'`.

- [ ] **Step 2: Live-verify on mobile viewports 360/390/430**

Using a real browser (not just tsc), against the deployed neeklo stand, at each of 360px, 390px, and 430px width, walk the spec's acceptance checklist:

- Tap "Поиск" in `MobileHeader` → the full-screen overlay opens with no layout jump on the page behind it; the keyboard appears immediately (`autoFocus`).
- Empty query + empty `view-history` (fresh/incognito session) → body is empty, no "Недавние" header rendered at all.
- Empty query + non-empty `view-history` (visit a profile and a community first to populate it via Task 1's `recordView` calls, then reopen the overlay) → "Недавние" shows those real entries, and tapping one navigates to the correct profile/community.
- Type a query (≥2 characters) that matches known data → results render grouped by section under the "Все" tab, matching what the desktop dropdown shows for the same query.
- Switch to "Люди" / "Объявления" / etc. → filtering is instant (watch the Network tab / request log — confirm no new HTTP request fires on tab switch), showing up to 20 results of just that type.
- With the on-screen keyboard open, scroll to the last result in a long list → it's fully visible and scrollable, not clipped under the keyboard.
- Tap "Отмена" → overlay closes, the underlying page is unchanged (not reloaded, scroll position preserved).
- Open the desktop dropdown at a ≥1024px viewport → confirm it's still visually and functionally identical to before Task 3's refactor.

- [ ] **Step 3: Fix any issues found live, redeploy, and re-verify**

If live verification surfaces a bug, fix it, commit, redeploy (repeat Step 1), and re-run the specific checklist item(s) that failed until they pass.
