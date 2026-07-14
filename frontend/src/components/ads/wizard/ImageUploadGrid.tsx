import { useEffect, useRef, useState } from "react";
import { ImagePlus, X, Star, ImageOff, ChevronLeft, ChevronRight } from "lucide-react";

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

/** Single preview tile — a broken-image fallback (revoked/failed blob URL
 *  never shows the browser's default broken glyph), a "make main" star, a
 *  delete button, and left/right nudge buttons as a drag-free reorder path.
 *  Drag itself is driven by the parent grid's pointer handlers (see
 *  ImageUploadGrid) rather than per-tile, so a drag started on one tile can
 *  be tracked against every other tile's live position. */
function PreviewTile({
  src,
  index,
  count,
  lifted,
  dragDx,
  dragDy,
  dropTarget,
  onRemove,
  onMakeMain,
  onMoveLeft,
  onMoveRight,
  onPointerDownDrag,
}: {
  src: string;
  index: number;
  count: number;
  /** This tile is the one being carried, and the pointer has moved past the
   *  lift threshold — render it following the pointer, lifted off the grid. */
  lifted: boolean;
  dragDx: number;
  dragDy: number;
  dropTarget: boolean;
  onRemove: (i: number) => void;
  onMakeMain: (i: number) => void;
  onMoveLeft: (i: number) => void;
  onMoveRight: (i: number) => void;
  onPointerDownDrag: (i: number, e: React.PointerEvent) => void;
}) {
  const [broken, setBroken] = useState(false);
  const isMain = index === 0;

  const stopDrag = {
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  };

  return (
    <div
      data-tile-index={index}
      onPointerDown={(e) => onPointerDownDrag(index, e)}
      className="relative shrink-0 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
      style={{
        width: 104,
        height: 104,
        background: "var(--background-surface)",
        border: `2px solid ${dropTarget ? "var(--accent)" : isMain ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--r-card-sm)",
        // The carried tile follows the pointer 1:1 (translate by the raw
        // pointer delta) — no transition so it tracks the finger without lag,
        // and pointer-events:none so elementFromPoint sees the tile beneath it
        // to pick the drop slot. Every other tile keeps a short transform
        // transition, so on release the carried tile snaps smoothly into its
        // new slot instead of teleporting.
        transform: lifted ? `translate(${dragDx}px, ${dragDy}px) scale(1.05)` : "scale(1)",
        boxShadow: lifted ? "var(--shadow-float)" : "none",
        opacity: 1,
        zIndex: lifted ? 50 : 1,
        pointerEvents: lifted ? "none" : "auto",
        transition: lifted ? "none" : "transform 160ms ease, border-color 150ms ease, box-shadow 160ms ease",
      }}
    >
      {broken ? (
        <div className="grid h-full w-full place-items-center" style={{ color: "var(--foreground-30)" }}>
          <ImageOff size={22} />
        </div>
      ) : (
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
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
            {...stopDrag}
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
          {...stopDrag}
          title="Удалить"
          aria-label="Удалить фото"
          className="grid h-[28px] w-[28px] place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: "var(--r-pill)" }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Left/right nudge — an always-available alternative to drag, same
          idea as marketplace apps (Avito etc.) that offer both. */}
      <div className="absolute bottom-[6px] left-[6px] flex gap-[4px]">
        {index > 0 && (
          <button
            type="button"
            onClick={() => onMoveLeft(index)}
            {...stopDrag}
            title="Переместить влево"
            aria-label="Переместить фото влево"
            className="grid h-[24px] w-[24px] place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: "var(--r-pill)" }}
          >
            <ChevronLeft size={13} />
          </button>
        )}
        {index < count - 1 && (
          <button
            type="button"
            onClick={() => onMoveRight(index)}
            {...stopDrag}
            title="Переместить вправо"
            aria-label="Переместить фото вправо"
            className="grid h-[24px] w-[24px] place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: "var(--r-pill)" }}
          >
            <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// Pointer must travel this far before a press turns into a lift — keeps a
// plain tap (or a tap on a tile button) from twitching the photo.
const LIFT_THRESHOLD_PX = 5;

interface DragState {
  index: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  lifted: boolean;
}

export function ImageUploadGrid({ photos, max, onAdd, onRemove, onMakeMain, onReorder, autoOpen }: Props) {
  const full = photos.length >= max;
  const [drag, setDrag] = useState<DragState | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoOpen) return;
    const t = setTimeout(() => inputRef.current?.click(), 150);
    return () => clearTimeout(t);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    onAdd(files);
    e.target.value = ""; // allow re-picking the same file
  };

  const moveTo = (from: number, to: number) => {
    if (from === to || to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  // Drag is driven from the grid level (not per-tile) via native Pointer
  // Events — works identically for touch and mouse, and doesn't depend on
  // any gesture library's single-axis assumptions, which is what broke touch
  // dragging in a wrapping (multi-row) grid before. Once the pointer passes
  // the lift threshold the carried tile follows the finger (translate by the
  // raw pointer delta, pointer-events:none so it doesn't shadow the tile
  // beneath); every pointermove hit-tests which tile is under the pointer
  // (elementFromPoint + data-tile-index) to highlight the drop slot, and the
  // swap commits on release.
  const onTilePointerDown = (index: number, e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const state: DragState = { index, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, lifted: false };
    dragRef.current = state;
    setDrag(state);
    setOverIndex(index);
  };

  const onGridPointerMove = (e: React.PointerEvent) => {
    const cur = dragRef.current;
    if (!cur) return;
    const dx = e.clientX - cur.startX;
    const dy = e.clientY - cur.startY;
    const lifted = cur.lifted || Math.hypot(dx, dy) > LIFT_THRESHOLD_PX;
    const next: DragState = { ...cur, dx, dy, lifted };
    dragRef.current = next;
    setDrag(next);

    if (!lifted) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const tileEl = el?.closest<HTMLElement>("[data-tile-index]");
    if (!tileEl) return;
    const idx = Number(tileEl.dataset.tileIndex);
    if (!Number.isNaN(idx)) setOverIndex(idx);
  };

  const endDrag = () => {
    const cur = dragRef.current;
    if (cur && cur.lifted && overIndex !== null) {
      moveTo(cur.index, overIndex);
    }
    dragRef.current = null;
    setDrag(null);
    setOverIndex(null);
  };

  return (
    <div className="space-y-[16px]">
      <label
        className="grid cursor-pointer place-items-center gap-[10px] px-[20px] py-[36px] text-center transition-colors hover:border-[var(--accent)]"
        style={{
          background: "var(--background-elevated)",
          border: "2px dashed var(--border-strong)",
          borderRadius: "var(--r-card)",
          opacity: full ? 0.55 : 1,
          pointerEvents: full ? "none" : "auto",
        }}
      >
        <div
          className="grid h-[56px] w-[56px] place-items-center"
          style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: "var(--r-pill)" }}
        >
          <ImagePlus size={24} />
        </div>
        <div className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
          Перетащите фото или нажмите, чтобы выбрать
        </div>
        <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
          JPG, PNG до 10 МБ · {photos.length}/{max}
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleChange} className="hidden" disabled={full} />
      </label>

      {photos.length > 0 && (
        <>
          <div
            className="flex flex-wrap gap-[12px] py-[2px]"
            onPointerMove={onGridPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {photos.map((src, i) => {
              const isDragged = drag?.index === i;
              return (
                <PreviewTile
                  key={src}
                  src={src}
                  index={i}
                  count={photos.length}
                  lifted={Boolean(isDragged && drag?.lifted)}
                  dragDx={isDragged ? drag!.dx : 0}
                  dragDy={isDragged ? drag!.dy : 0}
                  dropTarget={overIndex === i && drag !== null && drag.lifted && drag.index !== i}
                  onRemove={onRemove}
                  onMakeMain={onMakeMain}
                  onMoveLeft={(idx) => moveTo(idx, idx - 1)}
                  onMoveRight={(idx) => moveTo(idx, idx + 1)}
                  onPointerDownDrag={onTilePointerDown}
                />
              );
            })}
          </div>
          <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {photos.length} из {max}. Перетащите фото или используйте стрелки, чтобы изменить порядок. Первое — главное в карточке.
          </p>
        </>
      )}
    </div>
  );
}
