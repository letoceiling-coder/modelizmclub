# Feed Composer «Создать» Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the feed composer's always-open "Что нового?" trigger row with a minimal "Создать" button that reveals a type (Пост/Видео) then, for channel owners, source (профиль/канал) menu — collapse the composer form to one step matching the chosen type/source, and restore the auto-open-file-picker UX lost in today's earlier upload fix.

**Architecture:** Extract `UserMenu.tsx`'s hover-dropdown logic (fixed earlier today: `modal={false}` + phantom-event guard) into a shared `useHoverDropdown()` hook, reused by a new `CreatePostMenu.tsx` (Radix `DropdownMenuSub` nesting on desktop, flat `vaul` `Drawer` list on mobile). `CreatePostForm.tsx` collapses its `"photos"|"details"` wizard into one screen whose fields and submit branch on the selected `{ kind, source }`. `ImageUploadGrid`/`VideoUploadField` gain an `autoOpen` prop for the file-picker fix.

**Tech Stack:** TanStack Start/React 19/TypeScript strict, Radix `DropdownMenu` (`@radix-ui/react-dropdown-menu` via `@/components/ui/dropdown-menu`), `vaul` `Drawer` (via `@/components/ui/drawer`), lucide-react icons.

## Global Constraints

- Frontend-only. No backend changes. `createPost`/`publishPost`/`createChannelPost`/`uploadMedia` are used exactly as they exist today — do not modify `src/lib/api/*` or `src/lib/channels.ts` function signatures.
- Never fabricate a local `Post`/`ChannelPost` stand-in to represent a successful publish — `onCreate` is only ever called with the real object the backend returned (or not called at all, for the channel branch). This is the exact discipline that fixed today's `addPost` bug (commit `d6b7469`) — do not reintroduce it.
- Community (сообщества) posting is explicitly out of scope — it has zero real backend/API wiring today (confirmed: `SubmitPostSheet.tsx`'s `submit()` is a bare `setTimeout` fake, `Community.allowSubmitPost` is never read by the real API mapper). Do not touch `communities.$id.tsx` or `SubmitPostSheet.tsx`.
- No new fields on `Post` or `ChannelPost` — a channel-sourced post stays an ordinary `Post` row server-side (category «Каналы»), exactly as today.
- `onCreate?: (p: Post) => void` on `CreatePostForm` keeps this exact signature — never widened to a union type.
- Every task ends with `tsc --noEmit` clean. The final task requires live verification on the neeklo stand (both desktop and mobile 360/390/430) before considering the feature done — this project's standing rule that live browser verification (not tsc alone) is required for every UI change.
- Spec source of truth: `frontend/docs/superpowers/specs/2026-07-14-feed-composer-create-menu-design.md`.
- Final pushed history must contain exactly 2 commits for this feature (per spec): one UI-redesign commit, one auto-open-file-picker fix commit — even though the tasks below are implemented and reviewed in finer-grained, more-than-2 increments for reviewability. Task 5 consolidates them via `git reset --soft` before pushing (see Task 5).

---

## File Structure

- **Create:** `src/lib/hooks/useHoverDropdown.ts` — shared hover-open/close + phantom-event-guard logic.
- **Modify:** `src/components/layout/UserMenu.tsx` — consume the extracted hook (pure refactor).
- **Modify:** `src/components/ads/wizard/ImageUploadGrid.tsx` — add `autoOpen` prop.
- **Modify:** `src/components/reviews/VideoUploadField.tsx` — add `autoOpen` prop.
- **Create:** `src/components/feed/CreatePostMenu.tsx` — the new "Создать" trigger + menu (desktop dropdown, mobile drawer).
- **Delete:** `src/components/feed/CreatePostTrigger.tsx` — replaced by `CreatePostMenu.tsx`.
- **Modify:** `src/routes/feed.tsx` — wire the new menu in place of the old trigger.
- **Modify:** `src/components/feed/CreatePostModal.tsx` — prop rename `intent`→`selection`.
- **Modify:** `src/components/CreatePostForm.tsx` — collapse to one step, add channel branch.

---

### Task 1: Extract `useHoverDropdown` hook + refactor `UserMenu.tsx`

**Files:**
- Create: `frontend/src/lib/hooks/useHoverDropdown.ts`
- Modify: `frontend/src/components/layout/UserMenu.tsx` (full rewrite — same visible behavior)

**Interfaces:**
- Produces: `useHoverDropdown(): { open: boolean; setOpen: (v: boolean) => void; wrapperRef: React.RefObject<HTMLDivElement>; onWrapperMouseEnter: (e: React.MouseEvent) => void; onWrapperMouseLeave: (e: React.MouseEvent) => void; onContentMouseEnter: (e: React.MouseEvent) => void; }`. Task 3 (`CreatePostMenu.tsx`) imports this by this exact name/shape.

This must be a **behavior-preserving refactor** of `UserMenu.tsx` — the profile dropdown must keep behaving exactly as it does today (already live-verified this session): hover-open, hover-away closes, Escape closes, click-outside closes, zero flicker on stationary hover.

- [ ] **Step 1: Create the hook file**

Create `frontend/src/lib/hooks/useHoverDropdown.ts`:

```ts
import { useRef, useState } from "react";

const CLOSE_DELAY_MS = 250;

/** Shared hover-open/close logic for a Radix DropdownMenu portaled back
 *  into its own trigger wrapper (portalContainer={wrapperRef.current}),
 *  instead of Radix's default document.body portal. That placement fixes
 *  a "closes right as you're about to click" gap-timing bug (a hover
 *  handler on the trigger and one on a separately-mounted document.body
 *  portal are two disjoint zones), but re-mounting content inside the
 *  wrapper on every open/close makes Chromium re-run hit-testing under a
 *  STATIONARY cursor and synthesize a phantom mouseenter/mouseleave with
 *  relatedTarget === document.documentElement (<html>) — indistinguishable
 *  by relatedTarget alone from a genuine leave when the DropdownMenu's
 *  default modal=true also sets document.body.style.pointerEvents="none"
 *  while open (browsers then hit-test any real cursor movement outside
 *  the trigger/content branch to <html> too). Consumers MUST pass
 *  modal={false} to their <DropdownMenu> to avoid that second case
 *  entirely.
 *
 *  Usage: spread wrapperRef/onWrapperMouseEnter/onWrapperMouseLeave onto
 *  the wrapping <div>, pass open/setOpen to <DropdownMenu modal={false}>,
 *  portalContainer={wrapperRef.current} + onMouseEnter={onContentMouseEnter}
 *  + onMouseLeave={onWrapperMouseLeave} onto <DropdownMenuContent>. */
export function useHoverDropdown() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  const isPhantomHoverEvent = (e: React.MouseEvent) => e.relatedTarget === document.documentElement;
  const onWrapperMouseEnter = (e: React.MouseEvent) => {
    if (isPhantomHoverEvent(e)) return;
    cancelClose();
    setOpen(true);
  };
  const onWrapperMouseLeave = (e: React.MouseEvent) => {
    if (isPhantomHoverEvent(e)) return;
    scheduleClose();
  };
  const onContentMouseEnter = (e: React.MouseEvent) => {
    if (isPhantomHoverEvent(e)) return;
    cancelClose();
  };

  return { open, setOpen, wrapperRef, onWrapperMouseEnter, onWrapperMouseLeave, onContentMouseEnter };
}
```

- [ ] **Step 2: Rewrite `UserMenu.tsx` to consume the hook**

Replace the full contents of `frontend/src/components/layout/UserMenu.tsx` with:

```tsx
import { Link } from "@tanstack/react-router";
import { User, ClipboardList, Crown, LogOut, Sun, Moon, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useStore, selectors } from "@/lib/store";
import { signOut } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { useTheme } from "@/components/ThemeProvider";
import { useHoverDropdown } from "@/lib/hooks/useHoverDropdown";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function UserMenu() {
  const me = useStore(selectors.currentUser);
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const { open, setOpen, wrapperRef, onWrapperMouseEnter, onWrapperMouseLeave, onContentMouseEnter } = useHoverDropdown();

  const hasAvatar = Boolean(me.avatar && me.avatar.trim());

  const handleSignOut = () => {
    void signOut().then(() => {
      window.location.href = "/login";
    });
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={onWrapperMouseEnter}
      onMouseLeave={onWrapperMouseLeave}
    >
      {/* modal={false}: see useHoverDropdown's doc comment — Radix's default
          modal DropdownMenu disables body pointer-events while open, which
          makes genuine cursor-leave events indistinguishable from the
          phantom DOM-mutation events the hook filters. */}
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("nav.profile")}
            className="grid place-items-center rounded-full outline-none transition-colors"
            style={{ width: 40, height: 40 }}
          >
            <Avatar className="h-9 w-9">
              {hasAvatar && <AvatarImage src={me.avatar} alt="" className="object-cover" />}
              <AvatarFallback
                className="text-[13px] font-bold"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {initials(me.name)}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          portalContainer={wrapperRef.current}
          align="end"
          sideOffset={8}
          className="w-56"
          onMouseEnter={onContentMouseEnter}
          onMouseLeave={onWrapperMouseLeave}
        >
          <DropdownMenuItem asChild>
            <Link to={ROUTES.profile} className="flex items-center gap-2">
              <User className="h-4 w-4" /> {t("nav.profile")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={ROUTES.myAds} className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> {t("nav.myAds")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={ROUTES.subscription} className="flex items-center gap-2">
              <Crown className="h-4 w-4" /> {t("nav.subscription")}
            </Link>
          </DropdownMenuItem>
          {me.isAdmin && (
            <DropdownMenuItem asChild>
              <Link to={ROUTES.admin} className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> {t("nav.admin")}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => { e.preventDefault(); toggleTheme(); }}
            className="flex items-center gap-2"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDark ? "Светлая тема" : "Тёмная тема"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleSignOut} className="flex items-center gap-2">
            <LogOut className="h-4 w-4" /> {t("auth.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual regression check on desktop (≥1024px)**

Run the dev server, hover the avatar in the top-right — menu opens. Move the mouse away — menu closes within ~250ms. Hover open again, press Escape — closes and does not silently reopen. Hover open again, click elsewhere on the page — closes. Hover open and hold the cursor perfectly still over the avatar for 2+ seconds — no flicker/re-render loop.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/hooks/useHoverDropdown.ts frontend/src/components/layout/UserMenu.tsx
git commit -m "refactor(nav): extract useHoverDropdown hook from UserMenu"
```

---

### Task 2: `autoOpen` prop on `ImageUploadGrid` and `VideoUploadField`

**Files:**
- Modify: `frontend/src/components/ads/wizard/ImageUploadGrid.tsx`
- Modify: `frontend/src/components/reviews/VideoUploadField.tsx`

**Interfaces:**
- Produces: both components gain an optional `autoOpen?: boolean` prop — when `true`, the component clicks its own hidden file input ~150ms after mount. Task 4 (`CreatePostForm.tsx`) passes `autoOpen` to whichever widget it renders.
- Both existing call sites (`frontend/src/routes/ads.new.tsx`, the channel `Composer` in `frontend/src/routes/channel.$id.tsx`) don't pass this prop — it's `undefined`/falsy there, so their behavior is unchanged.

- [ ] **Step 1: Add `autoOpen` to `ImageUploadGrid`**

In `frontend/src/components/ads/wizard/ImageUploadGrid.tsx`, change the import line (currently line 1):

```ts
import { useRef, useState } from "react";
```

to:

```ts
import { useEffect, useRef, useState } from "react";
```

Change the `Props` interface (currently lines 4-11):

```ts
interface Props {
  photos: string[];
  max: number;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onMakeMain: (index: number) => void;
  onReorder: (newPhotos: string[]) => void;
}
```

to:

```ts
interface Props {
  photos: string[];
  max: number;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onMakeMain: (index: number) => void;
  onReorder: (newPhotos: string[]) => void;
  /** Auto-clicks the hidden file input on mount, after a short delay to
   *  let the parent modal's mount/transition settle first. Used by
   *  CreatePostForm so choosing "Пост" in the composer menu jumps
   *  straight to the OS file picker instead of landing on an empty grid. */
  autoOpen?: boolean;
}
```

Change the component signature (currently `export function ImageUploadGrid({ photos, max, onAdd, onRemove, onMakeMain, onReorder }: Props) {`) to:

```ts
export function ImageUploadGrid({ photos, max, onAdd, onRemove, onMakeMain, onReorder, autoOpen }: Props) {
```

Immediately after the line `const draggingRef = useRef(false);` inside that function, add:

```ts
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoOpen) return;
    const t = setTimeout(() => inputRef.current?.click(), 150);
    return () => clearTimeout(t);
  }, []);
```

Change the file input element (currently `<input type="file" accept="image/*" multiple onChange={handleChange} className="hidden" disabled={full} />`) to:

```tsx
<input ref={inputRef} type="file" accept="image/*" multiple onChange={handleChange} className="hidden" disabled={full} />
```

- [ ] **Step 2: Add `autoOpen` to `VideoUploadField`**

Replace the full contents of `frontend/src/components/reviews/VideoUploadField.tsx` with:

```tsx
import { useEffect, useRef } from "react";
import { X, Film } from "lucide-react";

interface Props {
  fileUrl: string | null;         // blob preview URL, or null
  onPick: (file: File) => void;
  onClear: () => void;
  accept: string;                 // "video/*" or "image/*"
  label: string;
  /** Auto-clicks the hidden file input on mount, after a short delay to
   *  let the parent modal's mount/transition settle first. Used by
   *  CreatePostForm so choosing "Видео" in the composer menu jumps
   *  straight to the OS file picker instead of landing on an empty field. */
  autoOpen?: boolean;
}

export function VideoUploadField({ fileUrl, onPick, onClear, accept, label, autoOpen }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoOpen) return;
    const t = setTimeout(() => inputRef.current?.click(), 150);
    return () => clearTimeout(t);
  }, []);

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
            ref={inputRef}
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

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual regression check — existing call sites unaffected**

Open `/ads/new` (ad creation, uses `ImageUploadGrid` without `autoOpen`) — confirm the upload grid still just shows the empty drop-zone on mount, no auto-triggered file picker. If a test channel-owner account is available, open a channel's composer (uses both `ImageUploadGrid` and `VideoUploadField`, also without `autoOpen`) and confirm the same — neither auto-opens.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ads/wizard/ImageUploadGrid.tsx frontend/src/components/reviews/VideoUploadField.tsx
git commit -m "feat(uploads): add autoOpen prop to ImageUploadGrid and VideoUploadField"
```

---

### Task 3: `CreatePostMenu.tsx` + wire into `feed.tsx`

**Files:**
- Create: `frontend/src/components/feed/CreatePostMenu.tsx`
- Delete: `frontend/src/components/feed/CreatePostTrigger.tsx`
- Modify: `frontend/src/routes/feed.tsx`

**Interfaces:**
- Consumes: `useHoverDropdown` (Task 1, `@/lib/hooks/useHoverDropdown`); `useChannels`, `type Channel` (`@/lib/channels`, already exist, unchanged).
- Produces: `export type ComposerKind = "photo" | "video"`, `export type ComposerSourceKind = "profile" | "channel"`, `export interface ComposerSelection { kind: ComposerKind; source: ComposerSourceKind; channel?: Channel; }` (present iff `source === "channel"`), and `export function CreatePostMenu({ onSelect }: { onSelect: (selection: ComposerSelection) => void })`. Task 4 (`CreatePostModal.tsx`/`CreatePostForm.tsx`) imports `ComposerSelection` by this exact shape.

- [ ] **Step 1: Create `CreatePostMenu.tsx`**

Create `frontend/src/components/feed/CreatePostMenu.tsx`:

```tsx
import { useState } from "react";
import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from "@/components/ui/drawer";
import { useHoverDropdown } from "@/lib/hooks/useHoverDropdown";
import { useChannels, type Channel } from "@/lib/channels";

export type ComposerKind = "photo" | "video";
export type ComposerSourceKind = "profile" | "channel";

export interface ComposerSelection {
  kind: ComposerKind;
  source: ComposerSourceKind;
  /** Present iff source === "channel". */
  channel?: Channel;
}

interface Props {
  onSelect: (selection: ComposerSelection) => void;
}

const KIND_LABEL: Record<ComposerKind, string> = { photo: "Пост", video: "Видео" };

const ROW_CLASS =
  "flex min-h-[52px] items-center rounded-[var(--r-card-sm)] px-3 text-left text-[15px] font-medium transition-colors hover:bg-[var(--background-surface)]";

/** Replaces the old always-open "Что нового?" composer row with a single
 *  minimal "Создать" trigger. Desktop reveals a hover/click dropdown
 *  (type, then — only for a channel owner — source, via a native Radix
 *  submenu); mobile uses a flat vaul bottom sheet instead, since 2-4 items
 *  don't need a second sheet screen. */
export function CreatePostMenu({ onSelect }: Props) {
  const { channels } = useChannels();
  const myChannel = channels.find((c) => c.isOwner);
  const { open, setOpen, wrapperRef, onWrapperMouseEnter, onWrapperMouseLeave, onContentMouseEnter } = useHoverDropdown();
  const [mobileOpen, setMobileOpen] = useState(false);

  const select = (kind: ComposerKind, source: ComposerSourceKind) => {
    onSelect({ kind, source, channel: source === "channel" ? myChannel : undefined });
    setOpen(false);
    setMobileOpen(false);
  };

  const triggerButton = (
    <button
      type="button"
      className="inline-flex h-[40px] items-center gap-[6px] rounded-[var(--r-button)] border px-[16px] text-[14px] font-semibold transition-colors hover:bg-[var(--background-surface-hover)]"
      style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--background-surface)" }}
    >
      <Plus size={16} /> Создать
    </button>
  );

  return (
    <>
      {/* Desktop */}
      <div
        ref={wrapperRef}
        className="relative hidden lg:block"
        onMouseEnter={onWrapperMouseEnter}
        onMouseLeave={onWrapperMouseLeave}
      >
        <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
          <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
          <DropdownMenuContent
            portalContainer={wrapperRef.current}
            align="start"
            sideOffset={8}
            onMouseEnter={onContentMouseEnter}
            onMouseLeave={onWrapperMouseLeave}
          >
            {(["photo", "video"] as const).map((kind) =>
              myChannel ? (
                <DropdownMenuSub key={kind}>
                  <DropdownMenuSubTrigger>{KIND_LABEL[kind]}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onSelect={() => select(kind, "profile")}>От своего профиля</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => select(kind, "channel")}>От канала «{myChannel.name}»</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : (
                <DropdownMenuItem key={kind} onSelect={() => select(kind, "profile")}>
                  {KIND_LABEL[kind]}
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile */}
      <div className="lg:hidden">
        <Drawer open={mobileOpen} onOpenChange={setMobileOpen} shouldScaleBackground={false}>
          <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
          <DrawerContent className="pb-[calc(var(--safe-bottom)+12px)]">
            <div className="px-4 pt-3">
              <DrawerTitle className="text-base">Создать</DrawerTitle>
            </div>
            <div className="mt-2 flex flex-col px-2 pb-1">
              {myChannel ? (
                <>
                  <button type="button" onClick={() => select("photo", "profile")} className={ROW_CLASS} style={{ color: "var(--foreground)" }}>
                    Пост от профиля
                  </button>
                  <button type="button" onClick={() => select("photo", "channel")} className={ROW_CLASS} style={{ color: "var(--foreground)" }}>
                    Пост от канала «{myChannel.name}»
                  </button>
                  <button type="button" onClick={() => select("video", "profile")} className={ROW_CLASS} style={{ color: "var(--foreground)" }}>
                    Видео от профиля
                  </button>
                  <button type="button" onClick={() => select("video", "channel")} className={ROW_CLASS} style={{ color: "var(--foreground)" }}>
                    Видео от канала «{myChannel.name}»
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => select("photo", "profile")} className={ROW_CLASS} style={{ color: "var(--foreground)" }}>
                    Пост
                  </button>
                  <button type="button" onClick={() => select("video", "profile")} className={ROW_CLASS} style={{ color: "var(--foreground)" }}>
                    Видео
                  </button>
                </>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Delete the old trigger**

```bash
rm frontend/src/components/feed/CreatePostTrigger.tsx
```

- [ ] **Step 3: Wire into `feed.tsx`**

In `frontend/src/routes/feed.tsx`, change the import (currently lines 6-7):

```ts
import { CreatePostTrigger, type PostIntent } from "@/components/feed/CreatePostTrigger";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
```

to:

```ts
import { CreatePostMenu, type ComposerSelection } from "@/components/feed/CreatePostMenu";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
```

Change the composer state (currently lines 54-55):

```ts
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerIntent, setComposerIntent] = useState<PostIntent | undefined>(undefined);
```

to:

```ts
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSelection, setComposerSelection] = useState<ComposerSelection | undefined>(undefined);
```

Change the trigger render (currently line 166):

```tsx
        <CreatePostTrigger onOpen={(intent) => { setComposerIntent(intent); setComposerOpen(true); }} />
```

to:

```tsx
        <CreatePostMenu onSelect={(sel) => { setComposerSelection(sel); setComposerOpen(true); }} />
```

Change the modal render (currently line 268):

```tsx
      <CreatePostModal open={composerOpen} intent={composerIntent} onClose={() => setComposerOpen(false)} onCreate={addPost} />
```

to:

```tsx
      <CreatePostModal open={composerOpen} selection={composerSelection} onClose={() => setComposerOpen(false)} onCreate={addPost} />
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: errors ONLY inside `CreatePostModal.tsx`/`CreatePostForm.tsx` (they still reference the now-deleted `PostIntent`/old `intent` prop — Task 4 fixes this). No errors anywhere else. If you see errors outside those two files, stop and re-check this task's edits before proceeding.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/feed/CreatePostMenu.tsx frontend/src/routes/feed.tsx
git rm frontend/src/components/feed/CreatePostTrigger.tsx
git commit -m "feat(feed): add CreatePostMenu — Создать trigger with type+source selection"
```

---

### Task 4: Collapse `CreatePostForm.tsx` to one step + channel branch

**Files:**
- Modify: `frontend/src/components/feed/CreatePostModal.tsx`
- Modify: `frontend/src/components/CreatePostForm.tsx`

**Interfaces:**
- Consumes: `ComposerSelection` (Task 3, `@/components/feed/CreatePostMenu`); `autoOpen` prop on `ImageUploadGrid`/`VideoUploadField` (Task 2); `createChannelPost`, `POST_KIND_LABEL`, `type PostKind`, `type Channel` (`@/lib/channels`, unchanged); `createPost`, `publishPost` (`@/lib/api/feed`, unchanged); `uploadMedia` (`@/lib/api/media`, unchanged).
- Produces: `CreatePostForm({ onCreate, onClose, selection }: { onCreate?: (p: Post) => void; onClose?: () => void; selection?: ComposerSelection })` — this task is the last consumer of `ComposerSelection` in this plan, no later task depends on further exports from this file.

This task fixes the tsc errors Task 3 intentionally left behind.

- [ ] **Step 1: Update `CreatePostModal.tsx`**

In `frontend/src/components/feed/CreatePostModal.tsx`, change the imports (currently lines 1-4):

```tsx
import { useEffect, useState } from "react";
import { CreatePostForm } from "@/components/CreatePostForm";
import type { PostIntent } from "@/components/feed/CreatePostTrigger";
import type { Post } from "@/lib/mock";
```

to:

```tsx
import { useEffect, useState } from "react";
import { CreatePostForm } from "@/components/CreatePostForm";
import type { ComposerSelection } from "@/components/feed/CreatePostMenu";
import type { Post } from "@/lib/mock";
```

Change the `Props` interface (currently lines 6-11):

```tsx
interface Props {
  open: boolean;
  intent?: PostIntent;
  onClose: () => void;
  onCreate: (p: Post) => void;
}
```

to:

```tsx
interface Props {
  open: boolean;
  selection?: ComposerSelection;
  onClose: () => void;
  onCreate: (p: Post) => void;
}
```

Change the component signature (currently `export function CreatePostModal({ open, intent, onClose, onCreate }: Props) {`) to:

```tsx
export function CreatePostModal({ open, selection, onClose, onCreate }: Props) {
```

Change the `CreatePostForm` render (currently lines 71-75):

```tsx
        <CreatePostForm
          intent={open ? intent : undefined}
          onCreate={onCreate}
          onClose={onClose}
        />
```

to:

```tsx
        <CreatePostForm
          selection={open ? selection : undefined}
          onCreate={onCreate}
          onClose={onClose}
        />
```

- [ ] **Step 2: Rewrite `CreatePostForm.tsx`**

Replace the full contents of `frontend/src/components/CreatePostForm.tsx` with:

```tsx
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, X, Newspaper, Star, Megaphone, Tag } from "lucide-react";
import { toast } from "@/lib/toast";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { useStore, selectors } from "@/lib/store";
import { isDemoMode } from "@/lib/demo-mode";
import { uploadMedia } from "@/lib/api/media";
import { createPost, publishPost } from "@/lib/api/feed";
import { createChannelPost, POST_KIND_LABEL, type PostKind } from "@/lib/channels";
import type { Post } from "@/lib/mock";
import { ImageUploadGrid } from "@/components/ads/wizard/ImageUploadGrid";
import { VideoUploadField } from "@/components/reviews/VideoUploadField";
import type { ComposerSelection } from "@/components/feed/CreatePostMenu";

const MAX_PHOTOS = 10;

const POST_KIND_ICON: Record<PostKind, typeof Newspaper> = {
  news: Newspaper,
  review: Star,
  announce: Megaphone,
  promo: Tag,
};

/** Compact chromed <select> chip for the composer — quieter and auto-width,
 *  unlike the full-width NativeSelect used in forms. */
function ChipSelect({
  value, onChange, options, disabled, ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className="h-[44px] w-full cursor-pointer appearance-none truncate rounded-[var(--r-button)] border border-[var(--border)] bg-[var(--background-surface)] pl-[14px] pr-[30px] text-[14px] font-medium text-[var(--foreground)] outline-none transition-colors focus-visible:border-[var(--accent)] disabled:opacity-40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2"
        style={{ color: "var(--foreground-50)" }}
      />
    </div>
  );
}

export function CreatePostForm({ onCreate, onClose, selection }: {
  /** Fired once the post is actually created (and, outside demo mode,
   *  published) on the backend — the real Post the API returned, not a
   *  locally-fabricated stand-in. Only called for selection.source ===
   *  "profile" — see publish() below for the channel branch. */
  onCreate?: (p: Post) => void;
  onClose?: () => void;
  selection?: ComposerSelection;
}) {
  // selection is only briefly undefined during CreatePostModal's closing
  // CSS transition (content stays mounted while fading out) — this
  // fallback is render-only and never affects a real publish, since the
  // form is unreachable by the user once closing has started.
  const sel: ComposerSelection = selection ?? { kind: "photo", source: "profile" };
  const categories = usePostCategories();
  const me = useStore(selectors.currentUser);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [catId, setCatId] = useState("");
  const [subId, setSubId] = useState<string>("");
  const [channelKind, setChannelKind] = useState<PostKind>("news");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!catId && categories.length > 0) {
      setCatId(categories[0].id);
      setSubId(categories[0].subcategories[0]?.id ?? "");
    }
  }, [categories, catId]);

  const cat = useMemo(() => categories.find((c) => c.id === catId), [categories, catId]);

  const addPhotos = (picked: File[]) => {
    const room = MAX_PHOTOS - photos.length;
    const next = picked.slice(0, room);
    const urls = next.map((f) => URL.createObjectURL(f));
    setPhotos((p) => [...p, ...urls]);
    setPhotoFiles((f) => [...f, ...next]);
  };
  const removePhoto = (i: number) => {
    setPhotos((p) => p.filter((_, idx) => idx !== i));
    setPhotoFiles((f) => f.filter((_, idx) => idx !== i));
  };
  const reorderPhotos = (next: string[]) => {
    setPhotoFiles(next.map((url) => photoFiles[photos.indexOf(url)]));
    setPhotos(next);
  };

  const publish = async () => {
    if (sel.source === "profile" && !title.trim()) { toast.error("Введите заголовок"); return; }
    if (!text.trim()) { toast.error("Введите текст публикации"); return; }
    if (sel.source === "profile" && !cat) { toast.error("Выберите категорию"); return; }
    setPublishing(true);
    try {
      const mediaIds: string[] = [];
      if (sel.kind === "photo") {
        for (const file of photoFiles) {
          const m = await uploadMedia(file, "post");
          mediaIds.push(m.uuid);
        }
      } else if (videoFile) {
        const m = await uploadMedia(videoFile, "post_video");
        mediaIds.push(m.uuid);
      }

      if (sel.source === "profile") {
        let post = await createPost({
          title: title.trim(),
          body: text.trim(),
          categoryId: Number(cat!.id),
          mediaIds,
        });
        if (!isDemoMode()) {
          post = await publishPost(post.id);
        }
        onCreate?.(post);
        toast.success("Публикация отправлена на модерацию");
      } else {
        await createChannelPost({
          channelSlug: sel.channel!.slug,
          text: text.trim(),
          kind: channelKind,
          mediaIds,
        });
        toast.success("Пост опубликован в канал");
        // No onCreate call — createChannelPost only returns a ChannelPost
        // (channel-scoped view), not the duplicated Post the backend
        // created server-side. Nothing is locally fabricated or prepended
        // to the feed here; the real duplicated Post shows up on the next
        // GET /feed, exactly like today's channel Composer.
      }
      onClose?.();
    } catch {
      toast.error("Не удалось опубликовать. Попробуйте позже");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className="flex items-center gap-[8px] border-b px-[8px] py-[8px]"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="Закрыть"
          className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-70)" }}
        >
          <X className="h-[20px] w-[20px]" />
        </button>
        <h2
          className="min-w-0 flex-1 truncate text-[16px] font-semibold"
          style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
        >
          Новый пост
        </h2>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto px-[16px] pt-[14px]">
        {sel.source === "profile" && (
          <div className="flex items-start gap-[12px]">
            <img src={me.avatar} alt="" className="mt-[2px] h-[40px] w-[40px] shrink-0 rounded-full" />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Заголовок"
              className="min-w-0 flex-1 bg-transparent pt-[8px] text-[16px] font-semibold outline-none placeholder:font-medium"
              style={{ color: "var(--foreground)" }}
            />
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            sel.source === "channel"
              ? `Текст ${POST_KIND_LABEL[channelKind].toLowerCase()}а для подписчиков…`
              : "Расскажите о проекте — опыт, детали сборки, впечатления…"
          }
          className="min-h-[120px] w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
          style={{ color: "var(--foreground)" }}
        />

        {sel.source === "profile" ? (
          <div className="flex flex-col gap-[8px]">
            <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-50)" }}>
              Направление и масштаб
            </span>
            <div className="flex items-center gap-[8px]">
              <ChipSelect
                ariaLabel="Направление"
                value={catId}
                onChange={(v) => {
                  setCatId(v);
                  const c = categories.find((cc) => cc.id === v)!;
                  setSubId(c.subcategories[0]?.id ?? "");
                }}
                options={categories.map((c) => ({ label: c.name, value: c.id }))}
              />
              <ChipSelect
                ariaLabel="Подкатегория"
                value={subId}
                onChange={setSubId}
                disabled={!cat || cat.subcategories.length === 0}
                options={(cat?.subcategories ?? []).map((s) => ({ label: s.name, value: s.id }))}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-[6px]">
            {(Object.keys(POST_KIND_LABEL) as PostKind[]).map((k) => {
              const active = channelKind === k;
              const Icon = POST_KIND_ICON[k];
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setChannelKind(k)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold transition-colors"
                  style={{
                    padding: "7px 11px",
                    borderRadius: 9,
                    background: active ? "var(--accent-soft)" : "var(--background-surface)",
                    color: active ? "var(--accent)" : "var(--foreground-70)",
                    border: active ? "1px solid color-mix(in oklab, var(--accent) 35%, transparent)" : "1px solid transparent",
                  }}
                >
                  <Icon size={12} /> {POST_KIND_LABEL[k]}
                </button>
              );
            })}
          </div>
        )}

        {sel.kind === "photo" ? (
          <ImageUploadGrid
            photos={photos}
            max={MAX_PHOTOS}
            onAdd={addPhotos}
            onRemove={removePhoto}
            onMakeMain={() => {}}
            onReorder={reorderPhotos}
            autoOpen
          />
        ) : (
          <VideoUploadField
            fileUrl={videoUrl}
            accept="video/*"
            label="Добавить видео"
            onPick={(file) => {
              setVideoFile(file);
              setVideoUrl(URL.createObjectURL(file));
            }}
            onClear={() => {
              setVideoFile(null);
              setVideoUrl(null);
            }}
            autoOpen
          />
        )}
      </div>

      <div
        className="shrink-0 border-t px-[16px] pt-[10px]"
        style={{ borderColor: "var(--border)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={publish}
          disabled={publishing}
          className="h-[48px] w-full rounded-[var(--r-button)] text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          {publishing ? "Публикуем…" : "Опубликовать"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 4: Manual smoke check — profile branch, real publish**

Run the dev server against the real (non-demo) API if possible, or otherwise note demo-mode limitations. Click "Создать" → "Пост" (no channel needed for this check) → confirm the OS file picker opens automatically within ~150ms of the form mounting → pick a real image → fill title/text → "Опубликовать" → confirm a success toast, the modal closes, and (after reloading the feed) the new post is visible for real — not just in the current React state.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/feed/CreatePostModal.tsx frontend/src/components/CreatePostForm.tsx
git commit -m "feat(feed): collapse composer form to one step, add channel branch"
```

---

### Task 5: Consolidate to 2 commits, deploy, full live regression

**Files:** none (git history rewrite + verification only).

**Interfaces:** none — this task consumes the finished feature end-to-end.

- [ ] **Step 1: Verify full typecheck one more time**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Consolidate the 5 task commits into the 2 commits the spec requires**

`9fc2b5f` (the spec-doc commit) is the exact HEAD this plan started from — every commit Tasks 1-4 made sits on top of it. Confirm before proceeding:

```bash
git log --oneline -8
```

Expected: `9fc2b5f docs: spec — feed composer «Создать» menu with type+source selection` appears, with Task 1-4's commits directly above it and nothing from any other work in between. If anything else landed on `neeklo` in between (from a different session), stop and re-derive the correct base commit instead of using `9fc2b5f` blindly. Otherwise:

```bash
git reset --soft 9fc2b5f
```

This unstages nothing destructively — all 5 tasks' changes are now staged together as uncommitted working-tree changes (verify with `git status` — you should see all the files from Tasks 1-4 listed as staged/modified, and `git log --oneline -1` should show `9fc2b5f` at HEAD). Now split into exactly 2 commits matching the spec:

```bash
git add frontend/src/lib/hooks/useHoverDropdown.ts \
        frontend/src/components/layout/UserMenu.tsx \
        frontend/src/components/feed/CreatePostMenu.tsx \
        frontend/src/routes/feed.tsx \
        frontend/src/components/feed/CreatePostModal.tsx \
        frontend/src/components/CreatePostForm.tsx
git commit -m "$(cat <<'EOF'
feat(feed): redesign composer trigger — Создать menu with type+source selection

Replaces the always-open composer row with a minimal «Создать» button
that reveals type (Пост/Видео), then — only for channel owners — source
(профиль/канал), reusing today's channel-ownership and channel→feed
duplication mechanisms. The composer form collapses from its old
photos/details wizard into one screen matching the chosen type/source.
EOF
)"
```

```bash
git add frontend/src/components/ads/wizard/ImageUploadGrid.tsx \
        frontend/src/components/reviews/VideoUploadField.tsx
git commit -m "$(cat <<'EOF'
fix(feed): auto-open file picker when composer opens

Restores the auto-open-OS-file-picker behavior that was dropped as an
unintended side effect of today's earlier addPost fix (d6b7469) — now
scoped to the new composer's initial mount instead of a removed
camera-icon click handler.
EOF
)"
```

Verify the result:

```bash
git log --oneline -3
git status
```

Expected: exactly 2 new commits on top of `BASE`, clean working tree, `git diff BASE HEAD --stat` shows exactly the 8 files listed above and no others.

- [ ] **Step 3: Push and deploy**

```bash
git push origin neeklo
```

Then SSH-deploy per the project's standing process: `ssh root@31.207.75.124 'cd /var/www/modelizmclub-neeklo && git pull origin neeklo && bash deploy/scripts/deploy-neeklo-frontend.sh'`.

- [ ] **Step 4: Live-verify on the neeklo stand — desktop**

At a ≥1024px viewport:

- Hover/click "Создать" in the feed composer — menu opens with "Пост"/"Видео".
- If the logged-in test account owns a channel: each of "Пост"/"Видео" is a submenu revealing "От своего профиля"/"От канала «Имя»" on hover. If it does not own a channel: both are plain items, no submenu, clicking either opens the form directly.
- Selecting "Пост" opens the form and the OS file picker auto-opens within ~150ms.
- Publish a real post from profile with a real photo: confirm success toast, modal closes, and the post is visible in the feed **after a full page reload** — not only in the current session's React state.
- If a channel is available: publish a real post from the channel with a real photo: confirm it appears in the channel's own post list, and (after reload) also appears in the main feed under the «Каналы» category.
- Publish at least one real post with "Видео" (profile path) with a real video file: same reload-survives check.
- `UserMenu` regression: hover-open/close, Escape, click-outside, no flicker on stationary hover — all still work exactly as before this plan touched it.

- [ ] **Step 5: Live-verify on the neeklo stand — mobile 360/390/430**

At each of 360px, 390px, and 430px width:

- Tap "Создать" — a bottom sheet opens (not a desktop-style dropdown), no layout jump on the page behind it.
- Sheet shows 2 items (no channel) or 4 items (channel owner), correctly labeled.
- Tapping a row closes the sheet and opens the composer form, which is a mobile-appropriate full/near-full-height sheet (via the existing `CreatePostModal`), not a cramped desktop-sized window.
- The OS file picker auto-opens on the form's mount here too.

- [ ] **Step 6: Fix any issues found live, redeploy, and re-verify**

If live verification surfaces a bug, fix it, commit (as an additional commit on top of the 2 above — do not amend), redeploy (repeat Step 3), and re-run the specific checklist item(s) that failed until they pass.
