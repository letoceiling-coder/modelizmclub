# Обзоры (Video Content Section) — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to turn this spec into an implementation plan, then superpowers:subagent-driven-development or superpowers:executing-plans to build it.

**Goal:** A new top-level "Обзоры" section — a RUTUBE-style video hub with a hero carousel, alphabetical category tabs, horizontal/vertical preview-card rows, search, sort-by-newest, a mobile-first watch page with an HTML5 player, and an admin-gated upload flow. Fully demo-testable now; real video storage/streaming/CDN documented in detail as backend follow-up, not built.

**Architecture:** Mirrors the existing "Сообщества" section's route/data/nav/flag pattern exactly (`reviews.tsx` Outlet parent, `reviews.index.tsx` browse, `reviews.$id.tsx` watch, `reviews.upload.tsx` upload — all gated by a new `reviewsEnabled` feature flag, same mechanism as `communitiesEnabled`). UI built from existing reusable primitives: the shadcn `ui/carousel.tsx` (embla, already has arrows+keyboard) extended with an autoplay plugin for the hero; the `SimilarAds.tsx` horizontal-snap-row idiom for preview rows; the landing's `navigator.connection` perf-gating block reused verbatim for the player; `CatalogCard.tsx`'s lazy-load/placeholder-on-error pattern for video posters; `ImageUploadGrid` forked to `accept="video/*"` for upload; and the **Feed's `CommentSection` + `reactTo*`/`*Comments` interaction pattern reused for likes + comments on the watch page** (the interaction layer is id-keyed and Post-agnostic — see §6a).

**Tech Stack:** React 18 + TypeScript strict, TanStack Router, existing store/demo-mode/API-layer conventions, `embla-carousel-react` (+ new `embla-carousel-autoplay` dependency), native HTML5 `<video>` (no third-party player library).

## Global Constraints

- Frontend-only; no backend code changes. Real video storage/streaming/CDN is out of scope — documented in `backend-endpoints-needed.md` as a detailed, executable spec, not implemented.
- Mobile-first: every screen (browse, watch, upload) designed and verified at 375px before desktop.
- `npx tsc --noEmit` clean after every change.
- No commit/push without explicit user permission.
- New nav item goes in **Sidebar only**, not `BottomNav` (already at capacity, 5 slots) — confirmed decision, not a TODO.
- Categories: "Все" first, then strictly alphabetical.
- Playback requires auth (guest sees posters/metadata/list, cannot press play — same gate pattern as `writeToSeller`).
- No real DRM/anti-download claim — `controlsList="nodownload"` suppresses the one-click download button only; documented honestly as not real protection.
- Player must not download any video bytes before an explicit user tap (`preload="none"`, `src` unattached until play), and must additionally suppress even the *poster preview fetch pattern* on slow/Save-Data connections using the same `navigator.connection` gate the landing's hero video already uses.
- Bundled demo sample video must be genuinely public-domain / Creative-Commons-licensed with clear attribution recorded in the repo — not an arbitrary downloaded file.

---

## Data Model (drives the backend documentation)

```ts
interface Video {
  id: string;              // uuid
  title: string;
  description: string;
  categoryId: string;
  posterUrl: string;        // thumbnail image
  videoUrl: string;         // playable file/stream URL
  durationSeconds: number;
  views: number;            // separate from likes/comments — passive watch counter
  isFeatured: boolean;      // hero-carousel curation flag, admin-set
  tags: string[];           // search-by-topic
  publishedAt: string;      // ISO date, sort key (newest first)
  uploaderId: string;
  status: "processing" | "published";
  // Social-interaction fields — denormalized counters/flags, mirroring the
  // relevant Post interaction fields (mock.ts Post has likes/comments/isLiked/
  // commentList). Reused so the Feed's CommentSection and reactTo*/*Comments
  // API pattern apply to videos verbatim. NOTE: no `isSaved`/bookmark — save/
  // bookmark of videos is out of scope this round (likes + comments only).
  likes: number;
  comments: number;
  isLiked?: boolean;
  commentList?: Comment[];  // the SAME `Comment` type from mock.ts, reused unchanged (it has no postId back-reference)
}

interface VideoCategory {
  id: string;
  name: string;             // Russian display name
  slug: string;
}

interface VideoView {
  id: string;
  videoId: string;
  userId?: string;          // null for guest views, if ever allowed later
  viewedAt: string;
  ip?: string;
}
```

## Components

### 1. Feature flag + nav (mirrors `communitiesEnabled`)

- `frontend/src/lib/config/featureFlags.ts`: add `reviewsEnabled: boolean` to `FeatureFlags` interface and `DEFAULTS` (`false`).
- `frontend/src/components/layout/Sidebar.tsx`: add `"/reviews"` to the `Item.to` union, add an `ALL_ITEMS` entry (`labelKey: "nav.reviews"`, an appropriate icon e.g. `Video`/`Clapperboard` from lucide-react, `section: "reviews"`), filter on `useFeatureFlag("reviewsEnabled")` exactly like the existing `communitiesEnabled` filter.
- `frontend/src/components/layout/BottomNav.tsx`: **not touched** (explicit decision).
- `frontend/src/lib/routes.ts`: add `reviews: "/reviews"` and `review: (id: string) => \`/reviews/${id}\`` to `ROUTES`; add `reviews: ["/reviews"]` to `SIDEBAR_ROUTE_MAP` (positioned per the existing most-specific-first ordering rule).
- `frontend/src/lib/i18n/locales/{ru,en,zh}.ts`: add `nav.reviews` ("Обзоры" / "Reviews" / "视频评测" or similar) to each locale's `nav` object.
- `/admin` → Настройки (`SettingsSection` in `admin.tsx`): add a second checkbox row next to the existing "Показывать раздел «Сообщества»" one, wired to `setFeatureFlag("reviewsEnabled", checked)`, same localStorage-only demo mechanism, same UI pattern.

### 2. Data layer (mirrors `lib/api/communities.ts` + `demoCommunities`)

- `frontend/src/lib/mock.ts`: add `Video`/`VideoCategory` types (per Data Model above), `mockVideoCategories` (the modelizm category set — reuse the same category names already used for ads: Авиация, Автомодели, Корабли, Квадрокоптеры, etc. — sourced from the existing ad-category list so there's no duplicate taxonomy), `mockVideos` (a seeded array across categories, several with `isFeatured: true`, `publishedAt` staggered so newest-first sort is visibly meaningful, `videoUrl` pointing at the one bundled sample file for all entries).
- `frontend/src/lib/demo-data.ts`: `demoVideos(query?, categorySlug?)`, `demoVideo(id)`, `demoVideoCategories()`, `demoFeaturedVideos()`, `demoIncrementVideoView(id)` (local counter bump, demo-only), and `demoVideoComments(id)` (deterministic seeded comment list, mirroring `demoPostComments`) — same shape as the `demoCommunities`/`demoCommunity` functions.
- `frontend/src/lib/api/reviews.ts` (new file): `fetchVideos(params)`, `fetchVideo(id)`, `fetchVideoCategories()`, `incrementVideoView(id)`, `uploadVideo(input)`, plus the social-interaction trio `reactToVideo(uuid, on)`, `fetchVideoComments(uuid)`, `createVideoComment(uuid, body, parentUuid?)` (exact copies of `feed.ts`'s `reactToPost`/`fetchPostComments`/`createComment` with `/posts/` → `/videos/`, see §6a) — every function demo/real-branches on `isDemoMode()` exactly like `lib/api/communities.ts`'s functions, with an `ApiVideo`/`mapVideo` adapter for the real branch (even though the real endpoint doesn't exist yet — the adapter shape is what `backend-endpoints-needed.md` will specify).

### 3. Bundled demo sample video

One short, small (~1-3 MB, a few seconds to ~1 minute) clip at `frontend/public/videos/demo-review-sample.mp4`, sourced from the **Blender Foundation's "Big Buck Bunny"** open movie — the standard royalty-free/Creative-Commons (CC BY 3.0) test video used across the industry for exactly this purpose (Google's own streaming demos, video.js samples, etc.), trimmed to a short clip via `ffmpeg` from the publicly hosted master file. A `frontend/public/videos/ATTRIBUTION.md` (or an addition to an existing credits file if one exists — check first) records: source (Blender Foundation, Big Buck Bunny, © 2008, Blender Foundation, peach.blender.org), license (CC BY 3.0), and that it's used as a technical placeholder, not creative content. All `mockVideos` entries' `videoUrl` point at this one file (demo mode only — never claims to be the "real" catalog).

### 4. Browse page (`frontend/src/routes/reviews.index.tsx`)

Top-to-bottom, mobile-first (375px layout described first):
1. **Search bar** — controlled input, filters `mockVideos` by title/tags/category name (client-side in demo, `q` param in real).
2. **Category tabs** — horizontal scroll row, "Все" first then alphabetical (`mockVideoCategories` sorted by `name.localeCompare`, "Все" prepended), reusing the existing category-chip horizontal-scroll idiom (`[scrollbar-width:none]` hidden-scrollbar pattern).
3. **Hero carousel** — `ui/carousel.tsx` extended with `embla-carousel-autoplay` (new dependency), showing `isFeatured` videos as large promo slides with title/poster overlay; arrows + keyboard nav already provided by the primitive; manual interaction pauses autoplay (embla-carousel-autoplay's default `stopOnInteraction` behavior).
4. **"Новинки" horizontal row** — `VideoCard`s in a `SimilarAds.tsx`-style snap-scroll flex row, newest 8-10 videos.
5. **"Все обзоры" vertical grid** — remaining videos (filtered by active category tab + search query), sorted `publishedAt` descending, responsive grid (2 cols mobile → 3-4 desktop, matching the existing catalog grid breakpoints).

### 5. `VideoCard` component (new, `frontend/src/components/reviews/VideoCard.tsx`)

Mirrors `CatalogCard.tsx`'s image-loading pattern: poster `<img loading="lazy" decoding="async">` with `src`-state + `onError` placeholder swap (reuse `categoryPlaceholder` keyed by category, or a new video-specific placeholder if that reads better — implementer's call, consistent with existing placeholder system). Duration badge (`03:29`, white text on a dark semi-transparent pill, bottom-right of the poster — matches the reference screenshot's `03:29:56` style but using realistic mm:ss/h:mm:ss formatting for actual video lengths). Play-icon overlay on hover/tap. Below the poster: title (line-clamped), views count + relative/short date.

### 6. Watch page (`frontend/src/routes/reviews.$id.tsx`) — mobile-first player, the critical piece

**Route:** full page, not a modal/sheet, on both mobile and desktop (decision made — shareable URL, working back button, simplest state model).

**Layout (375px first):** breadcrumb/back link → poster + player container (`aspect-video`, `object-contain` so vertical phone-recorded videos letterbox instead of cropping) → title/views/date/description → like button + actions menu + comment thread (the social block, §6a) → related videos row (reuse the `VideoCard` snap-row). On desktop the related row may move to a right column if it reads better (implementer's call), but the social block always sits directly under the video metadata.

**Load sequence:**
1. Page loads with the poster image (`<img>`, eager) + a centered play button overlay + all text metadata visible immediately — no video bytes requested yet.
2. `<video preload="none">` exists in the DOM but has **no `src`** attribute until the user taps play (or the poster overlay's play button).
3. On tap: auth-gate check first (`if (!getToken() && !isDemoMode())` → toast + `navigate({ to: "/login" })`, identical pattern to `writeToSeller`/the delivery-flow/call-seller features already in this codebase). If authed (or demo), attach `src` to the `<video>`, call `.load()` then `.play()`, hide the poster overlay, fire `incrementVideoView(id)` once.
4. Additionally: on mount, run the same `navigator.connection` check the landing hero video uses (`saveData === true` or `effectiveType` matching `/2g$/`) — if slow/save-data, do **not** even prefetch/decode the poster eagerly (keep it `loading="lazy"` rather than `eager` in that case) and consider showing a small "Экономия трафика" note near the play button. This does not block playback on tap (user-initiated action always allowed) — it only affects passive/ambient loading.
5. **Buffering state:** listen for the video element's `waiting` event → show a spinner overlay; `playing`/`canplay` → clear it. Standard skeleton-then-content pattern already used elsewhere in the app (e.g. `AdDetailSkeleton`), applied to the player specifically.
6. **Controls:** native HTML5 `controls` attribute (not a custom control bar) — gives play/pause/scrub/volume/**fullscreen** across all browsers/devices for free, including correct native rotation handling in fullscreen. `playsInline` set so iOS doesn't force fullscreen on play. `controlsList="nodownload"` to remove the one-click download button from the native control bar (explicitly documented as *not* real protection, just removing the most obvious escape hatch).
7. **Rotation:** delegated entirely to native fullscreen — no custom orientation-lock JS. Auto-entering fullscreen when the device is rotated to landscape is **explicitly deferred**, not built now.
8. **Gestures:** tap-to-open from cards (already covered by browse-page card links) is the only interaction built. Swipe-between-videos (TikTok/shorts-style) is **explicitly out of scope** for this round — noted as a possible distinct future "shorts" mode, not a missing piece of this one.

### 6a. Social interactions on the watch page (likes + comments + report) — REUSE of the Feed's system

Investigation confirmed the Feed's interaction layer is **not** coupled to the `Post` object: every operation is keyed by a bare string id, `CommentSection` never sees a `Post`, and the `Comment` type has no `postId` back-reference. So this is genuine reuse, not a parallel rewrite. The watch page (`reviews.$id.tsx`) adds a like button + comment thread below the video metadata:

- **`CommentSection` reused verbatim** (`frontend/src/components/feed/CommentSection.tsx`). Its props are `{ comments: Comment[]; onAdd: (text: string, parentId?: string) => void }` — entity-agnostic. The watch page passes the video's `commentList` and an `onAdd` wired to the video-scoped create call. **Zero changes to `CommentSection`.**
- **`Comment` type reused unchanged** (`mock.ts`) — it already carries `id/authorId/time/text/likes?/replies?` with no post coupling.
- **Video-scoped API functions** in `lib/api/reviews.ts`, exact copies of the Feed pattern with the resource path swapped `/posts/` → `/videos/`, each demo-branched like everything else:
  - `reactToVideo(uuid: string, on: boolean): Promise<void>` — mirrors `reactToPost` (demo: no-op, exactly like `reactToPost`'s demo branch; real: `POST/DELETE /videos/${uuid}/react`). Like state is local component state seeded from `video.isLiked`/`video.likes` with optimistic toggle + rollback-on-failure, identical to `PostCard`'s handler.
  - `fetchVideoComments(uuid: string): Promise<Comment[]>` — mirrors `fetchPostComments` (demo: `demoVideoComments(uuid)` synthesizing a deterministic seeded list; real: `GET /videos/${uuid}/comments`).
  - `createVideoComment(uuid: string, body: string, parentUuid?: string): Promise<Comment>` — mirrors `createComment`'s exact signature (demo: synthesizes a `Comment` object `{ id, authorId, time: "только что", text: body, likes: 0, replies: [] }` exactly as `createComment` does; real: `POST /videos/${uuid}/comments` with `{ body, parent_uuid }`).
  - (Optionally, if the implementer prefers, these can be one parameterized set taking a `resource: "posts" | "videos"` arg shared with the feed — nice-to-have, not required; copying is acceptable and matches the current per-entity style.)
- **"Пожаловаться" (report) — exact parity with posts, a toast stub.** In the app today, post report is `toast("Жалоба: будет доступно позже")` (`PostActionMenu.tsx`) — there is **no** real report API for posts either. The video report action does exactly the same toast, no more. **This spec does not imply the report button does anything server-side** — it's a UI affordance at literal parity with the Feed, pending the backend moderation work documented below. The video actions menu (a `PostActionMenu`-style three-dots menu, or a lighter inline one — implementer's call) carries: Пожаловаться (toast stub), and Копировать ссылку/Поделиться (build a URL from the video id, same as `PostActionMenu`).
- **Demo behavior parity:** likes update optimistically but do not persist across reload (demo `reactToVideo` is a no-op, exactly like demo `reactToPost`); comments added in-session appear immediately via the synthesized `Comment` (exactly like the Feed). This is the same demo fidelity the Feed already has — not a regression, an intentional match.
- **`views` stays a separate counter** on `Video`, unchanged by this — passive watch count, orthogonal to likes/comments.

### 7. Upload (`frontend/src/routes/reviews.upload.tsx`, new route)

Admin/owner-gated route (reuse whatever auth-role check the existing admin-area routes use — verify exact mechanism during planning, likely mirroring how `/admin` itself is gated). Form fields: title, description, category select, tags (comma-separated or chip input — implementer's call, keep simple), poster image upload (reuses `ImageUploadGrid`'s single-image mode or a simplified one-image variant), video file upload (`ImageUploadGrid` forked to `accept="video/*"`, single file, no "make main" reordering needed), `isFeatured` toggle.

Demo submit: `uploadMedia(file, "review_video")` (the `post_video` media purpose already exists in `MediaPurpose` — add `"review_video"` alongside it, or reuse `post_video` if semantically close enough — implementer's call during planning) returns a blob URL; construct a new `Video` object client-side and prepend it to demo state so it immediately appears in `/reviews` browse (newest-first). Real submit: documented as `POST /videos` in the backend doc, not implemented.

### 8. Admin management section (`ReviewsSection` in `frontend/src/routes/admin.tsx`)

New entry in the `Section` union + `navItems` + `SectionView` switch (mirrors `SettingsSection`'s shape: fetch on mount, list rows, per-row actions). Lists all videos (`fetchVideos` unfiltered), each row: title, category, views, `isFeatured` toggle (calls a demo-local update or a documented `PATCH /videos/{id}` in real mode), delete button (documented `DELETE /videos/{id}` in real mode, demo removes from local state). The heavy upload UI itself stays on `/reviews/upload`, not duplicated here.

## Demo-mode verification (this session)

Fully clickable end-to-end:
1. Enable `reviewsEnabled` via `/admin` → Настройки (mirrors the existing Сообщества toggle test).
2. Confirm "Обзоры" appears in Sidebar (not BottomNav).
3. `/reviews`: confirm search, category tabs (alphabetical + "Все" first), hero carousel autoplay + manual arrow/keyboard nav, horizontal "Новинки" row, vertical grid sorted newest-first.
4. Click a `VideoCard` → lands on `/reviews/$id`, confirm poster+metadata visible with zero video network requests until play is tapped.
5. Tap play (as demo user) → confirm the bundled sample video actually plays, controls work, fullscreen works, buffering spinner logic is present (verifiable via DOM/state even if the demo clip loads too fast to visibly catch buffering).
6. Confirm guest (real mode, no token) tapping play redirects to `/login` with a toast.
7. `/reviews/upload`: submit a video (any local file) as admin, confirm it appears at the top of `/reviews` immediately.
8. `/admin` → new "Обзоры" section: confirm the uploaded video is listed, toggle `isFeatured`, delete it, confirm it disappears from `/reviews`.
9. On `/reviews/$id`: like the video (count bumps optimistically), open the comment thread, add a comment (appears immediately), tap a reply, tap "Пожаловаться" (confirm the toast stub fires — exact parity with a post's report). Confirm this all works in demo the same way the Feed does.
10. Repeat steps 3-5 (and 9) at 375px first, then desktop.

## Backend Documentation (new entry — must be a full executable spec)

A new numbered entry in `backend-endpoints-needed.md`, written as a complete technical brief the backend team can implement without follow-up questions — **not** a one-line note. Must include, in full:

- **Data models:** `Video`, `VideoCategory`, `VideoView` — every field, type, nullability, and purpose (per the Data Model section above, expanded with DB-appropriate types: `uuid`, `text`, `integer`, `timestamp`, `boolean`, foreign keys).
- **Endpoints, each with method + path + auth requirement + full request payload shape + full response shape + relevant status codes:**
  - `GET /videos` — list, with query params (search `q`, `category_id`, `sort`, `page`/`per_page`), paginated response shape.
  - `GET /videos/{id}` — detail, full `Video` object.
  - `GET /videos/categories` — category list.
  - `POST /videos` — create (title/description/category/tags/poster media id/video media id/is_featured), auth: admin/owner only, response: created `Video`.
  - `PATCH /videos/{id}` — update (e.g. `is_featured` toggle from admin section), auth: admin/owner.
  - `DELETE /videos/{id}` — auth: admin/owner.
  - `POST /videos/{id}/view` — increment view count, dedup strategy left to backend discretion but the endpoint contract (idempotency window, response shape) should be specified.
  - Media upload: note that `POST /media` already exists per prior sessions' documentation (`purpose: "review_video"` or reuse `post_video`), and video-specific requirements (max file size, accepted MIME types, whether server-side transcoding/thumbnail-generation happens) must be spelled out even though the endpoint shape is inherited.
- **Social-interaction endpoints (mirror the existing `/posts/{id}/...` contracts exactly — same shapes, `/videos/` resource):**
  - `POST /videos/{id}/react` and `DELETE /videos/{id}/react` — like/unlike, auth required, mirrors `POST/DELETE /posts/{id}/react`.
  - `GET /videos/{id}/comments` — comment list, response is an array of the same `Comment` resource shape the posts endpoint returns (`id/author/time/text/likes/replies`).
  - `POST /videos/{id}/comments` — create comment, auth required, body `{ body: string, parent_uuid?: string }`, response: created comment — identical to `POST /posts/{id}/comments`.
  - These are a deliberate parity copy of the post-comment/reaction contracts; the backend can likely serve them from the same polymorphic commentable/reactable mechanism it (will) use for posts.
- **Moderation — extend the existing polymorphic queue to videos:** the app's `ModerationType` union (`lib/api/admin.ts`) is currently `"posts" | "communities"`, backed by a Laravel `moderatable_type` morph, and `approveModeration`/`rejectModeration`/`reviseModeration` already hit `/admin/moderation/{type}/{id}/...`. This spec **adds `"videos"` to that union on the frontend** and requires the backend to: (a) register `Video` as a `moderatable_type`, (b) surface videos in `GET /admin/moderation` queue results with `moderatable_type` mapping to `"videos"`, (c) honor `/admin/moderation/videos/{id}/approve|reject|revise`. **Honest scope note:** the user-facing "Пожаловаться" button is a toast stub today (true for posts too — no report-submission API exists yet for any content type). A real report → moderation-queue flow needs a `POST /reports` (or `POST /videos/{id}/report`) endpoint that does not exist for posts either; document it as a desired future addition that would benefit posts AND videos uniformly, not a video-specific gap.
- **Real video storage/streaming/CDN infrastructure:** explicitly flagged as a substantial, separate backend/infra project (storage provider, transcoding pipeline for multiple resolutions/formats, CDN delivery, possibly HLS/DASH adaptive streaming instead of a flat file) — not solved by `POST /media`'s existing blob-storage pattern, which is fine for images but not built for video at scale. Documented as scope, not built.
- **Anti-piracy/DRM honesty note:** no real DRM is proposed or expected — browser-native video is fundamentally downloadable via devtools/network inspection regardless of backend measures; `controlsList="nodownload"` is a frontend UI nicety only. If real protection is ever required, that's a signed-URL-expiry + possibly a commercial DRM/CDN provider (e.g. token-gated HLS) discussion for a future round, not assumed or promised here.

## Out of Scope (explicit)

- Real video storage/streaming/CDN/transcoding infrastructure.
- Real DRM or meaningful download protection.
- Swipe-between-videos / shorts-style vertical feed navigation.
- Auto-fullscreen-on-rotate.
- **Ratings** (star ratings) — NOT in scope. Likes + comments ARE in scope (§6a, reusing the Feed's system), but a separate star-rating system is not.
- A real report-submission → moderation-queue flow (the "Пожаловаться" button is a toast stub at exact parity with posts; the moderation queue is documented to accept `"videos"` for when a real report API is added, which would be a cross-content-type addition, not video-specific).
- BottomNav changes.
