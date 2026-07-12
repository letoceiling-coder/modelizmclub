# Photo Drag-Reorder Implementation Plan

> **For agentic workers:** Execute inline as the final stage of the Mobile Functional Fixes pass; single checkpoint + commit approval.

**Goal:** Add drag-and-drop reordering (touch + mouse) to the ad wizard's photo previews via a framer-motion `Reorder` horizontal strip, keeping the "Сделать главным" button and the parallel photos/files order in lockstep.

**Tech Stack:** React 19, TypeScript, framer-motion `Reorder` (existing `^12.40.0`).

## Global Constraints

- No new dependency. Reorder must move BOTH `form.photos` and `form.files` identically.
- "Сделать главным" button stays (drag adds to it). First item = main.
- Action buttons always visible (touch fix). `npx tsc --noEmit` clean; live 375px + desktop.

---

### Task 1: Reorder strip in `ImageUploadGrid.tsx`

**Files:** `frontend/src/components/ads/wizard/ImageUploadGrid.tsx`.

- [ ] **Step 1: Import `Reorder`** — change `import { motion } from "framer-motion";` to `import { Reorder } from "framer-motion";` (the `motion` wrapper on `PreviewTile` is replaced by the Reorder item — see Step 3; if `motion` ends up unused, remove it).

- [ ] **Step 2: Add `onReorder` to `Props`**

```tsx
interface Props {
  photos: string[];
  max: number;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onMakeMain: (index: number) => void;
  onReorder: (newPhotos: string[]) => void;
}
```

- [ ] **Step 3: Convert `PreviewTile` into a `Reorder.Item` + always-visible buttons**

Replace the `PreviewTile` component with a version wrapped in `Reorder.Item` (fixed-size strip tile), and drop the hover-gating on the action buttons:

```tsx
function PreviewTile({
  src,
  index,
  onRemove,
  onMakeMain,
}: {
  src: string;
  index: number;
  onRemove: (i: number) => void;
  onMakeMain: (i: number) => void;
}) {
  const [broken, setBroken] = useState(false);
  const isMain = index === 0;

  return (
    <Reorder.Item
      value={src}
      className="relative shrink-0 cursor-grab overflow-hidden active:cursor-grabbing"
      style={{
        width: 104,
        height: 104,
        touchAction: "none",
        background: "var(--background-surface)",
        border: `2px solid ${isMain ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--r-card-sm)",
      }}
      whileDrag={{ scale: 1.05, zIndex: 10, boxShadow: "var(--shadow-float)" }}
    >
      {broken ? (
        <div className="grid h-full w-full place-items-center" style={{ color: "var(--foreground-30)" }}>
          <ImageOff size={22} />
        </div>
      ) : (
        <img src={src} alt="" draggable={false} className="pointer-events-none h-full w-full object-cover" onError={() => setBroken(true)} />
      )}

      {isMain && (
        <span
          className="absolute left-[6px] top-[6px] inline-flex items-center gap-[3px] px-[8px] py-[3px] text-[10px] font-semibold uppercase"
          style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-pill)" }}
        >
          <Star size={9} fill="currentColor" /> Главное
        </span>
      )}

      <div className="absolute right-[6px] top-[6px] flex gap-[4px]">
        {!isMain && (
          <button
            type="button"
            onClick={() => onMakeMain(index)}
            onPointerDownCapture={(e) => e.stopPropagation()}
            title="Сделать главным"
            aria-label="Сделать главным фото"
            className="grid h-[28px] w-[28px] place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: "var(--r-pill)" }}
          >
            <Star size={12} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(index)}
          onPointerDownCapture={(e) => e.stopPropagation()}
          title="Удалить"
          aria-label="Удалить фото"
          className="grid h-[28px] w-[28px] place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: "var(--r-pill)" }}
        >
          <X size={12} />
        </button>
      </div>
    </Reorder.Item>
  );
}
```

Notes: `draggable={false}` + `pointer-events-none` on the `<img>` prevents the browser's native image-drag from hijacking the pointer drag; `onPointerDownCapture` stop-propagation on the buttons prevents a button tap from initiating a reorder drag.

- [ ] **Step 4: Replace the grid with a `Reorder.Group` strip**

In `ImageUploadGrid`, replace the previews block:

```tsx
      {photos.length > 0 && (
        <Reorder.Group
          as="div"
          axis="x"
          values={photos}
          onReorder={onReorder}
          className="flex gap-[12px] overflow-x-auto no-scrollbar py-[2px]"
        >
          {photos.map((src, i) => (
            <PreviewTile key={src} src={src} index={i} onRemove={onRemove} onMakeMain={onMakeMain} />
          ))}
        </Reorder.Group>
      )}
```

Add `onReorder` to the `ImageUploadGrid` destructured params: `export function ImageUploadGrid({ photos, max, onAdd, onRemove, onMakeMain, onReorder }: Props) {`.

- [ ] **Step 5: Typecheck** — `cd frontend && npx tsc --noEmit` clean (remove the now-unused `motion` import if it flags).

---

### Task 2: Wire `reorder` in `ads.new.tsx`

**Files:** `frontend/src/routes/ads.new.tsx`.

- [ ] **Step 1: Add the reorder handler in `StepPhotos`** (after `makeMain`):

```tsx
  const reorder = (newPhotos: string[]) => {
    const newFiles = newPhotos.map((url) => form.files[form.photos.indexOf(url)]);
    set("photos", newPhotos);
    set("files", newFiles);
  };
```

- [ ] **Step 2: Pass it to the grid**

```tsx
        <ImageUploadGrid
          photos={form.photos}
          max={MAX_PHOTOS}
          onAdd={addPhoto}
          onRemove={remove}
          onMakeMain={makeMain}
          onReorder={reorder}
        />
```

- [ ] **Step 3: Typecheck** — clean.

---

### Task 3: Live verification

- [ ] At 375px, `/ads/new` step 1: upload ≥3 photos (inject via the file input). Drag a non-first tile to the front (simulated pointer drag) → it becomes index 0 with the "Главное" badge; confirm `form.photos` order changed and the make-main button for that tile disappeared (now main).
- [ ] Confirm the file order stays in lockstep (photos/files parallel) — e.g. reorder then check the main tile's src matches the first file, or that "Сделать главным" on another tile still promotes correctly afterwards.
- [ ] "Сделать главным" button still works alongside drag; action buttons visible without hover.
- [ ] Desktop mouse-drag reorder works. No new console errors.
