import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { ImagePlus, X, Star, ImageOff, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  photos: string[];
  max: number;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onMakeMain: (index: number) => void;
  onReorder: (newPhotos: string[]) => void;
  /** Stable React keys parallel to `photos` — prevents drag glitches when URLs repeat. */
  photoIds?: string[];
  /** Hide the upload dropzone (reorder/remove only). */
  hideUploader?: boolean;
  /** `compact` — smaller horizontal strip for wizard step 2. */
  variant?: "default" | "compact";
  /** Auto-clicks the hidden file input on mount, after a short delay to
   *  let the parent modal's mount/transition settle first. Used by
   *  CreatePostForm so choosing "Пост" in the composer menu jumps
   *  straight to the OS file picker instead of landing on an empty grid. */
  autoOpen?: boolean;
  /** `minimal` — only the delete (×) control; drag-to-reorder still works. */
  controls?: "full" | "minimal";
  /** Multiplier for tile size (e.g. 1.25 = +25%). */
  sizeScale?: number;
  /** Restricts the native file picker; defaults to all images. */
  accept?: string;
}

const TILE_DEFAULT = 104;
const TILE_COMPACT = 72;
const GAP = 12;
const GRID_COLS = 5;
const LAYOUT_TRANSITION = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };
/** Block a new swap until the reflow animation settles — prevents the dragged
 *  tile from ping-ponging between slots while neighbours are still animating. */
const SWAP_COOLDOWN_MS = 190;

const tileBoxStyle = (tile: number): CSSProperties => ({
  width: "100%",
  maxWidth: tile,
  aspectRatio: "1",
  justifySelf: "center",
});

function TileImage({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="grid h-full w-full place-items-center" style={{ color: "var(--foreground-30)" }}>
        <ImageOff size={22} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="pointer-events-none h-full w-full object-cover"
      onError={() => setBroken(true)}
    />
  );
}

/** In-flow tile — fixed 104×104, never translated during drag (overlay carries the photo). */
function PreviewTile({
  src,
  index,
  count,
  dropTarget,
  tile,
  compact,
  onRemove,
  onMakeMain,
  onMoveLeft,
  onMoveRight,
  onPointerDownDrag,
  minimalControls = false,
}: {
  src: string;
  index: number;
  count: number;
  dropTarget: boolean;
  tile: number;
  compact?: boolean;
  onRemove: (i: number) => void;
  onMakeMain: (i: number) => void;
  onMoveLeft: (i: number) => void;
  onMoveRight: (i: number) => void;
  onPointerDownDrag: (i: number, e: React.PointerEvent) => void;
  minimalControls?: boolean;
}) {
  const isMain = index === 0;

  const stopDrag = {
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  };

  return (
    <motion.div
      layout="position"
      transition={{ layout: LAYOUT_TRANSITION }}
      data-tile-index={index}
      onPointerDown={(e) => onPointerDownDrag(index, e)}
      className="relative cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
      style={{
        ...tileBoxStyle(tile),
        background: "var(--background-surface)",
        border: `2px solid ${dropTarget ? "var(--accent)" : isMain ? "var(--accent)" : "var(--border)"}`,
        borderRadius: compact ? "10px" : "var(--r-card-sm)",
      }}
    >
      <TileImage src={src} />

      {!minimalControls && isMain && (
        <span
          className="absolute left-[6px] top-[6px] inline-flex items-center gap-[3px] px-[8px] py-[3px] text-[10px] font-semibold uppercase"
          style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-pill)" }}
        >
          <Star size={9} fill="currentColor" /> Главное
        </span>
      )}

      <div className="absolute right-[6px] top-[6px] flex gap-[4px]">
        {!minimalControls && !isMain && (
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

      {!minimalControls && (
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
      )}
    </motion.div>
  );
}

function DragPlaceholder({ dropTarget, tile, compact }: { dropTarget: boolean; tile: number; compact?: boolean }) {
  return (
    <motion.div
      layout="position"
      transition={{ layout: LAYOUT_TRANSITION }}
      aria-hidden
      style={{
        ...tileBoxStyle(tile),
        borderRadius: compact ? "10px" : "var(--r-card-sm)",
        border: `2px dashed ${dropTarget ? "var(--accent)" : "var(--border-strong)"}`,
        background: dropTarget ? "var(--accent-soft)" : "var(--background-surface)",
        opacity: dropTarget ? 0.85 : 0.55,
      }}
    />
  );
}

function DragOverlay({
  src,
  isMain,
  x,
  y,
  tile,
}: {
  src: string;
  isMain: boolean;
  x: number;
  y: number;
  tile: number;
}) {
  return (
    <div
      className="pointer-events-none fixed z-[100] overflow-hidden"
      style={{
        left: x,
        top: y,
        width: tile,
        height: tile,
        borderRadius: "var(--r-card-sm)",
        border: "2px solid var(--accent)",
        boxShadow: "var(--shadow-float)",
        transform: "scale(1.04)",
        background: "var(--background-surface)",
      }}
    >
      <TileImage src={src} />
      {isMain && (
        <span
          className="absolute left-[6px] top-[6px] inline-flex items-center gap-[3px] px-[8px] py-[3px] text-[10px] font-semibold uppercase"
          style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-pill)" }}
        >
          <Star size={9} fill="currentColor" /> Главное
        </span>
      )}
    </div>
  );
}

const LIFT_THRESHOLD_PX = 5;

interface DragState {
  index: number;
  src: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  dx: number;
  dy: number;
  lifted: boolean;
}

export function ImageUploadGrid({
  photos,
  max,
  onAdd,
  onRemove,
  onMakeMain,
  onReorder,
  photoIds,
  hideUploader = false,
  variant = "default",
  autoOpen,
  controls = "full",
  sizeScale = 1,
  accept = "image/*",
}: Props) {
  const compact = variant === "compact";
  const minimalControls = controls === "minimal";
  const tile = Math.round((compact ? TILE_COMPACT : TILE_DEFAULT) * sizeScale);
  const gridMaxW = GRID_COLS * tile + (GRID_COLS - 1) * GAP;
  const full = photos.length >= max;
  const [drag, setDrag] = useState<DragState | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const overIndexRef = useRef<number | null>(null);
  const swapLockUntilRef = useRef(0);
  const photosRef = useRef(photos);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileDragActive, setFileDragActive] = useState(false);
  const fileDragDepthRef = useRef(0);

  photosRef.current = photos;

  const hasDroppedFiles = (dt: DataTransfer) =>
    Array.from(dt.types).some((t) => t === "Files" || t === "application/x-moz-file");

  const handleFileDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (full || !hasDroppedFiles(e.dataTransfer)) return;
    fileDragDepthRef.current += 1;
    setFileDragActive(true);
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1);
    if (fileDragDepthRef.current === 0) setFileDragActive(false);
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (full) return;
    if (hasDroppedFiles(e.dataTransfer)) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileDragDepthRef.current = 0;
    setFileDragActive(false);
    if (full) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) onAdd(files);
  };

  useEffect(() => {
    if (!autoOpen) return;
    const t = setTimeout(() => inputRef.current?.click(), 150);
    return () => clearTimeout(t);
  }, [autoOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    onAdd(files);
    e.target.value = "";
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
    if ((e.target as HTMLElement).closest("button")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    const state: DragState = {
      index,
      src: photosRef.current[index] ?? "",
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      dx: 0,
      dy: 0,
      lifted: false,
    };
    dragRef.current = state;
    setDrag(state);
    overIndexRef.current = index;
    setOverIndex(index);
    swapLockUntilRef.current = 0;
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
    const tileEl = el?.closest<HTMLElement>("[data-tile-index], [data-placeholder-index]");
    let targetIndex = cur.index;
    if (tileEl) {
      const idx = Number(tileEl.dataset.tileIndex ?? tileEl.dataset.placeholderIndex);
      if (!Number.isNaN(idx)) targetIndex = idx;
    }

    // While the reflow animation is still running, keep the overlay following
    // the pointer but hold off on a new swap so tiles don't ping-pong.
    const swapReady = performance.now() >= swapLockUntilRef.current;

    if (targetIndex !== cur.index && swapReady) {
      moveTo(cur.index, targetIndex);
      swapLockUntilRef.current = performance.now() + SWAP_COOLDOWN_MS;
      const next: DragState = {
        ...cur,
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

  const overlayPos = drag?.lifted
    ? {
        x: drag.startX - drag.offsetX + drag.dx,
        y: drag.startY - drag.offsetY + drag.dy,
      }
    : null;

  return (
    <div className={compact ? "space-y-[10px]" : "space-y-[16px]"}>
      {!hideUploader && (
      <label
        onDragEnter={handleFileDragEnter}
        onDragLeave={handleFileDragLeave}
        onDragOver={handleFileDragOver}
        onDrop={handleFileDrop}
        className="grid cursor-pointer touch-manipulation place-items-center gap-[10px] px-[20px] py-[36px] text-center transition-[border-color,background,transform] active:scale-[0.98] hover:border-[var(--accent)]"
        style={{
          background: fileDragActive ? "var(--accent-soft)" : "var(--background-elevated)",
          border: `2px dashed ${fileDragActive ? "var(--accent)" : "var(--border-strong)"}`,
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
        <input ref={inputRef} type="file" accept={accept} multiple onChange={handleChange} className="hidden" disabled={full} />
      </label>
      )}

      {photos.length > 0 && (
        <>
          <LayoutGroup id={compact ? "ad-photo-row" : "ad-photo-grid"}>
            <div
              className={compact ? "flex gap-[8px] overflow-x-auto pb-[2px] no-scrollbar py-[2px]" : "py-[2px]"}
              style={compact ? undefined : {
                display: "grid",
                gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
                gap: GAP,
                width: "100%",
                maxWidth: gridMaxW,
              }}
            >
              {photos.map((src, i) => {
                const key = photoIds?.[i] ?? src;
                const isDragging = drag?.lifted && drag.index === i;
                if (isDragging) {
                  return (
                    <div key={key} data-placeholder-index={i} className={compact ? "shrink-0" : undefined} style={compact ? { width: tile } : undefined}>
                      <DragPlaceholder dropTarget={overIndex === i && drag.index === i} tile={tile} compact={compact} />
                    </div>
                  );
                }
                return (
                  <div key={key} className={compact ? "shrink-0" : undefined} style={compact ? { width: tile } : undefined}>
                    <PreviewTile
                      src={src}
                      index={i}
                      count={photos.length}
                      dropTarget={overIndex === i && drag !== null && drag.lifted && drag.index !== i}
                      tile={tile}
                      compact={compact}
                      minimalControls={minimalControls}
                      onRemove={onRemove}
                      onMakeMain={onMakeMain}
                      onMoveLeft={(idx) => moveTo(idx, idx - 1)}
                      onMoveRight={(idx) => moveTo(idx, idx + 1)}
                      onPointerDownDrag={onTilePointerDown}
                    />
                  </div>
                );
              })}
            </div>
          </LayoutGroup>
          {overlayPos && drag && (
            <DragOverlay src={drag.src} isMain={drag.index === 0 && !minimalControls} x={overlayPos.x} y={overlayPos.y} tile={tile} />
          )}
          <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {minimalControls
              ? `${photos.length} из ${max}. Перетащите фото, чтобы изменить порядок. Первое — главное в карточке.`
              : `${photos.length} из ${max}. Перетащите фото или используйте стрелки, чтобы изменить порядок. Первое — главное в карточке.`}
          </p>
        </>
      )}
    </div>
  );
}
