import { useEffect, useRef, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
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
 *  delete button, and left/right nudge buttons as a drag-free reorder path. */
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
    <motion.div
      layout={!lifted}
      layoutId={src}
      transition={{ layout: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] } }}
      data-tile-index={index}
      onPointerDown={(e) => onPointerDownDrag(index, e)}
      className="relative shrink-0 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
      style={{
        width: 104,
        height: 104,
        background: "var(--background-surface)",
        border: `2px solid ${dropTarget ? "var(--accent)" : isMain ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--r-card-sm)",
        // The carried tile follows the pointer 1:1. pointer-events:none so
        // elementFromPoint sees the tile beneath for live slot swapping.
        transform: lifted ? `translate(${dragDx}px, ${dragDy}px) scale(1.05)` : undefined,
        boxShadow: lifted ? "var(--shadow-float)" : "none",
        zIndex: lifted ? 50 : 1,
        pointerEvents: lifted ? "none" : "auto",
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
    </motion.div>
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
  const overIndexRef = useRef<number | null>(null);
  const photosRef = useRef(photos);
  const inputRef = useRef<HTMLInputElement>(null);

  photosRef.current = photos;

  useEffect(() => {
    if (!autoOpen) return;
    const t = setTimeout(() => inputRef.current?.click(), 150);
    return () => clearTimeout(t);
  }, [autoOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    onAdd(files);
    e.target.value = ""; // allow re-picking the same file
  };

  const moveTo = (from: number, to: number) => {
    const list = photosRef.current;
    if (from === to || to < 0 || to >= list.length) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  const onTilePointerDown = (index: number, e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const state: DragState = { index, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, lifted: false };
    dragRef.current = state;
    setDrag(state);
    overIndexRef.current = index;
    setOverIndex(index);
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    const cur = dragRef.current;
    if (!cur) return;

    const dx = clientX - cur.startX;
    const dy = clientY - cur.startY;
    const lifted = cur.lifted || Math.hypot(dx, dy) > LIFT_THRESHOLD_PX;

    if (!lifted) {
      const next: DragState = { ...cur, dx, dy, lifted: false };
      dragRef.current = next;
      setDrag(next);
      return;
    }

    const el = document.elementFromPoint(clientX, clientY);
    const tileEl = el?.closest<HTMLElement>("[data-tile-index]");
    let targetIndex = cur.index;
    if (tileEl) {
      const idx = Number(tileEl.dataset.tileIndex);
      if (!Number.isNaN(idx)) targetIndex = idx;
    }

    // Live reorder: swap as soon as the pointer enters another slot so
    // siblings slide smoothly (via layout animation) instead of all jumping
    // on pointer-up. Reset the drag origin after each swap so the carried
    // tile doesn't visually snap.
    if (targetIndex !== cur.index) {
      moveTo(cur.index, targetIndex);
      const next: DragState = {
        index: targetIndex,
        startX: clientX,
        startY: clientY,
        dx: 0,
        dy: 0,
        lifted: true,
      };
      dragRef.current = next;
      setDrag(next);
      overIndexRef.current = targetIndex;
      setOverIndex(targetIndex);
      return;
    }

    const next: DragState = { ...cur, dx, dy, lifted: true };
    dragRef.current = next;
    setDrag(next);
    overIndexRef.current = targetIndex;
    setOverIndex(targetIndex);
  };

  const endDrag = () => {
    dragRef.current = null;
    setDrag(null);
    overIndexRef.current = null;
    setOverIndex(null);
  };

  // Window-level listeners keep tracking reliable when the pointer leaves
  // the grid (multi-row wrap) or moves faster than React can re-render.
  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => handlePointerMove(e.clientX, e.clientY);
    const onUp = () => endDrag();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag]);

  return (
    <div className="space-y-[16px]">
      <label
        className="grid cursor-pointer touch-manipulation place-items-center gap-[10px] px-[20px] py-[36px] text-center transition-[border-color,transform] active:scale-[0.98] hover:border-[var(--accent)]"
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
          <LayoutGroup id="ad-photo-grid">
            <div className="flex flex-wrap gap-[12px] py-[2px]">
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
          </LayoutGroup>
          <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {photos.length} из {max}. Перетащите фото или используйте стрелки, чтобы изменить порядок. Первое — главное в карточке.
          </p>
        </>
      )}
    </div>
  );
}
