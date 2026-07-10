# Ad Wizard Photo Drag-and-Drop Reorder — Design Spec

## Context

The ad creation wizard's photo step (`StepPhotos` in `routes/ads.new.tsx` → `components/ads/wizard/ImageUploadGrid.tsx`) shows uploaded photos in a 2-D grid. Users can promote a photo to "main" via the "Сделать главным" (Star) button, but cannot freely reorder. The customer wants **drag-and-drop reordering** on mobile (touch) and desktop (mouse), **added to** — not replacing — the existing button.

Key constraint discovered in code: the wizard keeps **two parallel arrays** — `form.photos` (blob-URL previews) and `form.files` (the `File[]` to upload) — kept 1:1 in the same order (blob URLs are unique per file). Any reorder must move the item in **both** arrays identically, exactly as the existing `makeMain` handler already does.

## Approach (decided)

**framer-motion `Reorder`** (already a dependency, `^12.40.0`) with a **horizontal strip** layout. Rationale: native HTML5 drag has no touch support (fails mobile); framer-motion `Reorder` gives touch + mouse drag with animation out of the box and adds no dependency; it is 1-D, so the previews become a horizontal row rather than a 2-D grid (accepted trade-off). @dnd-kit (keeps the 2-D grid) was the alternative, rejected to avoid a new dependency.

## Design

### `ImageUploadGrid.tsx`

- Replace the 2-D grid of previews (`grid grid-cols-2 …`) with a **`Reorder.Group axis="x"`** horizontal strip:
  - `Reorder.Group` rendered as a `div`, `values={photos}`, `onReorder={onReorder}`, className `flex gap-[12px] overflow-x-auto no-scrollbar py-[2px]`.
  - Each photo is a **`Reorder.Item value={src}`** (blob URL as the stable value/key), `className="shrink-0"`, fixed size ~104px square. The whole item is the drag handle; add `cursor-grab active:cursor-grabbing` and `touch-action: none` on the item so touch drag is captured (page still scrolls vertically elsewhere; framer-motion auto-scrolls the strip when a tile is dragged to the horizontal edge).
  - The `PreviewTile` content (image + fallback + badge + buttons) moves inside the `Reorder.Item`. Keep the existing broken-image fallback.
- New prop on `ImageUploadGrid`: `onReorder: (newPhotos: string[]) => void`. The `Props` interface gains it; the existing `onAdd`/`onRemove`/`onMakeMain` are unchanged.
- The upload dropzone `<label>` and the `photos.length/max` counter are unchanged.

### Tile buttons — always visible (touch fix)

The action buttons (`Сделать главным`, `Удалить`) are currently `opacity-0 … group-hover:opacity-100` — invisible on touch devices. Change them to **always visible** (drop the hover-gating) so make-main/remove work on mobile. The "Главное" badge on index 0 stays. The "Сделать главным" Star button stays on non-main tiles (drag adds to it).

- Guard against a button tap starting a drag: framer-motion starts a drag only past a movement threshold, so a stationary tap fires the button's `onClick`; if a stray drag-start is observed on the buttons during verification, add `onPointerDownCapture={(e) => e.stopPropagation()}` to the buttons.

### `ads.new.tsx` StepPhotos

- Add a `reorder` handler that reorders **both** parallel arrays, keyed off the unique blob URLs:

```tsx
  const reorder = (newPhotos: string[]) => {
    const newFiles = newPhotos.map((url) => form.files[form.photos.indexOf(url)]);
    set("photos", newPhotos);
    set("files", newFiles);
  };
```

- Pass `onReorder={reorder}` to `<ImageUploadGrid …/>`.

## Non-goals

- No new dependency (framer-motion `Reorder` only).
- No change to add/remove/make-main behavior or to the parallel `photos`/`files` model.
- No change to the preview/publish steps or the uploaded payload shape (order is what changes).
- Not switching to a 2-D sortable grid (that would be the @dnd-kit path, rejected).

## Testing

No unit-test framework — `npx tsc --noEmit` + live Playwright at 375px (mobile-first, simulated pointer drag) then desktop.

- Upload ≥3 photos; drag a non-first tile to the front → it becomes index 0 (gets the "Главное" badge) and the **file order** matches (verify `photos` and `files` stay in lockstep — e.g. by checking that "Сделать главным" on the same tile is now hidden and the badge moved).
- Drag reorders on both touch (375px pointer drag) and mouse (desktop).
- "Сделать главным" button still works and coexists with drag.
- Action buttons are visible without hover (touch).
- With up to 10 photos the strip scrolls; dragging toward the edge auto-scrolls.
- No new console errors in the wizard at 375px + desktop.
