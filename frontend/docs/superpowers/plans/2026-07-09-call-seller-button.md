# Call Seller Button (click-to-reveal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Позвонить продавцу" button next to "Написать продавцу" on the ad detail page. The seller's phone is never present in the initial page payload — it's fetched via a dedicated reveal call only on click, then shown as text with a `tel:` link, cached in-memory for the session.

**Architecture:** A new `revealedPhones: Record<AdId, string>` store slice (mirrors the existing `dialogAdRefs`/`pendingDialogMessages` pattern) caches a revealed number. `AdActionPanel` gains a presentational three-state button (idle/loading/revealed); the auth-gate + API call + store dispatch lives in `ads.$id.tsx`, mirroring `writeToSeller`. Demo and real modes both go through one `revealSellerPhone(adId)` function that branches on `isDemoMode()` internally.

**Tech Stack:** React 18 + TypeScript strict, existing store (`lib/store.ts`), existing API demo/real branching pattern (`lib/api/listings.ts`), `lucide-react`, `components/ui/button.tsx`.

## Global Constraints

- Frontend-only; no backend code changes. The real reveal endpoint doesn't exist yet — document its contract in `backend-endpoints-needed.md`, don't implement it.
- The phone must not appear anywhere in the initial SSR HTML or `GET /listings/{id}` response — only via the dedicated reveal call after a click.
- Mobile-first: verify all three button states (idle/loading/revealed) at 375px before desktop.
- `npx tsc --noEmit` clean after every task.
- No commit/push without explicit user permission.
- Reveal requires auth, same gate as "Написать продавцу" (`!getToken() && !isDemoMode()` → toast + redirect to `/login`).
- Cache is in-memory (store), not localStorage — survives SPA navigation, resets on hard reload.
- Full anti-scraping defense (bot detection, rate limiting, domain-bound tokens) is out of scope — document only, don't build.
- `SellerCard.tsx` is not touched — the button only appears in `AdActionPanel`.

---

### Task 1: Data model — `AdSeller.phone` + demo data

**Files:**
- Modify: `frontend/src/lib/mock.ts:71-79` (`AdSeller` interface)
- Modify: `frontend/src/lib/mock.ts:335-338` (`makeSeller` function)

**Interfaces:**
- Produces: `AdSeller.phone?: string` — later tasks (API layer, Task 2) read `ad.seller.phone` via the demo lookup path.

- [ ] **Step 1: Add `phone` to the `AdSeller` interface**

In `frontend/src/lib/mock.ts`, change:
```ts
export interface AdSeller {
  id: ID;
  numericId?: number;
  name: string;
  avatar: string;
  rating: number;
  deals: number;
  since: string;
}
```
to:
```ts
export interface AdSeller {
  id: ID;
  numericId?: number;
  name: string;
  avatar: string;
  rating: number;
  deals: number;
  since: string;
  /** Demo-only for now — no backend field exists yet (see
   *  backend-endpoints-needed.md #22). Populated by makeSeller() below;
   *  undefined for any seller not in SELLER_PHONES. */
  phone?: string;
}
```

- [ ] **Step 2: Add a deterministic per-seller demo phone map and wire it into `makeSeller`**

In `frontend/src/lib/mock.ts`, immediately before the `makeSeller` function (currently at line 335), add:
```ts
const SELLER_PHONES: Record<string, string> = {
  u1: "+7 901 234-56-01",
  u2: "+7 901 234-56-02",
  u3: "+7 901 234-56-03",
  u4: "+7 901 234-56-04",
  u5: "+7 901 234-56-05",
  u6: "+7 901 234-56-06",
  u7: "+7 901 234-56-07",
  u8: "+7 901 234-56-08",
};
```
Then change `makeSeller` from:
```ts
const makeSeller = (uid: ID, rating: number, deals: number, since: string): AdSeller => {
  const u = users.find((x) => x.id === uid) ?? users[0];
  return { id: u.id, numericId: u.numericId, name: u.name, avatar: u.avatar, rating, deals, since };
};
```
to:
```ts
const makeSeller = (uid: ID, rating: number, deals: number, since: string): AdSeller => {
  const u = users.find((x) => x.id === uid) ?? users[0];
  return { id: u.id, numericId: u.numericId, name: u.name, avatar: u.avatar, rating, deals, since, phone: SELLER_PHONES[u.id] };
};
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify via code — confirm every demo ad's seller resolves a phone**

Run: `cd frontend && node -e "
const ids = ['u1','u2','u3','u4','u5','u6','u7','u8'];
const map = require('./src/lib/mock.ts');
" 2>&1 || true`
(This inline node check won't work directly against a `.ts` file without a loader — instead, verify by inspection: confirm every `authorId`/`sellerStats` entry in `rawAds` (search `grep -n "authorId:" frontend/src/lib/mock.ts`) uses one of `u1`-`u8`, which are exactly the keys populated in `SELLER_PHONES`. Run:)

Run: `grep -o 'authorId: "[^"]*"' frontend/src/lib/mock.ts | sort -u`
Expected: only `u1` through `u8` appear (matching `SELLER_PHONES`' keys) — if any other id appears, add it to `SELLER_PHONES` too before proceeding.

- [ ] **Step 5: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/lib/mock.ts
git commit -m "feat(call-seller): add demo phone numbers to AdSeller"
```

---

### Task 2: Store slice + `revealSellerPhone` API function

**Files:**
- Modify: `frontend/src/lib/store.ts` (add `revealedPhones` slice, mirroring `dialogAdRefs`)
- Modify: `frontend/src/lib/api/listings.ts` (add `revealSellerPhone`)

**Interfaces:**
- Consumes: `AdSeller.phone` (Task 1), `demoListing(uuid)` and `api<T>()` (existing, both already imported in `listings.ts`), `isDemoMode()` (existing).
- Produces: `actions.setRevealedPhone(adId: ID, phone: string): void`, store field `revealedPhones: Record<ID, string>` (Task 4 reads `useStore((s) => s.revealedPhones[id])`). `revealSellerPhone(adId: string): Promise<string>` exported from `frontend/src/lib/api/listings.ts` (Task 4 imports and calls it).

- [ ] **Step 1: Add the `revealedPhones` store slice**

In `frontend/src/lib/store.ts`, in the `AppState` interface, add after the `pendingDialogMessages` field (currently at line 78):
```ts
  /** Revealed seller phone numbers, keyed by ad id. In-memory only — not
   *  persisted to localStorage. Resets on hard reload by design: a fresh
   *  page load should never have the number already available, matching
   *  the click-to-reveal anti-scraping intent (see backend-endpoints-needed.md #22). */
  revealedPhones: Record<ID, string>;
```
In `createInitialState()`, add after `pendingDialogMessages: {},` (currently at line 114):
```ts
    revealedPhones: {},
```
In the `Action` union, change the last entry (currently `| { type: "CLEAR_PENDING_MESSAGE"; dialogId: ID };` at line 182) from a semicolon-terminated final entry to a piped entry, and add the new action type terminated with a semicolon:
```ts
  | { type: "CLEAR_PENDING_MESSAGE"; dialogId: ID }
  | { type: "SET_REVEALED_PHONE"; adId: ID; phone: string };
```
In the reducer, add a new case after the `CLEAR_PENDING_MESSAGE` case (currently ending around line 460, right before `default:`):
```ts
    case "SET_REVEALED_PHONE":
      return { ...s, revealedPhones: { ...s.revealedPhones, [a.adId]: a.phone } };
```
In the `actions` object, add after `clearPendingMessage` (currently at line 514):
```ts
  setRevealedPhone: (adId: ID, phone: string) => dispatch({ type: "SET_REVEALED_PHONE", adId, phone }),
```

- [ ] **Step 2: Add `revealSellerPhone` to the API layer**

In `frontend/src/lib/api/listings.ts`, add this function right after `fetchListing` (currently ending at line 197):
```ts
export async function revealSellerPhone(adId: string): Promise<string> {
  if (isDemoMode()) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const ad = demoListing(adId);
    if (!ad?.seller?.phone) throw new Error("no phone");
    return ad.seller.phone;
  }
  const res = await api<{ data: { phone: string } }>(`/listings/${adId}/reveal-phone`, { method: "POST" });
  return res.data.phone;
}
```
No new imports needed — `demoListing`, `api`, and `isDemoMode` are all already imported at the top of this file (confirmed: `demoListing` at the existing `@/lib/demo-data` import line, `api` from `./client`, `isDemoMode` from `@/lib/demo-mode`).

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify the demo branch matches the established pattern**

Run: `grep -n -A 6 "export async function revealSellerPhone" frontend/src/lib/api/listings.ts`
Expected output shows the demo branch calling `demoListing(adId)` — the exact same lookup helper `fetchListing`'s own demo branch uses (confirm with `grep -n -A 4 "export async function fetchListing" frontend/src/lib/api/listings.ts`, comparing the two `demoListing(...)` call sites). This confirms Task 2 didn't invent a second, divergent demo-lookup path. The actual returned-phone-value check happens live in Task 4 Step 5, once the button exists to trigger it through.

- [ ] **Step 5: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/lib/store.ts frontend/src/lib/api/listings.ts
git commit -m "feat(call-seller): add revealedPhones store slice + revealSellerPhone API"
```

---

### Task 3: `AdActionPanel` three-state button

**Files:**
- Modify: `frontend/src/components/ads/AdActionPanel.tsx`

**Interfaces:**
- Consumes: nothing from Task 1/2 directly (this is a presentational component — it receives state via props, doesn't call the API or read the store itself).
- Produces: `AdActionPanelProps` gains `phoneRevealState: "idle" | "loading" | "revealed"`, `revealedPhone: string | null`, `onRevealPhone: () => void`. Task 4 passes these three props when rendering `<AdActionPanel>`.

- [ ] **Step 1: Add the new props and icons**

In `frontend/src/components/ads/AdActionPanel.tsx`, change the icon import (line 1) from:
```ts
import { MapPin, Eye, Heart, Clock, MessageSquare, Bookmark, Share2, ShieldCheck, Tag } from "lucide-react";
```
to:
```ts
import { MapPin, Eye, Heart, Clock, MessageSquare, Bookmark, Share2, ShieldCheck, Tag, Phone, RefreshCw } from "lucide-react";
```
Change the `AdActionPanelProps` interface (currently lines 17-24) from:
```ts
interface AdActionPanelProps {
  ad: Ad;
  saved: boolean;
  onWrite: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  className?: string;
}
```
to:
```ts
interface AdActionPanelProps {
  ad: Ad;
  saved: boolean;
  onWrite: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  phoneRevealState: "idle" | "loading" | "revealed";
  revealedPhone: string | null;
  onRevealPhone: () => void;
  className?: string;
}
```
Update the function signature (currently line 26) from:
```ts
export function AdActionPanel({ ad, saved, onWrite, onToggleSave, onShare, className }: AdActionPanelProps) {
```
to:
```ts
export function AdActionPanel({ ad, saved, onWrite, onToggleSave, onShare, phoneRevealState, revealedPhone, onRevealPhone, className }: AdActionPanelProps) {
```

- [ ] **Step 2: Insert the call button row**

In the same file, the current CTA block (lines 98-119) reads:
```tsx
      <div className="flex flex-col gap-[8px]">
        <Button onClick={onWrite} size="lg" className="w-full rounded-[var(--r-button)]">
          <MessageSquare size={16} /> Написать продавцу
        </Button>
        <div className="grid grid-cols-2 gap-[8px]">
          <Button
            variant="outline"
            onClick={onToggleSave}
            aria-pressed={saved}
            className={cn(
              "rounded-[var(--r-button)]",
              saved && "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]",
            )}
          >
            <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
            {saved ? "В избранном" : "В избранное"}
          </Button>
          <Button variant="outline" onClick={onShare} className="rounded-[var(--r-button)]">
            <Share2 size={14} /> Поделиться
          </Button>
        </div>
      </div>
```
Change it to insert a new full-width row directly below "Написать продавцу" (stacked, not side-by-side — at 360-430px two Cyrillic-label buttons side-by-side would be cramped):
```tsx
      <div className="flex flex-col gap-[8px]">
        <Button onClick={onWrite} size="lg" className="w-full rounded-[var(--r-button)]">
          <MessageSquare size={16} /> Написать продавцу
        </Button>
        {phoneRevealState === "revealed" && revealedPhone ? (
          <Button asChild variant="outline" size="lg" className="w-full rounded-[var(--r-button)]">
            <a href={`tel:${revealedPhone.replace(/\s|-/g, "")}`}>
              <Phone size={16} /> {revealedPhone}
            </a>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            onClick={onRevealPhone}
            disabled={phoneRevealState === "loading"}
            className="w-full rounded-[var(--r-button)]"
          >
            {phoneRevealState === "loading" ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> Загрузка…
              </>
            ) : (
              <>
                <Phone size={16} /> Позвонить продавцу
              </>
            )}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-[8px]">
          <Button
            variant="outline"
            onClick={onToggleSave}
            aria-pressed={saved}
            className={cn(
              "rounded-[var(--r-button)]",
              saved && "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]",
            )}
          >
            <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
            {saved ? "В избранном" : "В избранное"}
          </Button>
          <Button variant="outline" onClick={onShare} className="rounded-[var(--r-button)]">
            <Share2 size={14} /> Поделиться
          </Button>
        </div>
      </div>
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: **fails** at this point — `AdActionPanel` is used in `frontend/src/routes/ads.$id.tsx` (Task 4, not yet done) without the three new required props. This is expected; do not treat it as a Task 3 failure.
Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -v "ads.\$id.tsx"`
Expected: no errors outside of `ads.$id.tsx` — confirms `AdActionPanel.tsx` itself is internally type-correct; the only errors should be the call-site prop mismatch in `ads.$id.tsx`, which Task 4 resolves.

- [ ] **Step 4: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/components/ads/AdActionPanel.tsx
git commit -m "feat(call-seller): add three-state call button to AdActionPanel"
```

---

### Task 4: Wire into `ads.$id.tsx` (own review — race-condition scrutiny required)

**Files:**
- Modify: `frontend/src/routes/ads.$id.tsx`

**Interfaces:**
- Consumes: `revealSellerPhone` (Task 2, from `@/lib/api/listings`), `actions.setRevealedPhone` (Task 2, from `@/lib/store`), the three new `AdActionPanel` props (Task 3).

**Why this task gets its own review pass:** a prior feature (Delivery Flow) had a real, live-tested-and-confirmed race condition in a structurally similar pattern in this exact file — an async action fired from a click handler here, writing into the shared store, while unrelated effects elsewhere in the app could read/overwrite that same store slice out of order. This task's job is smaller in scope (no other component reads `revealedPhones` today, unlike `pendingDialogMessages` which `messenger.tsx` also touches), but the reviewer must still explicitly reason through and confirm, not assume:
1. **Double-click / re-entrancy safety:** can clicking "Позвонить продавцу" multiple times in quick succession (before the first request resolves) fire more than one `revealSellerPhone` call?
2. **Stale-closure-on-navigation safety:** if the user clicks reveal on ad A, then navigates to ad B (same route pattern `/ads/$id`, component likely stays mounted with updated `id` param rather than remounting) before the promise resolves — does the resolved promise's `actions.setRevealedPhone(id, phone)` call use the `id` value from *when the click happened* (correct — writes into ad A's slot, harmless even though the user has moved on) or could it somehow write into the wrong ad's slot? Confirm which, and confirm it's not a data-corruption risk either way.

- [ ] **Step 1: Add imports**

In `frontend/src/routes/ads.$id.tsx`, change line 5 from:
```ts
import { fetchListing, fetchListings, addFavoriteListing, removeFavoriteListing } from "@/lib/api/listings";
```
to:
```ts
import { fetchListing, fetchListings, addFavoriteListing, removeFavoriteListing, revealSellerPhone } from "@/lib/api/listings";
```

- [ ] **Step 2: Add reveal state and handler**

In the same file, right after the `availableDeliveryMethods` block (currently lines 75-78, ending with `);`), add:
```ts
  const revealedPhone = useStore((s) => s.revealedPhones[id]) ?? null;
  const [phoneLoading, setPhoneLoading] = useState(false);

  const revealPhone = async () => {
    if (!getToken() && !isDemoMode()) {
      toast.info("Войдите, чтобы посмотреть номер");
      navigate({ to: "/login" });
      return;
    }
    if (revealedPhone || phoneLoading) return;
    setPhoneLoading(true);
    try {
      const phone = await revealSellerPhone(id);
      actions.setRevealedPhone(id, phone);
    } catch {
      toast.error("Не удалось получить номер");
    } finally {
      setPhoneLoading(false);
    }
  };
```
Note the `if (revealedPhone || phoneLoading) return;` guard — this directly answers review question 1 above (re-entrancy): a second click while `phoneLoading` is already `true` returns immediately without firing a second `revealSellerPhone` call, in addition to the button itself being `disabled` during loading (Task 3's `disabled={phoneRevealState === "loading"}`) which prevents the click from even registering under normal use — this guard is the defense-in-depth backstop for any path that could bypass the disabled UI state (e.g. a queued double-tap event).

- [ ] **Step 3: Pass the new props to `AdActionPanel`**

Change the `<AdActionPanel>` usage (currently lines 241-247) from:
```tsx
            <AdActionPanel
              ad={ad}
              saved={saved}
              onWrite={writeToSeller}
              onToggleSave={toggleSave}
              onShare={share}
            />
```
to:
```tsx
            <AdActionPanel
              ad={ad}
              saved={saved}
              onWrite={writeToSeller}
              onToggleSave={toggleSave}
              onShare={share}
              phoneRevealState={phoneLoading ? "loading" : revealedPhone ? "revealed" : "idle"}
              revealedPhone={revealedPhone}
              onRevealPhone={() => void revealPhone()}
            />
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean — no errors anywhere now, including the `ads.$id.tsx` call-site error Task 3 expected to see.

- [ ] **Step 5: Manual verification — mobile-first, all three states, demo mode**

At 375px viewport:
1. Navigate to `http://localhost:8080/ads/a2` (demo listing, seller `u2`, expected phone `+7 901 234-56-02` per Task 1's `SELLER_PHONES` map).
2. Confirm **idle** state: button reads "Позвонить продавцу" with a phone icon, positioned directly below "Написать продавцу", full width.
3. Click it. Confirm **loading** state appears immediately: button disabled, spinner + "Загрузка…".
4. Wait ~500ms. Confirm **revealed** state: button now shows the phone text `+7 901 234-56-02`, wrapped in a link — inspect the DOM to confirm `href="tel:+79012345602"` (no spaces/dashes).
5. Confirm the initial `GET`/page load never contained the phone: reload the page (fresh load), inspect the DOM/network before clicking — the phone must not appear anywhere until the button is clicked again (this also re-confirms the in-memory-only cache design: reload resets to idle).
6. Click reveal again post-reload, confirm it re-fetches and re-reveals correctly (no stale/broken state from the previous page-load's now-discarded store).
7. Navigate to a different ad (e.g. `/ads/a1`) and back to `/ads/a2` via in-app links (not a hard reload) — confirm the phone is still shown revealed (session cache working within the SPA).
8. Repeat steps 1-4 at desktop width (≥1280px).

- [ ] **Step 6: Manual verification — auth gate**

If feasible in this environment (demo mode may make this hard to test directly since demo bypasses the token check) — confirm by code inspection that the guard `if (!getToken() && !isDemoMode())` in `revealPhone` matches exactly the same condition already used and proven in `writeToSeller` and `toggleSave` in this same file. If a non-demo/guest state is reachable in this session (e.g. by temporarily forcing `isDemoMode()` off as done in prior rounds this session), click reveal as a guest and confirm redirect to `/login` with the toast "Войдите, чтобы посмотреть номер".

- [ ] **Step 7: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/routes/ads.\$id.tsx
git commit -m "feat(call-seller): wire click-to-reveal phone into ad detail page"
```

---

### Task 5: Document the deferred backend work

**Files:**
- Modify: `frontend/docs/backend-endpoints-needed.md`

**Interfaces:** None (documentation only).

- [ ] **Step 1: Append entry #22**

Add to the end of `frontend/docs/backend-endpoints-needed.md`:
```markdown
## 22. Call Seller Button — click-to-reveal номер продавца (endpoint + анти-скрапинг отложены)

**Контекст:** реализована MVP-версия «Позвонить продавцу» — номер не
присутствует в исходном HTML/JSON объявления, раскрывается только по
клику через отдельный запрос, кэшируется в памяти на сессию (не
localStorage). Ни `ListingResource`, ни `UserCompactResource`, ни
`UserResource` не содержат поля телефона нигде в текущем OpenAPI-контракте
— номер для звонка не существует в модели данных вообще, не только
скрыт.

**Нужен новый endpoint:**
`POST /listings/{id}/reveal-phone` — требует авторизации, возвращает
`{ "data": { "phone": "+7..." } }`. Это новая backend-задача (поле +
логика), а не проброс существующего поля.

**Анти-скрапинг механизм (НЕ реализован, только описание желаемого):**
- Сессионный токен на клиенте, привязанный к домену/referrer.
- Серверная валидация токена перед выдачей реального номера.
- Rate limiting на сессию/IP.
- Эвристики бот-детекции (паттерны кликов, скорость запросов, user-agent).
- Возможность отдать фейковый/decoy номер при подозрении на бота.

Это отдельный, некороткий backend-проект (генерация/валидация токенов,
инфраструктура rate limiting, бот-эвристики) и принципиально не решается
разово — постоянная гонка вооружений с скрейперами, а не одноразовая
задача. Без этого механизма MVP-эндпоинт защищён только тем, что номер
не встроен в первоначальный payload — скрипт, повторяющий
клик-и-запрос, всё ещё может его вытащить. Это осознанный, явно
зафиксированный компромисс упрощённого варианта, выбранного в этом раунде
(вместо полной подмены номера через партнёра телефонии — то была
альтернатива Б, отдельная гораздо более крупная интеграция, не в scope).

**Demo-fallback:** полностью работает — `revealSellerPhone` в
`frontend/src/lib/api/listings.ts` возвращает демо-номер из
`AdSeller.phone` (см. `SELLER_PHONES` в `frontend/src/lib/mock.ts`) с
искусственной задержкой, без реального сетевого запроса.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/docs/backend-endpoints-needed.md
git commit -m "docs(call-seller): document deferred reveal-phone endpoint + anti-scraping"
```

---

### Task 6: Final full verification

**Files:** None (verification only).

- [ ] **Step 1: Full typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean, no errors.

- [ ] **Step 2: End-to-end demo click-through, mobile 375px then desktop, fresh reload**

On a freshly reloaded page (not relying on HMR state), repeat Task 4 Step 5's full sequence once more at both 375px and desktop (≥1280px):
- Idle → loading → revealed states all correctly rendered and styled.
- `tel:` link has the correct sanitized `href` (no spaces/dashes).
- Phone absent from the page until the first click, on every fresh load.
- SPA in-app navigation away and back preserves the revealed state; hard reload resets it.
- No new console errors introduced (compare against console output from before this feature).

- [ ] **Step 3: Report results to the user, do not commit further without explicit permission**

This plan's individual task commits (Tasks 1-5) are the working history; no additional commit is needed for verification-only Task 6 unless issues were found and fixed, in which case commit those fixes with a clear message and re-run Steps 1-2.
