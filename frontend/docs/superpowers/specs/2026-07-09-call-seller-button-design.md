# Call Seller Button (click-to-reveal) — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to turn this spec into an implementation plan, then superpowers:subagent-driven-development or superpowers:executing-plans to build it.

**Goal:** Add a "Позвонить продавцу" button next to "Написать продавцу" on the ad detail page. The seller's phone number is never present in the initial page payload (SSR or API response) — it's fetched via a dedicated reveal request only when the button is clicked, then shown as text with a `tel:` link.

**Architecture:** A new `revealedPhones: Record<AdId, string>` store slice (in-memory only, mirrors the existing `dialogAdRefs`/`pendingDialogMessages` pattern) caches a revealed number for the current app session. `AdActionPanel` gains a presentational three-state button (idle/loading/revealed); the actual auth-gate + API call + store dispatch lives in `ads.$id.tsx`, mirroring the existing `writeToSeller` function. Demo and real modes both go through one `revealSellerPhone(adId)` API function that branches on `isDemoMode()` internally, exactly like every other API function in this codebase.

**Tech Stack:** React 18 + TypeScript strict, existing store (`lib/store.ts`), existing API-layer demo/real branching pattern (`lib/api/listings.ts`), `lucide-react` icons, `components/ui/button.tsx`.

## Global Constraints

- Frontend-only; no backend code changes. The real reveal endpoint doesn't exist yet — its contract goes in `backend-endpoints-needed.md`, not implemented.
- The phone number must not appear anywhere in the initial SSR HTML or the ad's own API response (`GET /listings/{id}`) — it only ever arrives via the dedicated reveal call, after a user click.
- Mobile-first: button and reveal states designed and verified at 360-430px before desktop.
- `npx tsc --noEmit` clean after every change.
- No commit/push without explicit user permission.
- Full anti-scraping defense (session-bound domain/referrer-checked tokens, server-side validation, rate limiting, bot-detection heuristics, fake-number-on-suspicion) is explicitly **out of scope** — documented in detail as a backend follow-up, not built. This is a real, non-trivial backend project and never a one-time fix (an ongoing arms race), not something the frontend can solve alone.
- Reveal requires auth, same gate as "Написать продавцу" (`!getToken() && !isDemoMode()` → toast + redirect to `/login`).
- Cache is in-memory (store), not localStorage — survives SPA navigation within the session, resets on hard reload. Deliberate: reinforces that a fresh page load never has the number pre-embedded.

---

## Components

### 1. `frontend/src/lib/mock.ts` — `AdSeller` type + demo data

Add an optional `phone` field:
```ts
export interface AdSeller {
  id: ID;
  numericId?: number;
  name: string;
  avatar: string;
  rating: number;
  deals: number;
  since: string;
  phone?: string;
}
```
Populate `phone` on existing demo sellers with realistic RU-format numbers (e.g. `+7 999 123-45-67`), matching the mask format already established by `PhoneInput` (`components/ui/phone-input.tsx`) elsewhere in the app.

### 2. `frontend/src/lib/api/listings.ts` — `revealSellerPhone`

```ts
export async function revealSellerPhone(adId: string): Promise<string> {
  if (isDemoMode()) {
    await new Promise((resolve) => setTimeout(resolve, 500)); // simulate round-trip
    const ad = demoListing(adId); // same helper fetchListing's demo branch already uses (listings.ts:191)
    if (!ad?.seller?.phone) throw new Error("no phone");
    return ad.seller.phone;
  }
  const res = await api<{ data: { phone: string } }>(`/listings/${adId}/reveal-phone`, { method: "POST" });
  return res.data.phone;
}
```
`demoListing` is already imported in `listings.ts` (from `@/lib/demo-data`, alongside `demoListings`/`demoListingsFiltered`/etc. — see the file's existing import line); `api` is the existing client wrapper from `./client`, same one every other function in this file uses (e.g. `createListing`, `fetchListing`) — no new imports needed for this piece.

`ApiListing`/`mapListing` are **not** changed — the ad's own `GET /listings/{id}` response and its mapping stay exactly as they are today (this is what guarantees the phone never rides along in the initial payload). `mapListing`'s `seller` construction gets no `phone` field; it stays `undefined` until explicitly revealed.

### 3. `frontend/src/lib/store.ts` — `revealedPhones` slice

Mirrors `dialogAdRefs`/`SET_DIALOG_AD` exactly:
- `AppState.revealedPhones: Record<ID, string>` (keyed by ad id)
- `createInitialState()`: `revealedPhones: {}`
- New `Action`: `{ type: "SET_REVEALED_PHONE"; adId: ID; phone: string }`
- Reducer case: `case "SET_REVEALED_PHONE": return { ...s, revealedPhones: { ...s.revealedPhones, [a.adId]: a.phone } };`
- `actions.setRevealedPhone(adId: ID, phone: string) => dispatch({ type: "SET_REVEALED_PHONE", adId, phone })`

No persistence, no `localStorage` — matches everything in this store except `favoriteAdIds`.

### 4. `frontend/src/components/ads/AdActionPanel.tsx` — button states

New props:
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

New row inserted directly below the existing "Написать продавцу" button, above the save/share grid (full-width, stacked — not side-by-side with "Написать", to avoid cramped Cyrillic labels at 360-430px):

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
        <><RefreshCw size={16} className="animate-spin" /> Загрузка…</>
      ) : (
        <><Phone size={16} /> Позвонить продавцу</>
      )}
    </Button>
  )}
  <div className="grid grid-cols-2 gap-[8px]">
    {/* existing save/share buttons, unchanged */}
  </div>
</div>
```
`Phone` and `RefreshCw` added to the existing `lucide-react` import line.

### 5. `frontend/src/routes/ads.$id.tsx` — wiring

```ts
const revealedPhone = useStore((s) => s.revealedPhones[id]) ?? null;
const [phoneLoading, setPhoneLoading] = useState(false);

const revealPhone = async () => {
  if (!getToken() && !isDemoMode()) {
    toast.info("Войдите, чтобы посмотреть номер");
    navigate({ to: "/login" });
    return;
  }
  if (revealedPhone) return; // already cached this session
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
Pass to `AdActionPanel`:
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
Import `revealSellerPhone` from `@/lib/api/listings`.

`SellerCard.tsx` is **not** touched — the button only appears in `AdActionPanel`, per your explicit scoping decision.

---

## Data Flow

1. Buyer opens `/ads/$id` — `GET /listings/{id}` response (real mode) or demo lookup carries no phone field at all; page renders normally, "Позвонить продавцу" shows in idle state.
2. Buyer clicks it → auth-gate (redirect to `/login` if guest) → button flips to loading.
3. `revealSellerPhone(id)` resolves (demo: delayed mock lookup; real: `POST /listings/{id}/reveal-phone`) → `actions.setRevealedPhone(id, phone)` → button flips to revealed, showing the number as a `tel:` link.
4. Navigating away and back to the same ad within the session reuses the cached number (no second API call) — `revealedPhone` selector reads straight from the store.
5. Hard reload clears the cache — the button starts idle again, exactly as on first visit.

## Demo-mode verification (this session)

Fully clickable end-to-end:
1. Open any demo ad detail page at 375px.
2. Confirm the page's initial rendered HTML/state has no phone number anywhere (check via DOM inspection, not just visually).
3. Click "Позвонить продавцу" → confirm loading state (spinner + "Загрузка…") appears briefly.
4. Confirm it resolves to the seller's demo phone number, rendered as text + `tel:` link.
5. Navigate to another ad and back → confirm the number is still shown (no reload of loading state).
6. Reload the page → confirm it resets to idle.
7. Log out / simulate guest (if feasible in demo mode) → confirm clicking redirects to `/login` with a toast, matching the "Написать" gate's existing behavior.
8. Repeat 1-4 at desktop width.

## Backend documentation (new entry, #22)

New numbered entry in `backend-endpoints-needed.md`:
- `POST /listings/{id}/reveal-phone` — auth required, returns `{ "data": { "phone": "+7..." } }`. No such endpoint or seller-phone field exists anywhere in the current OpenAPI spec (confirmed: `ListingResource`, `UserCompactResource`, `UserResource` all lack a phone field) — this is new backend work, not just wiring an existing field.
- Full anti-scraping mechanism description (your wording, preserved): session-bound token tied to domain/referrer, server-side validation before returning the real number, rate limiting per session/IP, bot-detection heuristics, ability to return a fake/decoy number to requests flagged as suspicious. Explicitly flagged as an ongoing arms race, not a one-time implementation — significant backend scope (token generation/validation, rate limiting infra, bot heuristics), not started now.
- Note: without any of the above, the MVP reveal endpoint is only as protected as "not embedded in the initial payload" — a determined scraper could still script the click-and-fetch sequence. This is the accepted, explicitly-scoped tradeoff of the "упрощённый" tier chosen for this round.

## Out of Scope (explicit)

- Real backend `reveal-phone` endpoint implementation.
- Any bot-detection, rate-limiting, or token-validation mechanism.
- Number masking/proxying via a telephony partner (the original "Вариант B" from the initial framing — a separate, much larger integration).
- `SellerCard.tsx` changes.
- Persisting the revealed-phone cache across page reloads (localStorage).
