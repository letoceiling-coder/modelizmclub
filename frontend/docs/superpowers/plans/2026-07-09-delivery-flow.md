# Delivery Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seller picks real delivery providers (СДЭК, Яндекс Доставка) when creating a listing; buyer sees availability on the ad page and picks a preferred method (or self-pickup) when contacting the seller, sent as the opening chat message.

**Architecture:** A shared `DELIVERY_METHODS` constant (2 real providers) replaces the duplicated 5-item lists in the wizard and catalog filters. A new `DeliveryChoiceSheet` component (mobile: vaul `Drawer`; desktop: radix `Dialog`) intercepts the existing "Написать" action on the ad detail page when the listing has delivery methods, then falls through to the existing `createConversation` → `sendMessage` calls — both already demo/real-branching internally.

**Tech Stack:** React 18 + TypeScript strict, TanStack Router, `components/ui/drawer.tsx` (vaul), `components/ui/dialog.tsx` (radix), `components/ui-bespoke/RadioCard.tsx`, `lib/api/chat.ts`.

## Global Constraints

- Frontend-only; no backend code changes. Real backend gaps go in `frontend/docs/backend-endpoints-needed.md`, not implemented.
- Mobile-first: every UI piece verified at 375px before desktop.
- `npx tsc --noEmit` clean after every task.
- No commit/push without explicit user permission.
- Delivery-choice message is plain text (`sendMessage`), not a new `Message` field.
- The picker only opens when the listing has at least one recognized delivery method; otherwise `writeToSeller` behavior is unchanged.
- Not in scope: seller delivery-profile UI, live quotes, `POST /v1/shipments`, real-mode catalog filter query wiring for delivery.

---

### Task 1: Shared `DELIVERY_METHODS` config + wizard/filter swap

**Files:**
- Create: `frontend/src/lib/config/deliveryMethods.ts`
- Modify: `frontend/src/routes/ads.new.tsx:37` (remove local `DELIVERIES`, import shared one)
- Modify: `frontend/src/components/ads/AdFilters.tsx:10` (remove local `DELIVERIES`, import shared one)

**Interfaces:**
- Produces: `DELIVERY_METHODS: DeliveryMethod[]` where `interface DeliveryMethod { id: "cdek" | "yandex"; label: string }`, and `SELF_PICKUP_LABEL: string`. Later tasks import `DELIVERY_METHODS` from `@/lib/config/deliveryMethods`.

- [ ] **Step 1: Create the shared config file**

```ts
// frontend/src/lib/config/deliveryMethods.ts

/**
 * Real, backend-connected delivery providers only (CDEK/Yandex have a
 * profile+pickup-point+quote domain in the backend OpenAPI spec — see
 * backend-endpoints-needed.md #21). The wizard previously also listed
 * "Почта России"/Ozon/Wildberries as decorative labels with zero backend
 * integration; dropped so the buyer-side picker never offers a method with
 * nothing behind it.
 */
export interface DeliveryMethod {
  id: "cdek" | "yandex";
  label: string;
}

export const DELIVERY_METHODS: DeliveryMethod[] = [
  { id: "cdek", label: "СДЭК" },
  { id: "yandex", label: "Яндекс Доставка" },
];

/** Always offered in the buyer picker alongside whatever the seller ticked. */
export const SELF_PICKUP_LABEL = "Самовывоз / при встрече";
```

- [ ] **Step 2: Swap the wizard's local list for the shared one**

In `frontend/src/routes/ads.new.tsx`, remove line 37:
```ts
const DELIVERIES = ["СДЭК", "Почта России", "Яндекс Доставка", "Ozon", "Wildberries"];
```
Add to the imports near the top of the file (after the `RadioCard`/`Checkbox` imports, e.g. after line 15):
```ts
import { DELIVERY_METHODS } from "@/lib/config/deliveryMethods";
```
At line 400 (`{DELIVERIES.map((d) => (`), change the checkbox loop to map over labels:
```tsx
{DELIVERY_METHODS.map((m) => (
  <Checkbox
    key={m.id}
    checked={form.deliveries.includes(m.label)}
    onChange={() => set("deliveries", form.deliveries.includes(m.label)
      ? form.deliveries.filter((x) => x !== m.label) : [...form.deliveries, m.label])}
    label={m.label}
  />
))}
```
(Only the source array changed — `form.deliveries` stays `string[]` of labels, `set`/`Checkbox` usage unchanged.)

- [ ] **Step 3: Swap the filter's local list for the shared one**

In `frontend/src/components/ads/AdFilters.tsx`, remove line 10:
```ts
const DELIVERIES = ["СДЭК", "Почта России", "Яндекс Доставка", "Ozon", "Wildberries"];
```
Add to imports (after line 6):
```ts
import { DELIVERY_METHODS } from "@/lib/config/deliveryMethods";
```
At line 119-124, change:
```tsx
<Group title="Доставка">
  <div className="flex flex-wrap gap-[6px]">
    {DELIVERY_METHODS.map((m) => (
      <Checkbox key={m.id} checked={value.deliveries.includes(m.label)} onChange={() => toggle("deliveries", m.label)} label={m.label} />
    ))}
  </div>
</Group>
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification (mobile 375px first, then desktop)**

Start the dev server, open `/ads/new` at 375px viewport, step through to step 2 ("Данные"), confirm the "Способы доставки" checkbox group now shows exactly 2 items: "СДЭК" and "Яндекс Доставка". Repeat at desktop width. Open `/ads` catalog, open the filters sheet on mobile (375px) and the filters panel on desktop (≥1280px xl), confirm "Доставка" group also shows exactly the same 2 items.

- [ ] **Step 6: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/lib/config/deliveryMethods.ts frontend/src/routes/ads.new.tsx frontend/src/components/ads/AdFilters.tsx
git commit -m "feat(delivery): shared 2-provider delivery-methods config for wizard + filters"
```

---

### Task 2: `DeliveryChoiceSheet` component

**Files:**
- Create: `frontend/src/components/ads/DeliveryChoiceSheet.tsx`

**Interfaces:**
- Consumes: `DELIVERY_METHODS`, `SELF_PICKUP_LABEL` from `@/lib/config/deliveryMethods` (Task 1). `Drawer`/`DrawerContent`/`DrawerTitle` from `@/components/ui/drawer`. `Dialog`/`DialogContent`/`DialogTitle` from `@/components/ui/dialog`. `RadioCard` from `@/components/ui-bespoke/RadioCard`. `Button` from `@/components/ui/button`. Icons `Truck`, `MapPin` from `lucide-react`. `useIsMobile` from `@/hooks/use-mobile` (existing hook, 768px breakpoint via `matchMedia`, matches Tailwind's `md` breakpoint).
- Produces: `DeliveryChoiceSheet` component with props:
```ts
interface DeliveryChoiceSheetProps {
  open: boolean;
  onClose: () => void;
  methods: string[];                          // ad.delivery labels, already filtered to real providers by the caller
  onConfirm: (choice: string | null) => void;  // null = skipped
}
```
Task 3 renders `<DeliveryChoiceSheet open={...} onClose={...} methods={...} onConfirm={...} />`.

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/components/ads/DeliveryChoiceSheet.tsx
import { useState } from "react";
import { Truck, MapPin } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RadioCard } from "@/components/ui-bespoke/RadioCard";
import { Button } from "@/components/ui/button";
import { SELF_PICKUP_LABEL } from "@/lib/config/deliveryMethods";
import { useIsMobile } from "@/hooks/use-mobile";

interface DeliveryChoiceSheetProps {
  open: boolean;
  onClose: () => void;
  methods: string[];
  onConfirm: (choice: string | null) => void;
}

function Body({ methods, selected, onSelect }: { methods: string[]; selected: string | null; onSelect: (v: string) => void }) {
  const rows = [...methods, SELF_PICKUP_LABEL];
  return (
    <div className="flex flex-col gap-[10px]">
      {rows.map((label) => (
        <RadioCard
          key={label}
          selected={selected === label}
          onClick={() => onSelect(label)}
          icon={label === SELF_PICKUP_LABEL ? MapPin : Truck}
          title={label}
          description={label === SELF_PICKUP_LABEL ? "Договоритесь о месте и времени в чате" : "Продавец отправит через выбранную службу"}
        />
      ))}
    </div>
  );
}

export function DeliveryChoiceSheet({ open, onClose, methods, onConfirm }: DeliveryChoiceSheetProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const confirm = () => {
    onConfirm(selected);
    setSelected(null);
  };
  const skip = () => {
    onConfirm(null);
    setSelected(null);
  };

  const body = <Body methods={methods} selected={selected} onSelect={setSelected} />;
  const confirmButton = (
    <Button className="mt-[16px] w-full" disabled={!selected} onClick={confirm}>
      Продолжить
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => { if (!o) skip(); }}>
        <DrawerContent className="pb-[calc(var(--safe-bottom)+16px)]">
          <div className="px-4 pt-2">
            <DrawerTitle className="text-base">Способ получения</DrawerTitle>
          </div>
          <div className="px-4 pb-4 pt-3">
            {body}
            {confirmButton}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) skip(); }}>
      <DialogContent className="max-w-[440px]">
        <DialogTitle>Способ получения</DialogTitle>
        {body}
        {confirmButton}
      </DialogContent>
    </Dialog>
  );
}
```

Note: unlike `AdFiltersSheet`/`AdFiltersPanel` (which use non-portaled `framer-motion` divs, so a CSS `hidden md:block` wrapper safely hides one of them), `Drawer`/`Dialog` here both render through React portals into `document.body` — a `hidden`/`md:block` wrapper around each would NOT prevent both from actually appearing at once, since portaled content ignores its call-site's CSS. `useIsMobile()` is used instead to mount exactly one of the two, never both. `useIsMobile()` returns `false` during SSR/first paint (its internal state starts `undefined`, coerced to `false` — see `hooks/use-mobile.tsx:6,18`), so on a fresh server-rendered load the desktop `Dialog` branch is what's in the initial DOM; since `open` starts `false` this is invisible either way and reconciles to the correct branch after mount, before the sheet could ever be opened by a user click.

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/components/ads/DeliveryChoiceSheet.tsx
git commit -m "feat(delivery): add DeliveryChoiceSheet (mobile drawer / desktop dialog)"
```

---

### Task 3: Wire `DeliveryChoiceSheet` into `ads.$id.tsx`'s contact flow

**Files:**
- Modify: `frontend/src/routes/ads.$id.tsx`

**Interfaces:**
- Consumes: `DeliveryChoiceSheet` (Task 2), `DELIVERY_METHODS` (Task 1), `sendMessage` from `@/lib/api/chat` (existing, signature `sendMessage(uuid: string, body: string, replyToUuid?: string): Promise<Message>`).

- [ ] **Step 1: Add imports**

At the top of `frontend/src/routes/ads.$id.tsx`, change line 2:
```ts
import { useEffect, useMemo, useState } from "react";
```
Add after line 18 (`import { createConversation } from "@/lib/api/chat";`):
```ts
import { createConversation, sendMessage } from "@/lib/api/chat";
import { DeliveryChoiceSheet } from "@/components/ads/DeliveryChoiceSheet";
import { DELIVERY_METHODS } from "@/lib/config/deliveryMethods";
```
(Combine with the existing `createConversation` import rather than duplicating it — i.e. replace line 18 entirely with the `sendMessage` addition.)

- [ ] **Step 2: Split `writeToSeller` into a gate + the actual conversation-creation logic**

Replace the existing `writeToSeller` function (lines 71-100) with:
```ts
const [deliveryPickerOpen, setDeliveryPickerOpen] = useState(false);

const availableDeliveryMethods = useMemo(
  () => (ad?.delivery ?? []).filter((d) => DELIVERY_METHODS.some((m) => m.label === d)),
  [ad],
);

const proceedToConversation = async (deliveryChoice: string | null) => {
  const sellerId = ad?.seller?.numericId;
  if (!sellerId || !me) {
    toast.error("Не удалось открыть диалог с продавцом");
    return;
  }
  if (me.numericId === sellerId) {
    toast.info("Это ваше объявление");
    return;
  }
  try {
    const dialog = await createConversation(sellerId, me.id, ad.id);
    if (ad) {
      actions.setDialogAd(dialog.id, {
        id: ad.id,
        title: ad.title,
        price: ad.price,
        image: ad.gallery?.[0] ?? ad.image,
      });
    }
    if (deliveryChoice) {
      await sendMessage(dialog.id, `📦 Способ получения: ${deliveryChoice}`);
    }
    navigate({ to: "/messenger", search: { chat: dialog.id } });
  } catch {
    toast.error("Не удалось открыть диалог");
  }
};

const writeToSeller = async () => {
  if (!getToken() && !isDemoMode()) {
    toast.info("Войдите, чтобы написать продавцу");
    navigate({ to: "/login" });
    return;
  }
  if (availableDeliveryMethods.length > 0) {
    setDeliveryPickerOpen(true);
    return;
  }
  await proceedToConversation(null);
};
```

- [ ] **Step 3: Render the sheet**

Near the end of the component's JSX, right before the closing `</AppLayout>` (after the `<SimilarAds items={similar} />` line, currently line 298), add:
```tsx
<DeliveryChoiceSheet
  open={deliveryPickerOpen}
  onClose={() => setDeliveryPickerOpen(false)}
  methods={availableDeliveryMethods}
  onConfirm={(choice) => {
    setDeliveryPickerOpen(false);
    void proceedToConversation(choice);
  }}
/>
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification — demo mode, mobile 375px first**

1. In the running dev server (demo mode active on localhost), create a listing via `/ads/new`, ticking both "СДЭК" and "Яндекс Доставка".
2. Navigate to that listing's `/ads/$id` page as a *different* demo user (or any listing already carrying delivery methods in `demo-data.ts`/mock listings). Confirm the existing "Доставка" card still shows the pills unchanged.
3. At 375px viewport, click "Написать" (in `AdActionPanel`). Confirm a bottom sheet opens titled "Способ получения" with 3 rows: "СДЭК", "Яндекс Доставка", "Самовывоз / при встрече".
4. Select "СДЭК", click "Продолжить". Confirm navigation to `/messenger?chat=...` and the first message bubble reads "📦 Способ получения: СДЭК".
5. Repeat from an ad detail page, this time clicking the × / backdrop to dismiss without selecting — confirm it still opens the conversation (via the `onOpenChange`-triggered `skip()`), with no delivery message.
6. Repeat step 3 at desktop width (≥1280px) — confirm the same picker now renders as a centered dialog, same 3 rows, same behavior.
7. Open an ad with `ad.delivery` empty (or only legacy labels like "Ozon" left over in old demo data) — confirm clicking "Написать" skips the sheet entirely and opens the conversation directly, exactly as before this feature.
8. Also click "Написать" from `SellerCard` (further down the page) — confirm it triggers the same picker (shared `writeToSeller`).

- [ ] **Step 6: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/src/routes/ads.\$id.tsx
git commit -m "feat(delivery): buyer picks delivery method when contacting seller"
```

---

### Task 4: Document the deferred real-integration loop

**Files:**
- Modify: `frontend/docs/backend-endpoints-needed.md`

**Interfaces:** None (documentation only).

- [ ] **Step 1: Append entry #21**

Add to the end of `frontend/docs/backend-endpoints-needed.md`:
```markdown
## 21. Delivery Flow — реальный CDEK/Yandex цикл (профиль/pickup/quote/shipment) отложен

**Контекст:** реализован MVP Delivery Flow (продавец выбирает СДЭК/Яндекс в
wizard, покупатель видит доступность на странице объявления и выбирает
способ при обращении к продавцу — способ отправляется обычным текстовым
сообщением в чат через уже существующий `sendMessage`). Никаких новых
backend-вызовов эта версия не делает.

Бэкенд уже содержит значительно более глубокий домен доставки, которым
текущая версия НЕ пользуется:

- `SellerDeliveryProfileResource` (`GET/POST/PATCH/DELETE
  /v1/users/me/delivery-profile`) — профиль пункта выдачи/склада продавца
  (`provider: cdek|yandex`, `point_type: warehouse|pickup_point`,
  `external_point_id`, `label`, `city_id`, `is_default`, `is_active`).
  Продавец может иметь несколько профилей. **Фронтенд-UI для настройки
  профиля не существует нигде** — блокирует всё нижеперечисленное.
- `GET /v1/delivery/{cdek|yandex}/pickup-points` — поиск пунктов выдачи
  покупателем. В OpenAPI ответ типизирован как `data: string` (сырой,
  нетипизированный проброс от провайдера) — перед реализацией picker UI
  нужно уточнить у бэкенда реальную форму payload (id/адрес/координаты).
- `POST /v1/delivery/{cdek|yandex}/quote` — расчёт стоимости/срока.
  Требует `source_point`/`destination_point`/`weight_kg`/`dimensions_cm`.
  `source_point` берётся из профиля продавца (см. выше) — расчёт
  невозможен, пока продавец не настроил профиль.
- `POST /v1/shipments` — создание отправления
  (`listing_uuid`+`conversation_uuid`+`provider`+`destination_point`).
  Это и есть реальное "оформление доставки" покупателем — текущий MVP до
  него не доходит, ограничиваясь текстовым сообщением-предпочтением.

**Что нужно для следующего этапа:**
1. UI настройки профиля доставки продавца (вероятно `/profile` или
   отдельный шаг в wizard) — без него `quote`/`shipment` не заработают.
2. Уточнить у бэкенда реальную структуру ответа pickup-points (сейчас
   `string` в спеке).
3. UI поиска пункта выдачи покупателем + live quote + кнопка "Оформить
   доставку" → `POST /v1/shipments`.
4. Отдельно: если понадобится визуально выделять сообщение с выбором
   доставки в чате (не просто текст) — нужно либо новое поле в
   `Message`-контракте бэкенда (сейчас такого поля нет, любые
   client-only поля не переживут перезагрузку в real-режиме), либо
   полностью заменить текстовый MVP на настоящий `Shipment`-флоу выше.

**Демо-fallback:** не нужен — MVP полностью работает в demo и real режиме
одинаково (переиспользует существующие `createConversation`/`sendMessage`,
которые уже demo-aware).
```

- [ ] **Step 2: Commit**

```bash
cd /Users/neeklo/Documents/Project/САЙТЫ/MODELISM
git add frontend/docs/backend-endpoints-needed.md
git commit -m "docs(delivery): document deferred CDEK/Yandex profile/quote/shipment loop"
```

---

### Task 5: Final full-flow verification + tsc

**Files:** None (verification only).

- [ ] **Step 1: Full typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors, clean exit.

- [ ] **Step 2: End-to-end demo click-through, mobile 375px then desktop**

Repeat the full sequence from Task 3 Step 5 once more, top to bottom, on a freshly reloaded page (not relying on HMR state), at both 375px and desktop (≥1280px) viewports, confirming:
- Wizard shows exactly 2 delivery checkboxes.
- Catalog filters (mobile sheet + desktop panel) show exactly 2 delivery checkboxes.
- Ad detail "Доставка" card unchanged.
- "Написать" opens the picker when delivery methods exist, skips it when they don't.
- Chosen method appears as the first chat message.
- Skip/dismiss still opens the conversation with no message.
- No `tsc` errors, no new console errors introduced (compare against baseline console output before this feature).

- [ ] **Step 3: Report results to the user, do not commit further without explicit permission**

This plan's individual task commits (Tasks 1-4) are the working history; no additional commit is needed for verification-only Task 5 unless issues were found and fixed, in which case commit those fixes with a clear message and re-run Step 1-2.
