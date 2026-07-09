# Delivery Flow — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to turn this spec into an implementation plan, then superpowers:subagent-driven-development or superpowers:executing-plans to build it.

**Goal:** Seller picks real delivery providers (СДЭК, Яндекс Доставка) when creating a listing; buyer sees availability on the ad page and picks a preferred method (or self-pickup) when contacting the seller, communicated as the opening chat message.

**Architecture:** A shared `DELIVERY_METHODS` constant (2 real providers) replaces the duplicated 5-item fake lists in the wizard and catalog filters. A new `DeliveryChoiceSheet` component (mobile: vaul `Drawer`; desktop: `Dialog`) intercepts the existing "Написать" action on the ad detail page when the listing has delivery methods, then falls through to the existing `createConversation` → `sendMessage` calls — both already demo/real-branching internally, so the new UI code needs no demo-mode awareness of its own.

**Tech Stack:** React 18 + TypeScript, existing `components/ui/drawer.tsx` (vaul) and shadcn-style `Dialog`, existing `lib/api/chat.ts` (`createConversation`, `sendMessage`), existing `lib/demo-mode.ts`.

## Global Constraints

- Frontend-only; no backend code changes. Any real backend gap gets documented in `frontend/docs/backend-endpoints-needed.md`, not implemented.
- Mobile-first: every UI piece designed and verified at 375px before desktop.
- `npx tsc --noEmit` clean after every task.
- No commit/push without explicit user permission.
- Delivery-choice message is **plain text**, not a specially-styled chip bubble (no new `Message` field — a chip UI would silently degrade to plain text after reload in real mode since the field wouldn't persist server-side; deferred as future polish).
- The picker only opens when `ad.delivery.length > 0`; when empty, `writeToSeller` behavior is unchanged (no sheet).
- Real-mode catalog filter query-wiring for delivery (`CatalogParams.deliveries` currently unused in `fetchListings`) is **out of scope** — pre-existing, unrelated gap, only get a doc clarification, not a fix.

---

## Components

### 1. `frontend/src/lib/config/deliveryMethods.ts` (new)

Single source of truth, replacing the duplicated arrays in `ads.new.tsx` (`DELIVERIES`) and `AdFilters.tsx` (`DELIVERIES`).

```ts
export interface DeliveryMethod {
  id: "cdek" | "yandex";
  label: string;
}

export const DELIVERY_METHODS: DeliveryMethod[] = [
  { id: "cdek", label: "СДЭК" },
  { id: "yandex", label: "Яндекс Доставка" },
];

export const SELF_PICKUP_LABEL = "Самовывоз / при встрече";
```

Labels (not ids) remain what's stored in `Ad.delivery: string[]` and sent as `deliveryMethods` to `createListing` — matches the existing wire format (`ApiListing.delivery_methods: string[]`, untyped free strings), so no backend/mapping change needed.

### 2. `ads.new.tsx` — wizard checkbox list

Replace the local `DELIVERIES` array and its usages with `DELIVERY_METHODS.map(m => m.label)`. No other changes to the step-2 rendering, `submit()`, or `CreateListingInput.deliveryMethods` wiring — purely swapping the source list from 5 items to 2.

### 3. `AdFilters.tsx` — catalog filter checkboxes

Same swap: local `DELIVERIES` → `DELIVERY_METHODS.map(m => m.label)`. Filtering logic (`toggle("deliveries", d)`, demo-mode `demoListingsFiltered` matching) is unchanged — it already works against whatever labels are in the list.

### 4. `frontend/src/components/ads/DeliveryChoiceSheet.tsx` (new)

Mirrors the existing `AdFiltersSheet`/`AdFiltersPanel` split — one shared `Body`, two presentational wrappers.

**Props:**
```ts
interface DeliveryChoiceSheetProps {
  open: boolean;
  onClose: () => void;
  methods: string[];       // ad.delivery, filtered to those matching DELIVERY_METHODS labels
  onConfirm: (choice: string | null) => void; // null = skipped, no method chosen
}
```

**Body content:** radio-style list — one row per method in `methods`, plus a trailing static "Самовывоз / при встрече" row (`SELF_PICKUP_LABEL`) always present. Single-select. Footer: "Продолжить" button (disabled until a selection is made) and a close (×) affordance that calls `onConfirm(null)` — skipping is always allowed, matching Avito's non-obligatory pattern.

**Mobile wrapper:** `Drawer`/`DrawerContent`/`DrawerTitle` from `components/ui/drawer.tsx` (the vaul-based primitive already used by `MobileHeader`'s "Меню" sheet) — chosen over the bespoke framer-motion sheet in `AdFilters.tsx` since it's the more reusable, less bespoke pattern for a new component.

**Desktop wrapper:** centered `Dialog`/`DialogContent` (shadcn-style, matching `DropdownMenu` and other existing UI-kit primitives).

Both wrappers render the same `Body`; the split is purely `hidden md:block` / `md:hidden` presentational, exactly like `AdFiltersPanel`/`AdFiltersSheet`.

### 5. `ads.$id.tsx` — `writeToSeller` interception

```ts
const [deliveryPickerOpen, setDeliveryPickerOpen] = useState(false);

const availableDeliveryMethods = useMemo(
  () => (ad?.delivery ?? []).filter((d) => DELIVERY_METHODS.some((m) => m.label === d)),
  [ad],
);

const writeToSeller = async () => {
  if (!getToken() && !isDemoMode()) { /* unchanged auth-gate */ }
  if (availableDeliveryMethods.length > 0) {
    setDeliveryPickerOpen(true);
    return;
  }
  await proceedToConversation(null);
};

const proceedToConversation = async (deliveryChoice: string | null) => {
  // existing sellerId/me checks unchanged
  const dialog = await createConversation(sellerId, me.id, ad.id);
  if (ad) actions.setDialogAd(dialog.id, { ...unchanged... });
  if (deliveryChoice) {
    await sendMessage(dialog.id, `📦 Способ получения: ${deliveryChoice}`);
  }
  navigate({ to: "/messenger", search: { chat: dialog.id } });
};
```

`DeliveryChoiceSheet`'s `onConfirm` calls `setDeliveryPickerOpen(false)` then `proceedToConversation(choice)`. Both `AdActionPanel`'s and `SellerCard`'s "Написать" buttons already call `writeToSeller` — no changes needed at their call sites.

When `ad.delivery` is empty (or contains only labels outside `DELIVERY_METHODS`, e.g. legacy demo data with old fake labels), `availableDeliveryMethods.length === 0` and behavior is 100% unchanged — straight to `proceedToConversation(null)`, no sheet, no extra message.

---

## Data Flow

1. Seller creates listing in wizard, ticks "СДЭК" and/or "Яндекс Доставка" → `deliveryMethods: string[]` sent to `createListing` (demo: stored in local demo listings; real: `POST /listings` `delivery_methods` field, unchanged existing wire contract).
2. Buyer opens `/ads/$id` → existing "Доставка" card shows the pills (unchanged rendering, `ad.delivery.map(...)`).
3. Buyer clicks "Написать" → if `availableDeliveryMethods.length > 0`, `DeliveryChoiceSheet` opens.
4. Buyer picks "СДЭК" (or skips) → `createConversation(sellerId, meId, adId)` runs exactly as today (demo: local dialog creation; real: `POST /conversations`) → if a choice was made, `sendMessage(dialogId, "📦 Способ получения: СДЭК")` runs exactly as today's message-send path (demo: synthetic `Message` object; real: `POST /conversations/{uuid}/messages`).
5. Buyer lands in `/messenger?chat=<id>`, sees the delivery-choice text as the first message bubble — no new rendering logic needed, it's a normal `Message.text`.

## Demo-mode verification (this session)

Fully clickable end-to-end, no new mocking:
1. Create a listing via `/ads/new` demo flow, tick both delivery methods.
2. View it as a different demo user on `/ads/$id`.
3. Confirm "Доставка" pills show "СДЭК"/"Яндекс Доставка".
4. Click "Написать" → sheet opens (mobile: bottom sheet at 375px; desktop: centered dialog).
5. Pick "СДЭК" → "Продолжить" → land in messenger, confirm first message reads "📦 Способ получения: СДЭК".
6. Repeat picking "Самовывоз / при встрече" → confirm message text.
7. Repeat with skip (×) → confirm conversation opens with no delivery message (same as pre-feature behavior).
8. Separately: open an ad with `ad.delivery = []` (or only legacy fake labels) → confirm "Написать" skips the sheet entirely.

## Backend documentation (new entry, #21)

New numbered entry in `backend-endpoints-needed.md` describing the deferred full loop (per your first scoping answer), so a future session doesn't have to re-derive the schemas:
- `SellerDeliveryProfileResource` fields and `POST/GET/PATCH/DELETE /v1/users/me/delivery-profile` — needed for seller-side pickup/warehouse point configuration (no frontend UI exists yet).
- `GET /v1/delivery/{provider}/pickup-points` — untyped response in OpenAPI (`data: string`), needs real payload shape confirmed before building a picker UI.
- `POST /v1/delivery/{provider}/quote` and `POST /v1/shipments/{shipment}/quote` — cost/ETA calculation, blocked on seller having a configured profile.
- `POST /v1/shipments` — shipment creation tying `listing_uuid` + `conversation_uuid` + `destination_point`, the actual "buyer confirms delivery" endpoint for a future real loop.
- Note: this session's delivery-choice message is plain text with no persisted structured field — flagged as the reason a future "delivery choice chip" UI needs either a new message-metadata field or should be superseded entirely by the real shipment flow above.
- Note: `CatalogParams.deliveries` (catalog filter) is defined but never sent to the real `/listings` query in `fetchListings`; existing doc entry mentions a singular `delivery_method` param that doesn't match the frontend's plural multi-select shape — flagged as needing contract clarification, not fixed in this feature.

## Out of Scope (explicit)

- Seller delivery-profile management UI (pickup/warehouse point setup).
- Live cost/ETA quote display anywhere.
- `POST /v1/shipments` creation — no real shipment gets created by this feature.
- Real-mode catalog filter query wiring for delivery.
- Specially-styled delivery-choice chip bubble in the messenger (plain text only).
