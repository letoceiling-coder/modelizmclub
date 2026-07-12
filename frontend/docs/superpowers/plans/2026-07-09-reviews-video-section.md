# Обзоры (Video Content Section) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new top-level "Обзоры" section — a RUTUBE-style video hub with hero carousel, alphabetical category tabs, search, sort-by-newest, preview-card rows, a mobile-first watch page with a native HTML5 player (poster-first, load-on-tap, auth-gated), likes + comments (reusing the Feed's system), an admin-gated upload route, and an admin management section. Fully demo-testable; real video storage/streaming/CDN documented as a backend spec, not built.

**Architecture:** Mirrors the "Сообщества" section's route/data/nav/flag pattern; reuses `ui/carousel.tsx` (+ new `embla-carousel-autoplay` dep) for the hero, `SimilarAds` snap-rows for preview rows, `CatalogCard`'s lazy-load/placeholder pattern for posters, the landing's `navigator.connection` gating for the player, `CommentSection` verbatim for comments, and the `feed.ts` `reactTo*`/`*Comments` contracts (path-swapped `/posts/`→`/videos/`) for interactions.

**Tech Stack:** React 19 + TypeScript strict, TanStack Router (file-based), `embla-carousel-react` ^8.6.0 (+ `embla-carousel-autoplay` ^8.6.0 to add), native HTML5 `<video>` (no player library), existing store/demo-mode/API conventions.

## Testing convention (read first)

This frontend has **no unit-test framework** — verification across the whole project is `npx tsc --noEmit` (run from `frontend/`) plus live browser checks. Every task below therefore uses **tsc-clean + explicit live/manual verification** as its gate, not `*.test.ts` files. Do **not** add a test runner. Run all `npx tsc --noEmit` from the `frontend/` directory. A dev server on `http://localhost:8080` is assumed for live checks (`cd frontend && (npm run dev > /tmp/reviews-verify.log 2>&1 &)` then `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/` to confirm 200).

## Global Constraints (bind every task)

- Frontend-only; no backend code changes. Real endpoints don't exist — document, don't implement.
- Mobile-first: verify at 375px before desktop.
- `npx tsc --noEmit` clean after every task.
- No commit/push without explicit user permission — EXCEPT the per-task commits below, which are the task deliverable and are expected.
- New nav item is **Sidebar only**, never `BottomNav`.
- Categories: "Все" first, then strictly alphabetical (`localeCompare`).
- Playback requires auth (`!getToken() && !isDemoMode()` → toast + redirect `/login`).
- No DRM claim — `controlsList="nodownload"` only; documented as not real protection.
- Player downloads no video bytes before an explicit tap (`preload="none"`, `src` unattached until play).
- Bundled demo sample video must be genuinely public-domain/CC with attribution recorded — Big Buck Bunny (CC BY 3.0), not an arbitrary file.
- Likes + comments only (NO save/bookmark, NO star-ratings). `views` is a separate passive counter. "Пожаловаться" is a toast stub at exact parity with posts.

---

### Task 1: Scaffolding — feature flag, nav, routes, i18n, admin toggle, empty page shells

**Files:**
- Modify: `frontend/src/lib/config/featureFlags.ts`
- Modify: `frontend/src/lib/routes.ts`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/lib/i18n/locales/ru.ts`, `en.ts`, `zh.ts`
- Modify: `frontend/src/routes/admin.tsx` (SettingsSection toggle only — the admin `ReviewsSection` is Task 9)
- Create: `frontend/src/routes/reviews.tsx`, `frontend/src/routes/reviews.index.tsx`

**Interfaces:**
- Produces: `FeatureFlags.reviewsEnabled: boolean`; `ROUTES.reviews`/`ROUTES.review(id)`/`ROUTES.reviewUpload`; a Sidebar "Обзоры" item gated by `reviewsEnabled`; `nav.reviews` locale key; empty `/reviews` and `/reviews/upload`-less shells (upload route is Task 8). Later tasks fill `reviews.index.tsx` (Task 5) and add `reviews.$id.tsx` (Task 6).

- [ ] **Step 1: Add `reviewsEnabled` to the feature-flags interface + defaults**

In `frontend/src/lib/config/featureFlags.ts`, change:
```ts
export interface FeatureFlags {
  communitiesEnabled: boolean;
}

const DEFAULTS: FeatureFlags = {
  communitiesEnabled: false,
};
```
to:
```ts
export interface FeatureFlags {
  communitiesEnabled: boolean;
  reviewsEnabled: boolean;
}

const DEFAULTS: FeatureFlags = {
  communitiesEnabled: false,
  reviewsEnabled: false,
};
```

- [ ] **Step 2: Add routes to `ROUTES` + `SIDEBAR_ROUTE_MAP`**

In `frontend/src/lib/routes.ts`, inside the `ROUTES` object add (after the `notifications` line, before the closing `} as const;`):
```ts
  reviews: "/reviews",
  review: (id: string) => `/reviews/${id}` as const,
  reviewUpload: "/reviews/upload",
```
In `SIDEBAR_ROUTE_MAP`, add these two entries — **`"review-upload"` must come BEFORE `reviews`** (first-match rule, same as the `ad-create`/`ads` precedent):
```ts
  "review-upload": ["/reviews/upload"],
  reviews: ["/reviews"],
```

- [ ] **Step 3: Add the Sidebar nav item, gated by `reviewsEnabled`**

In `frontend/src/components/layout/Sidebar.tsx`:
1. Add `Clapperboard` to the lucide import:
```ts
import { Newspaper, Users2, Radio, MessageSquare, Megaphone, UserPlus, ClipboardList, Plus, ShoppingBag, ExternalLink, Heart, Clapperboard } from "lucide-react";
```
2. Extend the `Item.to` union to include `"/reviews"`:
```ts
  to: "/feed" | "/ads" | "/ads/new" | "/my-ads" | "/favorites" | "/communities" | "/reviews" | "/channels" | "/messenger" | "/friends";
```
3. Add an `ALL_ITEMS` entry right after the `communities` line:
```ts
  { to: ROUTES.reviews,      labelKey: "nav.reviews", icon: Clapperboard, section: "reviews" },
```
4. Add a second flag read and extend the filter. Replace:
```ts
  const communitiesEnabled = useFeatureFlag("communitiesEnabled");
  const items = ALL_ITEMS.filter((i) => i.to !== ROUTES.communities || communitiesEnabled);
```
with:
```ts
  const communitiesEnabled = useFeatureFlag("communitiesEnabled");
  const reviewsEnabled = useFeatureFlag("reviewsEnabled");
  const items = ALL_ITEMS.filter(
    (i) =>
      (i.to !== ROUTES.communities || communitiesEnabled) &&
      (i.to !== ROUTES.reviews || reviewsEnabled),
  );
```
(Both the full sidebar `.map` and the collapsed icon-rail `.map` already iterate `items`, so no further render change is needed.)

- [ ] **Step 4: Add `nav.reviews` to all three locales**

`ru.ts` is the `TranslationSchema` source — add there first. In `frontend/src/lib/i18n/locales/ru.ts`, inside `nav:` add:
```ts
    reviews: "Обзоры",
```
In `en.ts` `nav:` add:
```ts
    reviews: "Reviews",
```
In `zh.ts` `nav:` add:
```ts
    reviews: "评测",
```

- [ ] **Step 5: Add the `reviewsEnabled` admin toggle**

In `frontend/src/routes/admin.tsx`, in `SettingsSection`, after `const communitiesEnabled = useFeatureFlag("communitiesEnabled");` add:
```ts
  const reviewsEnabled = useFeatureFlag("reviewsEnabled");
```
Then, immediately after the existing `<label>` block for "Показывать раздел «Сообщества»" (inside the same feature-flags card `<div>`), add a second label:
```tsx
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36 }}>
          <input
            type="checkbox"
            checked={reviewsEnabled}
            onChange={(e) => setFeatureFlag("reviewsEnabled", e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>Показывать раздел «Обзоры»</span>
        </label>
```

- [ ] **Step 6: Create the route shells**

Create `frontend/src/routes/reviews.tsx`:
```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/reviews")({
  component: () => <Outlet />,
});
```
Create `frontend/src/routes/reviews.index.tsx` (placeholder — filled in Task 5):
```tsx
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/reviews/")({
  head: () => ({ meta: [{ title: "Обзоры — МоДелизМ" }] }),
  component: ReviewsPage,
});

function ReviewsPage() {
  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto max-w-[1100px] py-[40px]">
        <h1 className="font-display text-[28px] font-bold" style={{ color: "var(--foreground)" }}>
          Обзоры
        </h1>
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean. (The TanStack Router route tree is regenerated by the dev server / vite plugin; if a `routeTree.gen.ts` error appears for the new routes, start the dev server once to regenerate it, then re-run tsc — this is the established pattern in this repo. Commit the regenerated `routeTree.gen.ts` alongside the routes.)

- [ ] **Step 8: Live verification (375px first, then desktop)**

Start the dev server. At 375px and desktop: open `/admin` → Настройки → confirm a new "Показывать раздел «Обзоры»" checkbox; toggle it on; confirm "Обзоры" appears in the Sidebar (desktop) with the Clapperboard icon; confirm it does NOT appear in the mobile BottomNav; click it → lands on the `/reviews` placeholder page. Toggle the flag off → the Sidebar item disappears.

- [ ] **Step 9: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/lib/config/featureFlags.ts frontend/src/lib/routes.ts frontend/src/components/layout/Sidebar.tsx frontend/src/lib/i18n/locales/ru.ts frontend/src/lib/i18n/locales/en.ts frontend/src/lib/i18n/locales/zh.ts frontend/src/routes/admin.tsx frontend/src/routes/reviews.tsx frontend/src/routes/reviews.index.tsx frontend/src/routeTree.gen.ts
git commit -m "feat(reviews): scaffold Обзоры section — flag, nav, routes, admin toggle"
```

---

### Task 2: Data model + demo data + API layer

**Files:**
- Modify: `frontend/src/lib/mock.ts` (add `Video`/`VideoCategory` types, `mockVideoCategories`, `mockVideos`)
- Modify: `frontend/src/lib/demo-data.ts` (demo functions)
- Create: `frontend/src/lib/api/reviews.ts`
- Modify: `frontend/src/lib/api/media.ts` (add `"review_video"` purpose)

**Interfaces:**
- Consumes: `Comment`/`ID`/`userById` from `mock.ts`; `isDemoMode`; the `feed.ts` comment/reaction contracts (copied, path-swapped).
- Produces: `Video`, `VideoCategory` types; `mockVideos`, `mockVideoCategories`; `demoVideos(query?, categorySlug?)`, `demoVideo(id)`, `demoVideoCategories()`, `demoFeaturedVideos()`, `demoIncrementVideoView(id)`, `demoVideoComments(id)`, `demoAddVideo(v)`; and in `lib/api/reviews.ts`: `fetchVideos(params)`, `fetchVideo(id)`, `fetchVideoCategories()`, `incrementVideoView(id)`, `uploadVideo(input)`, `reactToVideo(uuid, on)`, `fetchVideoComments(uuid)`, `createVideoComment(uuid, body, parentUuid?)`, plus the `VideoUploadInput` type. Task 5/6/8/9 consume these.

- [ ] **Step 1: Add `Video` + `VideoCategory` types to `mock.ts`**

In `frontend/src/lib/mock.ts`, after the `Comment` interface, add:
```ts
export interface VideoCategory {
  id: ID;
  name: string;
  slug: string;
}

export interface Video {
  id: ID;                    // uuid
  title: string;
  description: string;
  categoryId: ID;            // -> VideoCategory.id
  posterUrl: string;
  videoUrl: string;
  durationSeconds: number;
  views: number;             // passive watch counter, separate from likes/comments
  isFeatured: boolean;       // hero-carousel curation
  tags: string[];
  publishedAt: string;       // ISO date, newest-first sort key
  uploaderId: ID;
  status: "processing" | "published";
  // Social fields — mirror the relevant Post interaction fields. Likes + comments only.
  likes: number;
  comments: number;
  isLiked?: boolean;
  commentList?: Comment[];   // the SAME Comment type, reused unchanged
}
```

- [ ] **Step 2: Add `mockVideoCategories` + `mockVideos` to `mock.ts`**

Append (near the other mock exports, e.g. after `mockCommunities`/`communities`):
```ts
export const mockVideoCategories: VideoCategory[] = [
  { id: "vc-avia",   name: "Авиация",          slug: "aviaciya" },
  { id: "vc-auto",   name: "Автомодели",       slug: "avtomodeli" },
  { id: "vc-kvadro", name: "Квадрокоптеры",    slug: "kvadrokoptery" },
  { id: "vc-korabli",name: "Корабли",          slug: "korabli" },
  { id: "vc-radio",  name: "Радиоаппаратура",  slug: "radioapparatura" },
  { id: "vc-elektro",name: "Электроника",      slug: "elektronika" },
];

const DEMO_VIDEO_SRC = "/videos/demo-review-sample.mp4"; // bundled in Task 3

// Deterministic seeded catalog. All videoUrl point at the one bundled sample.
// publishedAt staggered (newest first is visibly meaningful). Several featured.
export const mockVideos: Video[] = [
  { id: "v1", title: "Первый полёт FPV-крыла: настройка и тримминг", description: "Полный разбор сборки и первого запуска FPV-крыла, настройка аппаратуры и полётного контроллера.", categoryId: "vc-avia", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 754, views: 12480, isFeatured: true, tags: ["FPV", "крыло", "настройка"], publishedAt: "2026-07-08T10:00:00Z", uploaderId: "u1", status: "published", likes: 342, comments: 2 },
  { id: "v2", title: "Багги 1:8 ДВС — обкатка нового мотора Picco", description: "Обкатываем свежий мотор, замеряем температуру, подбираем иглы карбюратора.", categoryId: "vc-auto", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 1263, views: 8320, isFeatured: true, tags: ["багги", "ДВС", "обкатка"], publishedAt: "2026-07-07T14:30:00Z", uploaderId: "u2", status: "published", likes: 210, comments: 1 },
  { id: "v3", title: "Квадрокоптер 5\" фристайл — сборка с нуля", description: "Собираем фристайл-квадрик, паяем, прошиваем Betaflight.", categoryId: "vc-kvadro", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 2105, views: 21050, isFeatured: true, tags: ["квадрокоптер", "фристайл", "Betaflight"], publishedAt: "2026-07-06T09:15:00Z", uploaderId: "u3", status: "published", likes: 560, comments: 3 },
  { id: "v4", title: "RC-катер из стеклопластика — первый спуск на воду", description: "Ходовые испытания самодельного катера на пруду.", categoryId: "vc-korabli", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 489, views: 5410, isFeatured: false, tags: ["катер", "стеклопластик"], publishedAt: "2026-07-05T18:00:00Z", uploaderId: "u5", status: "published", likes: 98, comments: 0 },
  { id: "v5", title: "Обзор аппаратуры RadioMaster TX16S MKII", description: "Разбираем флагманский пульт, прошивка EdgeTX, модуль ELRS.", categoryId: "vc-radio", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 933, views: 15600, isFeatured: false, tags: ["аппаратура", "EdgeTX", "ELRS"], publishedAt: "2026-07-04T11:00:00Z", uploaderId: "u4", status: "published", likes: 401, comments: 1 },
  { id: "v6", title: "Пайка ESC и настройка регулятора Hobbywing", description: "Аккуратная пайка силовых проводов и калибровка регулятора.", categoryId: "vc-elektro", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 671, views: 7230, isFeatured: false, tags: ["ESC", "пайка", "Hobbywing"], publishedAt: "2026-07-03T16:45:00Z", uploaderId: "u7", status: "published", likes: 156, comments: 0 },
  { id: "v7", title: "Пилотаж на самолёте 3D — базовые фигуры", description: "Учимся крутить харрикейн и торк-роллы на пилотажке.", categoryId: "vc-avia", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 1420, views: 9840, isFeatured: false, tags: ["самолёт", "3D", "пилотаж"], publishedAt: "2026-07-02T12:20:00Z", uploaderId: "u8", status: "published", likes: 233, comments: 0 },
  { id: "v8", title: "Тюнинг подвески туринга 1:10", description: "Настройка развала, клиренса и жёсткости для асфальта.", categoryId: "vc-auto", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 812, views: 6120, isFeatured: false, tags: ["туринг", "подвеска", "тюнинг"], publishedAt: "2026-07-01T08:00:00Z", uploaderId: "u4", status: "published", likes: 187, comments: 0 },
];
```
Populate `commentList` for `v1`/`v2`/`v3` with a couple of `Comment` objects each (real `Comment` shape, `authorId` from `u1`-`u8`) so the demo comment thread is non-empty — mirror the shape of `posts[].commentList` already in the file. Set each video's `comments` count to match its `commentList.length`.

- [ ] **Step 3: Add `"review_video"` media purpose**

In `frontend/src/lib/api/media.ts`, change:
```ts
export type MediaPurpose = "avatar" | "post" | "post_video" | "listing" | "chat";
```
to:
```ts
export type MediaPurpose = "avatar" | "post" | "post_video" | "review_video" | "listing" | "chat";
```

- [ ] **Step 4: Add demo functions to `demo-data.ts`**

In `frontend/src/lib/demo-data.ts`, add `mockVideos`, `mockVideoCategories`, `Video`, `VideoCategory` to the `@/lib/mock` import block, then append:
```ts
// ── reviews / videos ─────────────────────────────────────────────────────────
const videoViewOverrides = new Map<ID, number>();
const sessionVideos: Video[] = []; // videos uploaded during this demo session

function allDemoVideos(): Video[] {
  return [...sessionVideos, ...mockVideos].map((v) => ({
    ...v,
    views: v.views + (videoViewOverrides.get(v.id) ?? 0),
  }));
}

export function demoVideoCategories(): VideoCategory[] {
  return mockVideoCategories;
}

export function demoVideos(query?: string, categorySlug?: string): Video[] {
  let list = allDemoVideos();
  if (categorySlug && categorySlug !== "all") {
    const cat = mockVideoCategories.find((c) => c.slug === categorySlug);
    if (cat) list = list.filter((v) => v.categoryId === cat.id);
  }
  if (query) {
    const q = query.toLowerCase();
    const catName = (id: ID) => mockVideoCategories.find((c) => c.id === id)?.name.toLowerCase() ?? "";
    list = list.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.tags.some((t) => t.toLowerCase().includes(q)) ||
        catName(v.categoryId).includes(q),
    );
  }
  return list.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)); // newest first
}

export function demoVideo(id: ID): Video | null {
  return allDemoVideos().find((v) => v.id === id) ?? null;
}

export function demoFeaturedVideos(): Video[] {
  return allDemoVideos().filter((v) => v.isFeatured).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function demoIncrementVideoView(id: ID): void {
  videoViewOverrides.set(id, (videoViewOverrides.get(id) ?? 0) + 1);
}

export function demoVideoComments(id: ID): Comment[] {
  return allDemoVideos().find((v) => v.id === id)?.commentList ?? [];
}

export function demoAddVideo(v: Video): void {
  sessionVideos.unshift(v);
}
```
(Add `Comment` to the mock import block if not already imported there.)

- [ ] **Step 5: Create `lib/api/reviews.ts`**

Create `frontend/src/lib/api/reviews.ts`:
```ts
import type { Video, VideoCategory, Comment } from "@/lib/mock";
import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import {
  demoVideos,
  demoVideo,
  demoVideoCategories,
  demoFeaturedVideos,
  demoIncrementVideoView,
  demoVideoComments,
  demoAddVideo,
} from "@/lib/demo-data";

interface Paginated<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

// Real-branch adapter shape — documented in backend-endpoints-needed.md (Task 10).
interface ApiVideo {
  uuid: string;
  title: string;
  description?: string | null;
  category?: { id?: string; slug?: string } | null;
  poster_url?: string | null;
  video_url?: string | null;
  duration_seconds?: number;
  views_count?: number;
  is_featured?: boolean;
  tags?: string[];
  published_at?: string;
  uploader?: { uuid?: string } | null;
  status?: "processing" | "published";
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

function mapVideo(v: ApiVideo): Video {
  return {
    id: v.uuid,
    title: v.title,
    description: v.description ?? "",
    categoryId: v.category?.id ?? "",
    posterUrl: v.poster_url ?? "",
    videoUrl: v.video_url ?? "",
    durationSeconds: v.duration_seconds ?? 0,
    views: v.views_count ?? 0,
    isFeatured: v.is_featured ?? false,
    tags: v.tags ?? [],
    publishedAt: v.published_at ?? "",
    uploaderId: v.uploader?.uuid ?? "",
    status: v.status ?? "published",
    likes: v.likes_count ?? 0,
    comments: v.comments_count ?? 0,
    isLiked: v.is_liked ?? false,
  };
}

export interface VideoListParams {
  q?: string;
  categorySlug?: string;
  featured?: boolean;
}

export async function fetchVideos(params: VideoListParams = {}): Promise<Video[]> {
  if (isDemoMode()) {
    if (params.featured) return demoFeaturedVideos();
    return demoVideos(params.q, params.categorySlug);
  }
  const res = await api<Paginated<ApiVideo>>("/videos", {
    query: {
      q: params.q || undefined,
      category: params.categorySlug || undefined,
      featured: params.featured ? 1 : undefined,
      sort: "new",
      per_page: 50,
    },
  });
  return (res.data ?? []).map(mapVideo);
}

export async function fetchVideoCategories(): Promise<VideoCategory[]> {
  if (isDemoMode()) return demoVideoCategories();
  const res = await api<Paginated<VideoCategory>>("/videos/categories");
  return res.data ?? [];
}

export async function fetchVideo(id: string): Promise<Video> {
  if (isDemoMode()) {
    const v = demoVideo(id);
    if (v) return v;
    throw new Error("Video not found");
  }
  const res = await api<{ data: ApiVideo }>(`/videos/${id}`);
  return mapVideo(res.data);
}

export async function incrementVideoView(id: string): Promise<void> {
  if (isDemoMode()) {
    demoIncrementVideoView(id);
    return;
  }
  await api(`/videos/${id}/view`, { method: "POST" });
}

export interface VideoUploadInput {
  title: string;
  description: string;
  categoryId: string;
  tags: string[];
  posterMediaId: string;
  videoMediaId: string;
  posterUrl: string;   // demo: blob URL for immediate preview
  videoUrl: string;    // demo: blob URL for immediate playback
  isFeatured: boolean;
}

export async function uploadVideo(input: VideoUploadInput): Promise<Video> {
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const v: Video = {
      id: `demo-v-${Date.now()}`,
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      posterUrl: input.posterUrl,
      videoUrl: input.videoUrl,
      durationSeconds: 0,
      views: 0,
      isFeatured: input.isFeatured,
      tags: input.tags,
      publishedAt: now,
      uploaderId: "u1",
      status: "published",
      likes: 0,
      comments: 0,
      commentList: [],
    };
    demoAddVideo(v);
    return v;
  }
  const res = await api<{ data: ApiVideo }>("/videos", {
    method: "POST",
    json: {
      title: input.title,
      description: input.description,
      category_id: input.categoryId,
      tags: input.tags,
      poster_media_id: input.posterMediaId,
      video_media_id: input.videoMediaId,
      is_featured: input.isFeatured,
    },
  });
  return mapVideo(res.data);
}

// ── Social interactions — exact parity copies of feed.ts (path /posts/ → /videos/) ──

export async function reactToVideo(uuid: string, on: boolean): Promise<void> {
  if (isDemoMode()) return;
  await api(`/videos/${uuid}/react`, { method: on ? "POST" : "DELETE" });
}

export async function fetchVideoComments(uuid: string): Promise<Comment[]> {
  if (isDemoMode()) return demoVideoComments(uuid);
  const res = await api<Paginated<Comment>>(`/videos/${uuid}/comments`);
  return res.data ?? [];
}

export async function createVideoComment(
  uuid: string,
  body: string,
  parentUuid?: string,
): Promise<Comment> {
  if (isDemoMode()) {
    return {
      id: `demo-vc-${Date.now()}`,
      authorId: "u1",
      time: "только что",
      text: body,
      likes: 0,
      replies: [],
    };
  }
  const res = await api<{ data: Comment }>(`/videos/${uuid}/comments`, {
    method: "POST",
    json: { body, parent_uuid: parentUuid },
  });
  return res.data;
}
```

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Verify demo data resolves**

Add a temporary check (then remove it): in a scratch or via the dev server console, confirm `demoVideos()` returns 8 items sorted newest-first (`v1` first, `v8` last) and `demoFeaturedVideos()` returns exactly the 3 with `isFeatured: true` (`v1`,`v2`,`v3`). If you can't run a console, verify by re-reading the `demoVideos` sort/filter logic against `mockVideos` and confirming `publishedAt` ordering. This is a nice-to-have signal; the real UI check is Task 5.

- [ ] **Step 8: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/lib/mock.ts frontend/src/lib/demo-data.ts frontend/src/lib/api/reviews.ts frontend/src/lib/api/media.ts
git commit -m "feat(reviews): data model, demo data, and reviews API layer"
```

---

### Task 3: Bundled public-domain sample video asset

**Files:**
- Create: `frontend/public/videos/demo-review-sample.mp4`
- Create: `frontend/public/videos/ATTRIBUTION.md`

**Interfaces:** None (static asset). `mockVideos` (Task 2) already references `/videos/demo-review-sample.mp4`.

- [ ] **Step 1: Acquire the sample clip (Big Buck Bunny, CC BY 3.0)**

Big Buck Bunny is Blender Foundation's open movie, CC BY 3.0 — the industry-standard royalty-free test video. Download a small pre-made clip (no ffmpeg needed):
```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM/frontend/public/videos
curl -L -o demo-review-sample.mp4 "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4"
```
Verify: `ls -la demo-review-sample.mp4` shows a ~1MB file, and `file demo-review-sample.mp4` reports an MP4/ISO Media container.

**If that host is unreachable:** fall back to trimming the canonical Blender master with ffmpeg (requires ffmpeg installed):
```bash
curl -L -o /tmp/bbb-full.mp4 "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
ffmpeg -y -i /tmp/bbb-full.mp4 -t 10 -c:v libx264 -crf 28 -preset veryfast -c:a aac -b:a 96k demo-review-sample.mp4
```
**If both network paths are blocked in the sandbox:** report BLOCKED with the exact reason — the controller will acquire the asset. Do NOT substitute an arbitrary/unknown-license file.

- [ ] **Step 2: Record attribution**

Create `frontend/public/videos/ATTRIBUTION.md`:
```markdown
# Media attribution — demo-review-sample.mp4

**Source:** "Big Buck Bunny" — Blender Foundation open movie.
**Copyright:** © 2008, Blender Foundation / peach.blender.org
**License:** Creative Commons Attribution 3.0 (CC BY 3.0) — https://creativecommons.org/licenses/by/3.0/
**Usage here:** technical placeholder for the Обзоры (video) section demo mode only.
It is NOT presented as ModelizmClub content; all demo video cards point their
`videoUrl` at this one file purely so the HTML5 player is demonstrable without a
real backend/CDN. Not shipped as part of the real catalog.
```

- [ ] **Step 3: Verify playback path**

Start the dev server; open `http://localhost:8080/videos/demo-review-sample.mp4` directly in the browser (or `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/videos/demo-review-sample.mp4`) → expect `200` and a playable video. (Vite serves `public/` at the root.)

- [ ] **Step 4: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/public/videos/demo-review-sample.mp4 frontend/public/videos/ATTRIBUTION.md
git commit -m "chore(reviews): add CC BY 3.0 Big Buck Bunny demo sample video + attribution"
```

---

### Task 4: `VideoCard` component

**Files:**
- Create: `frontend/src/components/reviews/VideoCard.tsx`
- Create: `frontend/src/lib/format-duration.ts` (small helper)

**Interfaces:**
- Consumes: `Video` type (Task 2), `categoryPlaceholder` from `@/lib/placeholder-image`, `ROUTES` from `@/lib/routes`.
- Produces: `VideoCard({ video, className? })`; `formatDuration(seconds): string`. Task 5/6 consume `VideoCard`.

- [ ] **Step 1: Duration formatter**

Create `frontend/src/lib/format-duration.ts`:
```ts
/** Seconds → "m:ss" or "h:mm:ss". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}
```

- [ ] **Step 2: `VideoCard`**

Create `frontend/src/components/reviews/VideoCard.tsx` (poster loading mirrors `CatalogCard`; duration badge white-on-dark bottom-right; views + short date under the title):
```tsx
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play, Eye } from "lucide-react";
import type { Video } from "@/lib/mock";
import { categoryPlaceholder } from "@/lib/placeholder-image";
import { formatDuration } from "@/lib/format-duration";
import { cn } from "@/lib/utils";

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
}

function shortViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "")} тыс.`;
  return String(n);
}

export function VideoCard({ video, className }: { video: Video; className?: string }) {
  const initial = video.posterUrl || categoryPlaceholder(video.id, "");
  const [src, setSrc] = useState(initial);

  return (
    <Link
      to="/reviews/$id"
      params={{ id: video.id }}
      className={cn("group flex flex-col", className)}
    >
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: "16 / 9", background: "var(--background-surface)", borderRadius: "var(--r-card)" }}
      >
        <img
          src={src}
          alt={video.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          onError={() => {
            const ph = categoryPlaceholder(video.id, "");
            if (src !== ph) setSrc(ph);
          }}
        />
        {/* play overlay */}
        <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="grid h-[44px] w-[44px] place-items-center rounded-full" style={{ background: "rgba(0,0,0,0.6)" }}>
            <Play size={20} fill="#fff" color="#fff" />
          </span>
        </div>
        {/* duration badge */}
        <span
          className="absolute bottom-[6px] right-[6px] rounded-[4px] px-[6px] py-[2px] text-[11px] font-semibold"
          style={{ background: "rgba(0,0,0,0.78)", color: "#fff" }}
        >
          {formatDuration(video.durationSeconds)}
        </span>
      </div>
      <div className="mt-[8px] flex flex-col gap-[4px]">
        <h3 className="line-clamp-2 text-[13.5px] font-medium leading-[1.35]" style={{ color: "var(--foreground)" }}>
          {video.title}
        </h3>
        <div className="flex items-center gap-[8px] text-[11.5px]" style={{ color: "var(--foreground-50)" }}>
          <span className="inline-flex items-center gap-[4px]"><Eye size={12} /> {shortViews(video.views)}</span>
          {video.publishedAt && <span>· {shortDate(video.publishedAt)}</span>}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean. (`VideoCard` isn't rendered anywhere yet — Task 5 mounts it; verify it compiles standalone.)

- [ ] **Step 4: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/lib/format-duration.ts frontend/src/components/reviews/VideoCard.tsx
git commit -m "feat(reviews): VideoCard component + duration formatter"
```

---

### Task 5: Browse page — search, category tabs, hero carousel, rows, grid

**Files:**
- Modify: `frontend/package.json` (add `embla-carousel-autoplay`)
- Create: `frontend/src/components/reviews/ReviewsHero.tsx`
- Modify: `frontend/src/routes/reviews.index.tsx` (replace the Task 1 placeholder)

**Interfaces:**
- Consumes: `fetchVideos`, `fetchVideoCategories` (Task 2); `VideoCard` (Task 4); `Carousel`/`CarouselContent`/`CarouselItem`/`CarouselPrevious`/`CarouselNext` from `@/components/ui/carousel`; `SearchInput` from `@/components/ui/search-input`; `AppLayout`.
- Produces: the working `/reviews` browse page. Nothing downstream consumes this page.

- [ ] **Step 1: Add the autoplay dependency**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM/frontend
npm install embla-carousel-autoplay@^8.6.0
```
Verify `package.json` now lists `"embla-carousel-autoplay"` under dependencies and `npm ls embla-carousel-autoplay` resolves. (If offline and the install is blocked, report BLOCKED — the hero autoplay needs this package; do not hand-roll a `setInterval` autoplay as a substitute without flagging it.)

- [ ] **Step 2: `ReviewsHero` carousel**

Create `frontend/src/components/reviews/ReviewsHero.tsx`:
```tsx
import Autoplay from "embla-carousel-autoplay";
import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import type { Video } from "@/lib/mock";
import { categoryPlaceholder } from "@/lib/placeholder-image";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";

export function ReviewsHero({ videos }: { videos: Video[] }) {
  if (videos.length === 0) return null;
  return (
    <Carousel
      opts={{ loop: true }}
      plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
      className="relative"
    >
      <CarouselContent>
        {videos.map((v) => (
          <CarouselItem key={v.id}>
            <Link
              to="/reviews/$id"
              params={{ id: v.id }}
              className="group relative block overflow-hidden"
              style={{ aspectRatio: "16 / 7", borderRadius: "var(--r-card)", background: "var(--background-surface)" }}
            >
              <img
                src={v.posterUrl || categoryPlaceholder(v.id, "")}
                alt={v.title}
                className="h-full w-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(9,11,20,0.1) 0%, rgba(9,11,20,0.85) 100%)" }} />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-[12px] p-[16px] sm:p-[24px]">
                <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full" style={{ background: "var(--accent)" }}>
                  <Play size={20} fill="#fff" color="#fff" />
                </span>
                <h2 className="line-clamp-2 font-display text-[18px] font-bold sm:text-[24px]" style={{ color: "#fff", letterSpacing: "-0.02em" }}>
                  {v.title}
                </h2>
              </div>
            </Link>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-[8px]" />
      <CarouselNext className="right-[8px]" />
    </Carousel>
  );
}
```

- [ ] **Step 3: Browse page**

Replace `frontend/src/routes/reviews.index.tsx` entirely:
```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Video, VideoCategory } from "@/lib/mock";
import { fetchVideos, fetchVideoCategories } from "@/lib/api/reviews";
import { VideoCard } from "@/components/reviews/VideoCard";
import { ReviewsHero } from "@/components/reviews/ReviewsHero";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchX } from "lucide-react";

export const Route = createFileRoute("/reviews/")({
  head: () => ({ meta: [{ title: "Обзоры — МоДелизМ" }] }),
  component: ReviewsPage,
});

const ALL = "all";

function ReviewsPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [featured, setFeatured] = useState<Video[]>([]);
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [activeCat, setActiveCat] = useState<string>(ALL); // slug or "all"
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // categories: "Все" first, then alphabetical
  const tabs = useMemo(() => {
    const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return [{ id: ALL, name: "Все", slug: ALL }, ...sorted];
  }, [categories]);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchVideoCategories(), fetchVideos({ featured: true })])
      .then(([cats, feat]) => {
        if (!alive) return;
        setCategories(cats);
        setFeatured(feat);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchVideos({ q: query || undefined, categorySlug: activeCat })
      .then((list) => { if (alive) setVideos(list); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [query, activeCat]);

  const newest = videos.slice(0, 10);

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[20px]">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder="Поиск обзоров"
          aria-label="Поиск обзоров"
        />

        {/* category tabs — Все first, then alphabetical */}
        <div className="-mx-[16px] flex gap-[8px] overflow-x-auto px-[16px] pb-[4px] sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((c) => {
            const active = activeCat === c.slug;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCat(c.slug)}
                className="shrink-0 whitespace-nowrap px-[14px] text-[13px] font-medium transition-colors"
                style={{
                  height: 36,
                  borderRadius: "var(--r-tag)",
                  background: active ? "var(--accent-soft)" : "var(--background-elevated)",
                  color: active ? "var(--accent)" : "var(--foreground-70)",
                  border: `1px solid ${active ? "var(--border-accent)" : "var(--border)"}`,
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        {/* hero — only in the "Все" tab with no active search */}
        {activeCat === ALL && !query && featured.length > 0 && <ReviewsHero videos={featured} />}

        {/* "Новинки" horizontal row — only in "Все" with no search */}
        {activeCat === ALL && !query && newest.length > 0 && (
          <section className="space-y-[12px]">
            <h2 className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Новинки
            </h2>
            <div className="-mx-[16px] flex snap-x snap-mandatory gap-[12px] overflow-x-auto px-[16px] pb-[8px] sm:mx-0 sm:px-0" style={{ scrollbarWidth: "thin" }}>
              {newest.map((v) => (
                <div key={v.id} className="snap-start" style={{ flex: "0 0 240px" }}>
                  <VideoCard video={v} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* main grid — filtered + sorted newest-first */}
        <section className="space-y-[12px]">
          <h2 className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            {query ? "Результаты поиска" : "Все обзоры"}
          </h2>
          {loading ? (
            <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>Загрузка…</p>
          ) : videos.length === 0 ? (
            <EmptyState icon={SearchX} title="Ничего не найдено" description="Попробуйте изменить запрос или категорию." />
          ) : (
            <div className="grid grid-cols-2 gap-[16px] sm:grid-cols-3 lg:grid-cols-4">
              {videos.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
```
(The "Новинки" row wraps each `VideoCard` in a fixed-width snap item — `<div className="snap-start" style={{ flex: "0 0 240px" }}>` — because `VideoCard`'s root is a `<Link>` with no flex-basis of its own. The related-videos row on the watch page (Task 6) uses the identical wrapper.)

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Live verification (375px first, then desktop)**

Enable `reviewsEnabled` in `/admin`, open `/reviews`. At 375px: confirm search bar; category tabs scroll horizontally with "Все" first then alphabetical (Авиация, Автомодели, Квадрокоптеры, Корабли, Радиоаппаратура, Электроника); hero carousel shows featured videos, auto-advances (~5s), left/right arrows work; "Новинки" row scrolls horizontally; main grid is 2 columns, newest-first (`v1` "Первый полёт FPV-крыла" first). Type in search → grid filters, hero/Новинки hide. Click a category tab → grid filters to that category, hero/Новинки hide. Repeat at desktop (grid 4 cols). Duration badges show on posters.

- [ ] **Step 6: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/package.json frontend/package-lock.json frontend/src/components/reviews/ReviewsHero.tsx frontend/src/routes/reviews.index.tsx
git commit -m "feat(reviews): browse page — search, category tabs, hero carousel, rows, grid"
```

---

### Task 6: Watch page + mobile-first HTML5 player

**Files:**
- Create: `frontend/src/routes/reviews.$id.tsx`

**Interfaces:**
- Consumes: `fetchVideo`, `fetchVideos`, `incrementVideoView` (Task 2); `VideoCard` (Task 4); `getToken`/`ApiError` from `@/lib/api/client`; `isDemoMode`; `formatDuration`. The social block (likes/comments) is Task 7 — this task builds the player + metadata + related row only, leaving a clearly-marked slot for Task 7.
- Produces: the `/reviews/$id` watch route with a working player.

- [ ] **Step 1: Watch page with the player**

Create `frontend/src/routes/reviews.$id.tsx`:
```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Play, Eye, SearchX, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Video } from "@/lib/mock";
import { fetchVideo, fetchVideos, incrementVideoView } from "@/lib/api/reviews";
import { VideoCard } from "@/components/reviews/VideoCard";
import { categoryPlaceholder } from "@/lib/placeholder-image";
import { EmptyState } from "@/components/ui/empty-state";
import { getToken, ApiError } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";

export const Route = createFileRoute("/reviews/$id")({
  head: () => ({ meta: [{ title: "Обзор — МоДелизМ" }] }),
  component: WatchPage,
});

type LoadState = "loading" | "ok" | "notFound" | "error";

function WatchPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<Video[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const [playing, setPlaying] = useState(false);   // has the user tapped play?
  const [buffering, setBuffering] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    // Reuse the landing's connection gate — only affects passive/ambient loading.
    if (typeof window === "undefined") return;
    const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slow = !!conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType);
    setSaveData(conn?.saveData === true || slow);
  }, []);

  useEffect(() => {
    let alive = true;
    setState("loading");
    setPlaying(false);
    viewedRef.current = false;
    fetchVideo(id)
      .then((v) => {
        if (!alive) return;
        setVideo(v);
        setState("ok");
        fetchVideos({ categorySlug: undefined })
          .then((list) => { if (alive) setRelated(list.filter((x) => x.id !== v.id).slice(0, 8)); })
          .catch(() => {});
      })
      .catch((err) => {
        if (!alive) return;
        setVideo(null);
        setState(err instanceof ApiError && err.status === 404 ? "notFound" : "error");
      });
    return () => { alive = false; };
  }, [id]);

  const startPlay = () => {
    if (!getToken() && !isDemoMode()) {
      toast.info("Войдите, чтобы смотреть обзоры");
      navigate({ to: "/login" });
      return;
    }
    setPlaying(true);
    // Attach src + play on the next tick (after the <video> renders with src).
    requestAnimationFrame(() => {
      const el = videoRef.current;
      if (!el) return;
      el.load();
      void el.play().catch(() => {});
    });
    if (!viewedRef.current) {
      viewedRef.current = true;
      void incrementVideoView(id);
    }
  };

  if (state === "loading") {
    return (
      <AppLayout rightColumn={false}>
        <div className="mx-auto max-w-[900px] py-[40px]">
          <div className="w-full animate-pulse" style={{ aspectRatio: "16 / 9", background: "var(--background-surface)", borderRadius: "var(--r-card)" }} />
        </div>
      </AppLayout>
    );
  }
  if (state === "notFound" || state === "error" || !video) {
    return (
      <AppLayout rightColumn={false}>
        <div className="mx-auto max-w-[560px] py-[40px]">
          <EmptyState
            icon={SearchX}
            title={state === "notFound" ? "Обзор не найден" : "Не удалось загрузить обзор"}
            description="Возможно, он был удалён или ссылка устарела."
            action={{ label: "К обзорам", onClick: () => navigate({ to: "/reviews" }) }}
          />
        </div>
      </AppLayout>
    );
  }

  const poster = video.posterUrl || categoryPlaceholder(video.id, "");

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[1000px] flex-col gap-[20px]">
        <Link to="/reviews" className="inline-flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          <ChevronLeft size={14} /> Обзоры
        </Link>

        {/* player container — 16:9, object-contain letterboxes vertical videos */}
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9", background: "#000", borderRadius: "var(--r-card)" }}>
          {!playing ? (
            <>
              <img
                src={poster}
                alt={video.title}
                className="h-full w-full object-contain"
                loading={saveData ? "lazy" : "eager"}
              />
              <button
                type="button"
                onClick={startPlay}
                aria-label="Смотреть"
                className="absolute inset-0 grid place-items-center"
                style={{ background: "rgba(0,0,0,0.25)" }}
              >
                <span className="grid h-[64px] w-[64px] place-items-center rounded-full" style={{ background: "var(--accent)" }}>
                  <Play size={28} fill="#fff" color="#fff" />
                </span>
              </button>
              {saveData && (
                <span className="absolute left-[10px] top-[10px] rounded-[6px] px-[8px] py-[3px] text-[11px]" style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>
                  Экономия трафика — видео загрузится по тапу
                </span>
              )}
            </>
          ) : (
            <>
              <video
                ref={videoRef}
                poster={poster}
                controls
                playsInline
                preload="none"
                controlsList="nodownload"
                onWaiting={() => setBuffering(true)}
                onPlaying={() => setBuffering(false)}
                onCanPlay={() => setBuffering(false)}
                className="h-full w-full object-contain"
              >
                <source src={video.videoUrl} type="video/mp4" />
              </video>
              {buffering && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <RefreshCw size={32} className="animate-spin" color="#fff" />
                </div>
              )}
            </>
          )}
        </div>

        {/* metadata */}
        <div className="flex flex-col gap-[8px]">
          <h1 className="font-display text-[20px] font-bold leading-[1.25] sm:text-[24px]" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            {video.title}
          </h1>
          <div className="flex items-center gap-[12px] text-[12.5px]" style={{ color: "var(--foreground-50)" }}>
            <span className="inline-flex items-center gap-[4px]"><Eye size={13} /> {video.views.toLocaleString("ru")} просмотров</span>
            {video.publishedAt && <span>· {new Date(video.publishedAt).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" })}</span>}
          </div>
          {video.description && (
            <p className="whitespace-pre-line text-[14px] leading-[1.6]" style={{ color: "var(--foreground-90)" }}>
              {video.description}
            </p>
          )}
        </div>

        {/* SOCIAL BLOCK SLOT — Task 7 inserts the like button + comments here */}

        {/* related videos */}
        {related.length > 0 && (
          <section className="space-y-[12px]">
            <h2 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Смотрите также
            </h2>
            <div className="-mx-[16px] flex snap-x snap-mandatory gap-[12px] overflow-x-auto px-[16px] pb-[8px] sm:mx-0 sm:px-0" style={{ scrollbarWidth: "thin" }}>
              {related.map((v) => (
                <div key={v.id} className="snap-start" style={{ flex: "0 0 240px" }}>
                  <VideoCard video={v} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Live verification — the critical player checks (375px first)**

At 375px: from `/reviews` click a card → lands on `/reviews/$id`. Confirm:
1. Poster + big play button + title/views/date/description all visible immediately.
2. **No video file requested yet** — open the browser Network panel, filter for `demo-review-sample.mp4`, confirm zero requests before tapping play.
3. Tap play → the sample video attaches and plays; native controls (play/pause/scrub/volume/fullscreen) work; tap fullscreen → native fullscreen; `demo-review-sample.mp4` now appears in Network.
4. Reload the page → back to poster+play (no auto-load).
5. In DOM, confirm the `<video>` has `controlslist="nodownload"` and no visible download button in the native controls.
6. Confirm the `related` row renders and scrolls.
Then desktop: repeat 1-3. Auth-gate: this is demo mode so play works; verify by code that the `!getToken() && !isDemoMode()` branch matches the proven `writeToSeller` pattern (a real guest is redirected). If you can force `localStorage.setItem('modelizm_demo_mode','0')` and reload as in prior sessions, confirm tapping play redirects to `/login` with the toast, then restore demo mode.

- [ ] **Step 4: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/routes/reviews.\$id.tsx frontend/src/routeTree.gen.ts
git commit -m "feat(reviews): mobile-first watch page + native HTML5 player (poster-first, load-on-tap, auth-gated)"
```

---

### Task 7: Social block on the watch page (likes + comments + report) — Feed system reuse

**Files:**
- Modify: `frontend/src/routes/reviews.$id.tsx` (fill the SOCIAL BLOCK SLOT)
- Create: `frontend/src/components/reviews/VideoActionsMenu.tsx` (report/share three-dots, mirroring PostActionMenu but lighter)

**Interfaces:**
- Consumes: `reactToVideo`, `fetchVideoComments`, `createVideoComment` (Task 2); `CommentSection` from `@/components/feed/CommentSection` (reused verbatim); `Comment` type.
- Produces: like button + comment thread + report/share menu on the watch page.

- [ ] **Step 1: `VideoActionsMenu` (report = toast stub, exact post parity)**

Create `frontend/src/components/reviews/VideoActionsMenu.tsx`:
```tsx
import { MoreHorizontal, Flag, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function VideoActionsMenu({ videoId }: { videoId: string }) {
  const copyLink = async () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/reviews/${videoId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    } catch {
      toast.info("Скопируйте ссылку из адресной строки");
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Ещё" className="grid h-[36px] w-[36px] place-items-center rounded-full" style={{ color: "var(--foreground-70)" }}>
          <MoreHorizontal size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={copyLink}>
          <LinkIcon size={14} /> Копировать ссылку
        </DropdownMenuItem>
        {/* Report is a toast stub — EXACT parity with posts (PostActionMenu has no real report API either). */}
        <DropdownMenuItem onSelect={() => toast("Жалоба: будет доступно позже")}>
          <Flag size={14} /> Пожаловаться
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```
(Verify the exact `DropdownMenu*` export names/props against `@/components/ui/dropdown-menu` before finalizing — if the API differs, match the existing usage in `PostActionMenu.tsx`.)

- [ ] **Step 2: Wire the social block into the watch page**

In `frontend/src/routes/reviews.$id.tsx`:
1. Add imports:
```ts
import { Heart } from "lucide-react";
import type { Comment } from "@/lib/mock";
import { reactToVideo, fetchVideoComments, createVideoComment } from "@/lib/api/reviews";
import { CommentSection } from "@/components/feed/CommentSection";
import { VideoActionsMenu } from "@/components/reviews/VideoActionsMenu";
```
2. Add state (near the other `useState`s), seeded from the loaded video:
```ts
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
```
3. In the `fetchVideo(id).then((v) => {...})` success block, after `setVideo(v)`, seed the interaction state and load comments:
```ts
        setLiked(Boolean(v.isLiked));
        setLikeCount(v.likes);
        fetchVideoComments(v.id).then((cs) => { if (alive) setComments(cs); }).catch(() => {});
```
4. Add the handlers (near `startPlay`):
```ts
  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => n + (next ? 1 : -1));
    reactToVideo(id, next).catch(() => {
      setLiked(!next);
      setLikeCount((n) => n + (next ? -1 : 1));
      toast.error("Не удалось поставить лайк");
    });
  };

  const addComment = (text: string, parentId?: string) => {
    void createVideoComment(id, text, parentId).then((c) => {
      if (parentId) {
        setComments((prev) =>
          prev.map((p) => (p.id === parentId ? { ...p, replies: [...(p.replies ?? []), c] } : p)),
        );
      } else {
        setComments((prev) => [c, ...prev]);
      }
    });
  };
```
5. Replace the `{/* SOCIAL BLOCK SLOT ... */}` comment with:
```tsx
        <div className="flex items-center gap-[8px] border-y py-[12px]" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={liked}
            className="inline-flex items-center gap-[6px] rounded-full px-[14px] py-[8px] text-[13px] font-medium transition-colors"
            style={{
              background: liked ? "var(--accent-soft)" : "var(--background-surface)",
              color: liked ? "var(--accent)" : "var(--foreground-70)",
              border: `1px solid ${liked ? "var(--border-accent)" : "var(--border)"}`,
            }}
          >
            <Heart size={15} fill={liked ? "currentColor" : "none"} /> {likeCount}
          </button>
          <div className="ml-auto">
            <VideoActionsMenu videoId={video.id} />
          </div>
        </div>

        <section className="space-y-[12px]">
          <h2 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            Комментарии
          </h2>
          <CommentSection comments={comments} onAdd={addComment} />
        </section>
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Live verification (375px first)**

On `/reviews/$id` (use `v1`, which has seeded comments): confirm a like button showing the count; tap it → count increments and turns accent, tap again → reverts. Open the comment thread → seeded comments show; type a comment + submit → it appears at the top immediately; tap Reply on a comment, submit → nested reply appears. Tap the three-dots → "Копировать ссылку" copies the URL (toast), "Пожаловаться" fires the exact `"Жалоба: будет доступно позже"` toast (parity with a post — verify a post's report shows the same text). Repeat at desktop.

- [ ] **Step 5: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/routes/reviews.\$id.tsx frontend/src/components/reviews/VideoActionsMenu.tsx
git commit -m "feat(reviews): likes + comments (Feed reuse) + report stub on watch page"
```

---

### Task 8: Upload route (`/reviews/upload`) — admin-gated

**Files:**
- Create: `frontend/src/routes/reviews.upload.tsx`
- Create: `frontend/src/components/reviews/VideoUploadField.tsx` (single-file `accept="video/*"`, forked from `ImageUploadGrid`)

**Interfaces:**
- Consumes: `uploadMedia` (`purpose: "review_video"`); `uploadVideo`, `fetchVideoCategories`, `VideoUploadInput` (Task 2); `requireAdmin` (auth layer); `getState`/`selectors` for the component-level `isAdmin` gate.
- Produces: the `/reviews/upload` route. Task 9's admin section links to it.

- [ ] **Step 1: `VideoUploadField`**

Create `frontend/src/components/reviews/VideoUploadField.tsx`:
```tsx
import { X, Film } from "lucide-react";

interface Props {
  fileUrl: string | null;         // blob preview URL, or null
  onPick: (file: File) => void;
  onClear: () => void;
  accept: string;                 // "video/*" or "image/*"
  label: string;
}

export function VideoUploadField({ fileUrl, onPick, onClear, accept, label }: Props) {
  return (
    <div className="space-y-[8px]">
      {fileUrl ? (
        <div className="relative overflow-hidden" style={{ borderRadius: "var(--r-card)", border: "1px solid var(--border)" }}>
          {accept.startsWith("video") ? (
            <video src={fileUrl} controls preload="metadata" className="w-full" style={{ maxHeight: 240, background: "#000" }} />
          ) : (
            <img src={fileUrl} alt="" className="w-full object-cover" style={{ maxHeight: 240 }} />
          )}
          <button type="button" onClick={onClear} aria-label="Убрать" className="absolute right-[8px] top-[8px] grid h-[28px] w-[28px] place-items-center rounded-full" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <label className="grid cursor-pointer place-items-center gap-[8px] py-[28px] text-center" style={{ border: "1.5px dashed var(--border)", borderRadius: "var(--r-card)", color: "var(--foreground-50)" }}>
          <Film size={22} />
          <span className="text-[13px]">{label}</span>
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Upload route (both auth layers, mirroring `/admin`)**

Create `frontend/src/routes/reviews.upload.tsx`:
```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import type { VideoCategory } from "@/lib/mock";
import { fetchVideoCategories, uploadVideo } from "@/lib/api/reviews";
import { uploadMedia } from "@/lib/api/media";
import { VideoUploadField } from "@/components/reviews/VideoUploadField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getState, selectors } from "@/lib/store";
import { ensureSession } from "@/lib/auth/session";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/reviews/upload")({
  head: () => ({ meta: [{ title: "Загрузить обзор — МоДелизМ" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAdmin } = await import("@/lib/auth/requireAdmin");
    await requireAdmin(location);
  },
  component: UploadPage,
});

type Access = "checking" | "granted" | "forbidden";

function UploadPage() {
  const navigate = useNavigate();
  const [access, setAccess] = useState<Access>("checking");
  const [categories, setCategories] = useState<VideoCategory[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    ensureSession().then((ok) => {
      if (!alive) return;
      if (!ok) { navigate({ to: "/login" }); return; }
      const me = selectors.currentUser(getState());
      setAccess(me.isAdmin ? "granted" : "forbidden");
    });
    fetchVideoCategories().then((c) => { if (alive) { setCategories(c); setCategoryId(c[0]?.id ?? ""); } }).catch(() => {});
    return () => { alive = false; };
  }, [navigate]);

  const pickVideo = (f: File) => { setVideoFile(f); setVideoUrl(URL.createObjectURL(f)); };
  const pickPoster = (f: File) => { setPosterFile(f); setPosterUrl(URL.createObjectURL(f)); };

  const valid = title.trim().length >= 3 && categoryId && videoFile;

  const submit = async () => {
    if (!valid || submitting || !videoFile) return;
    setSubmitting(true);
    try {
      const videoMedia = await uploadMedia(videoFile, "review_video");
      const posterMedia = posterFile ? await uploadMedia(posterFile, "post") : null;
      await uploadVideo({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        posterMediaId: posterMedia?.uuid ?? "",
        videoMediaId: videoMedia.uuid,
        posterUrl: posterUrl ?? "",
        videoUrl: videoUrl ?? videoMedia.url ?? "",
        isFeatured,
      });
      toast.success("Обзор опубликован");
      void navigate({ to: "/reviews" });
    } catch {
      toast.error("Не удалось опубликовать обзор");
      setSubmitting(false);
    }
  };

  if (access === "checking") {
    return <AppLayout rightColumn={false}><div className="py-[60px] text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>Проверка доступа…</div></AppLayout>;
  }
  if (access === "forbidden") {
    return <AppLayout rightColumn={false}><div className="mx-auto max-w-[480px] py-[60px] text-center"><h1 className="font-display text-[22px] font-bold" style={{ color: "var(--foreground)" }}>Доступ ограничен</h1><p className="mt-[8px] text-[14px]" style={{ color: "var(--foreground-70)" }}>Загружать обзоры может только администратор площадки.</p></div></AppLayout>;
  }

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[720px] flex-col gap-[16px] py-[8px]">
        <h1 className="font-display text-[24px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>Новый обзор</h1>

        <VideoUploadField fileUrl={videoUrl} onPick={pickVideo} onClear={() => { setVideoFile(null); setVideoUrl(null); }} accept="video/*" label="Загрузить видео (mp4)" />
        <VideoUploadField fileUrl={posterUrl} onPick={pickPoster} onClear={() => { setPosterFile(null); setPosterUrl(null); }} accept="image/*" label="Обложка (необязательно)" />

        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название обзора" />
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание" rows={4} />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full text-[14px] outline-none" style={{ background: "var(--background-elevated)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: "var(--r-input)", height: 44, padding: "0 12px" }}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Теги через запятую" />
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36 }}>
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
          <span className="text-[13px]" style={{ color: "var(--foreground-70)" }}>Показывать в карусели «Рекомендованное»</span>
        </label>

        <Button onClick={submit} disabled={!valid || submitting} size="lg" className="rounded-[var(--r-button)]">
          {submitting ? <><RefreshCw size={16} className="animate-spin" /> Публикуется…</> : "Опубликовать обзор"}
        </Button>
      </div>
    </AppLayout>
  );
}
```
(Verify `Input`/`Textarea`/`Button` import paths and `selectors.currentUser`/`getState` names against the store — they're used identically in `admin.tsx` and `ads.new.tsx`; match those.)

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Live verification (375px first)**

As a demo user (the demo user `u1` has `isAdmin: true`), open `/reviews/upload`. Confirm the access check passes (demo admin). Pick a local video file → inline `<video>` preview appears; optionally a poster; fill title/description/category/tags; toggle featured; submit → toast "Обзор опубликован" → redirect to `/reviews`, and the new video is at the TOP of the grid (newest-first) and playable on its watch page. Repeat at desktop. (Guest/non-admin path: confirm by code that the `access === "forbidden"` branch renders for a non-admin; if forcible in demo, verify the forbidden screen.)

- [ ] **Step 5: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/routes/reviews.upload.tsx frontend/src/components/reviews/VideoUploadField.tsx frontend/src/routeTree.gen.ts
git commit -m "feat(reviews): admin-gated /reviews/upload route with video upload"
```

---

### Task 9: Admin management section + `ModerationType` extension

**Files:**
- Modify: `frontend/src/lib/api/admin.ts` (extend `ModerationType`)
- Modify: `frontend/src/routes/admin.tsx` (add `ReviewsSection`)
- Modify: `frontend/src/lib/api/reviews.ts` (add `deleteVideo`, `setVideoFeatured`)
- Modify: `frontend/src/lib/demo-data.ts` (`demoDeleteVideo`, `demoSetVideoFeatured`)

**Interfaces:**
- Consumes: `fetchVideos` (Task 2); the admin section pattern from `SettingsSection`.
- Produces: `deleteVideo(id)`, `setVideoFeatured(id, on)` in `reviews.ts`; `"videos"` in `ModerationType`; a new "Обзоры" admin section.

- [ ] **Step 1: Extend `ModerationType`**

In `frontend/src/lib/api/admin.ts`:
```ts
export type ModerationType = "posts" | "communities" | "videos";
```
And in `moderationTypeFromClass`:
```ts
function moderationTypeFromClass(cls?: string): ModerationType {
  if (cls === "Community") return "communities";
  if (cls === "Video") return "videos";
  return "posts";
}
```
(The `approve/reject/reviseModeration` functions are already `type`-parameterized — no change.)

- [ ] **Step 2: Add demo mutators + API functions**

In `frontend/src/lib/demo-data.ts`, append:
```ts
export function demoDeleteVideo(id: ID): void {
  const si = sessionVideos.findIndex((v) => v.id === id);
  if (si >= 0) { sessionVideos.splice(si, 1); return; }
  const mi = mockVideos.findIndex((v) => v.id === id);
  if (mi >= 0) mockVideos.splice(mi, 1);
}

export function demoSetVideoFeatured(id: ID, on: boolean): void {
  const v = [...sessionVideos, ...mockVideos].find((x) => x.id === id);
  if (v) v.isFeatured = on;
}
```
(`mockVideos` is imported into demo-data from `@/lib/mock`; `splice`/mutation on it is acceptable for demo-session state, consistent with how other demo overrides mutate module arrays. If `mockVideos` is a `const` array imported by value it is still mutable in place — confirm it isn't frozen.)

In `frontend/src/lib/api/reviews.ts`, add:
```ts
export async function deleteVideo(id: string): Promise<void> {
  if (isDemoMode()) { const { demoDeleteVideo } = await import("@/lib/demo-data"); demoDeleteVideo(id); return; }
  await api(`/videos/${id}`, { method: "DELETE" });
}

export async function setVideoFeatured(id: string, on: boolean): Promise<void> {
  if (isDemoMode()) { const { demoSetVideoFeatured } = await import("@/lib/demo-data"); demoSetVideoFeatured(id, on); return; }
  await api(`/videos/${id}`, { method: "PATCH", json: { is_featured: on } });
}
```
(Or add `demoDeleteVideo`/`demoSetVideoFeatured` to the top-level static import block in `reviews.ts` instead of dynamic `import()` — either is fine; match the file's existing import style, which is static, so prefer adding them to the existing `@/lib/demo-data` import.)

- [ ] **Step 3: Add `ReviewsSection` to admin**

In `frontend/src/routes/admin.tsx`:
1. Extend the `Section` union with `"reviews"`:
```ts
  | "monetization" | "categories" | "reviews" | "notifications" | "analytics" | "design" | "feedback" | "settings";
```
2. Add a `navItems` entry (after `categories`), importing a `Clapperboard` icon at the top of the file:
```ts
  { id: "reviews", label: "Обзоры", icon: Clapperboard },
```
3. Add a branch in `SectionView`:
```tsx
  if (section === "reviews") return <ReviewsSection />;
```
4. Add the component (mirrors `SettingsSection`'s fetch-on-mount + list shape). Use the file's existing `card`/`H` helpers and `toast`:
```tsx
function ReviewsSection() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchVideos({})
      .then(setVideos)
      .catch(() => toast.error("Не удалось загрузить обзоры"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleFeatured = async (id: string, on: boolean) => {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, isFeatured: on } : v)));
    try { await setVideoFeatured(id, on); } catch { toast.error("Не удалось обновить"); load(); }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Удалить обзор?")) return;
    setVideos((prev) => prev.filter((v) => v.id !== id));
    try { await deleteVideo(id); toast.success("Обзор удалён"); } catch { toast.error("Не удалось удалить"); load(); }
  };

  return (
    <div>
      <H action={<Link to="/reviews/upload" className="text-[13px]" style={{ color: "var(--accent)" }}>+ Загрузить обзор</Link>}>Обзоры</H>
      <div style={{ ...card, padding: "16px" }}>
        {loading ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : videos.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>Обзоров пока нет</p>
        ) : (
          <div className="flex flex-col gap-[8px]">
            {videos.map((v) => (
              <div key={v.id} className="flex items-center gap-[12px] py-[8px]" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--foreground)" }}>{v.title}</span>
                <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{v.views.toLocaleString("ru")} просм.</span>
                <label className="flex items-center gap-[6px] text-[12px]" style={{ color: "var(--foreground-70)" }}>
                  <input type="checkbox" checked={v.isFeatured} onChange={(e) => toggleFeatured(v.id, e.target.checked)} style={{ accentColor: "var(--accent)" }} />
                  Промо
                </label>
                <button type="button" onClick={() => remove(v.id)} className="text-[12px]" style={{ color: "var(--danger)" }}>Удалить</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```
5. Add imports at the top of `admin.tsx`: `Clapperboard` to the lucide import; `import type { Video } from "@/lib/mock";`; `import { fetchVideos, setVideoFeatured, deleteVideo } from "@/lib/api/reviews";`; ensure `Link` from `@tanstack/react-router` is imported (it is, for other admin links — verify). The `H` helper's `action` prop: confirm `H` accepts an `action` node (used elsewhere in admin.tsx, e.g. some sections pass a right-aligned action); if `H` doesn't take `action`, render the "+ Загрузить обзор" link as a sibling above the card instead.

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Live verification**

`/admin` → new "Обзоры" section in the nav. Confirm it lists all videos with view counts. Toggle "Промо" on a non-featured video → (verify it now appears in the `/reviews` hero carousel after navigating there). Delete a video → confirm the confirm dialog, then it disappears from the admin list AND from `/reviews`. The "+ Загрузить обзор" link navigates to `/reviews/upload`.

- [ ] **Step 6: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/lib/api/admin.ts frontend/src/routes/admin.tsx frontend/src/lib/api/reviews.ts frontend/src/lib/demo-data.ts
git commit -m "feat(reviews): admin Обзоры section (list/feature/delete) + ModerationType videos"
```

---

### Task 10: Backend documentation (full executable spec)

**Files:**
- Modify: `frontend/docs/backend-endpoints-needed.md`

**Interfaces:** None (docs only).

- [ ] **Step 1: Append entry #23**

Verify the last numbered entry is `## 22.` (from the Call Seller feature); this new one is `## 23.`. If a `## 23.` already exists, report NEEDS_CONTEXT. Append a full technical brief covering everything the spec's "Backend Documentation" section requires. It MUST include, verbatim-complete (not summarized):

Data models `Video`, `VideoCategory`, `VideoView` with DB-appropriate column types (`uuid` PK, `varchar`/`text`, `integer`, `boolean`, `timestamp`, FKs `category_id`→video_categories, `uploader_id`→users), nullability, and purpose per field.

Endpoints, each with **method + path + auth + full request body + full response + status codes**:
- `GET /videos` (query: `q`, `category`, `featured`, `sort`, `page`/`per_page`; paginated `{data:[Video…], meta}`).
- `GET /videos/{id}` (full Video).
- `GET /videos/categories` (VideoCategory[]).
- `POST /videos` (auth admin/owner; body `{title, description, category_id, tags[], poster_media_id, video_media_id, is_featured}`; 201 → created Video).
- `PATCH /videos/{id}` (auth admin/owner; e.g. `{is_featured}`).
- `DELETE /videos/{id}` (auth admin/owner; 204).
- `POST /videos/{id}/view` (increment; specify dedup/idempotency window + response).
- Social parity endpoints (mirror `/posts/{id}/…` exactly): `POST /videos/{id}/react`, `DELETE /videos/{id}/react`; `GET /videos/{id}/comments`; `POST /videos/{id}/comments` (body `{body, parent_uuid?}`).
- Media: `POST /media` already exists (`purpose: "review_video"`); spell out video max size, accepted MIME types, and whether the server does transcoding/thumbnail generation.

Moderation: extend the `moderatable_type` morph to register `Video` → surface in `GET /admin/moderation/queue` mapping to `"videos"` → honor `/admin/moderation/videos/{id}/approve|reject|revision`. Note the "Пожаловаться" button is a toast stub (true for posts too); a real report→queue flow needs a `POST /reports` (or `/videos/{id}/report`) endpoint that doesn't exist for any content type yet — a cross-content-type future addition, not video-specific.

Infra caveats (flag as substantial separate scope, NOT built): real video storage + transcoding pipeline (multi-resolution) + CDN delivery + possibly HLS/DASH adaptive streaming; the existing `POST /media` blob-storage is fine for images but not built for video at scale.

DRM honesty note: no real DRM — browser `<video src>` is always downloadable via devtools; `controlsList="nodownload"` is a UI nicety only; real protection would be signed-URL-expiry + token-gated HLS / commercial DRM, a future discussion, not promised here.

Demo-fallback note: fully works in demo — `lib/api/reviews.ts` returns seeded `mockVideos` (all pointing at one bundled CC-BY Big Buck Bunny sample), with an artificial delay-free resolve; uploads use `uploadMedia` blob URLs; interactions mirror the Feed's demo fidelity (likes non-persistent across reload, comments synthesized in-session).

- [ ] **Step 2: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/docs/backend-endpoints-needed.md
git commit -m "docs(reviews): document Video/VideoCategory/VideoView models + all endpoints + moderation/infra/DRM notes"
```

---

### Task 11: Final full verification

**Files:** None (verification only).

- [ ] **Step 1: Full typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: End-to-end demo click-through, 375px then desktop, fresh reload**

On a freshly reloaded app:
1. `/admin` → Настройки → enable "Показывать раздел «Обзоры»"; confirm Sidebar item appears (not BottomNav).
2. `/reviews`: search, alphabetical tabs (Все first), hero autoplay + arrows, Новинки row, newest-first grid, duration badges.
3. Watch page: poster-first (zero video requests before tap — check Network), tap → plays, native controls + fullscreen, `controlsList="nodownload"`, buffering spinner logic present, reload resets to poster.
4. Social: like toggles, comment adds (top for root, nested for reply), report toast-stub parity with posts.
5. Upload (as demo admin): submit → appears top of `/reviews`, playable.
6. Admin Обзоры section: list, toggle Промо (appears in hero), delete (gone from `/reviews`).
7. Guest/auth-gate: verify (by code parity with `writeToSeller`, or by forcing demo off) that a real guest tapping play is redirected to `/login`.
8. No new console errors vs. baseline.

- [ ] **Step 3: Report results; do not commit further without permission**

Task commits (1-10) are the working history. If verification surfaced fixes, commit them with clear messages and re-run Steps 1-2. Otherwise report done and await the user's deploy decision.
