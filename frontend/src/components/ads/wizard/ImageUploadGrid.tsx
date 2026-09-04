import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ImagePlus,
  Star,
  ImageOff,
  Pencil,
  MoreVertical,
  GripVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  photos: string[];
  max: number;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onMakeMain: (index: number) => void;
  onReorder: (newPhotos: string[]) => void;
  /** Opens the photo editor (crop/rotate/effects) for the tile at this index. */
  onEdit?: (index: number) => void;
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
  /** `minimal` — compact menu actions; drag via handle on mobile. */
  controls?: "full" | "minimal";
  /** Multiplier for tile size (e.g. 1.25 = +25%). */
  sizeScale?: number;
  /** Restricts the native file picker; defaults to all images. */
  accept?: string;
}

const TILE_DEFAULT = 104;
const TILE_COMPACT = 88;
const GAP = 12;
const LAYOUT_TRANSITION = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};
/** Block a new swap until the reflow animation settles — prevents the dragged
 *  tile from ping-ponging between slots while neighbours are still animating. */
const SWAP_COOLDOWN_MS = 190;

const tileBoxStyle = (tile: number): CSSProperties => ({
  width: "100%",
  maxWidth: tile > 0 ? tile : undefined,
  aspectRatio: "1",
  justifySelf: "center",
});

function TileImage({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div
        className="grid h-full w-full place-items-center"
        style={{ color: "var(--foreground-30)" }}
      >
        <ImageOff size={22} />
      </div>
    );
  }
  return (
    <img
      src={src}
      width={400}
      height={400}
      loading="lazy"
      decoding="async"
      alt=""
      draggable={false}
      className="pointer-events-none h-full w-full object-cover"
      onError={() => setBroken(true)}
    />
  );
}

function TileActionsMenu({
  index,
  count,
  isMain,
  onMakeMain,
  onEdit,
  onRemove,
  onMoveLeft,
  onMoveRight,
  showMoveArrows,
}: {
  index: number;
  count: number;
  isMain: boolean;
  onMakeMain: (i: number) => void;
  onEdit?: (i: number) => void;
  onRemove: (i: number) => void;
  onMoveLeft: (i: number) => void;
  onMoveRight: (i: number) => void;
  showMoveArrows: boolean;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={t("components.imageUploadGrid.menuAria")}
          aria-label={t("components.imageUploadGrid.menuAria")}
          className="grid h-[32px] w-[32px] place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: "var(--r-pill)" }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {!isMain && (
          <DropdownMenuItem onSelect={() => onMakeMain(index)}>
            <Star size={14} />
            {t("components.imageUploadGrid.makeMain")}
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onSelect={() => onEdit(index)}>
            <Pencil size={14} />
            {t("components.imageUploadGrid.edit")}
          </DropdownMenuItem>
        )}
        {showMoveArrows && index > 0 && (
          <DropdownMenuItem onSelect={() => onMoveLeft(index)}>
            <ChevronLeft size={14} />
            {t("components.imageUploadGrid.moveLeft")}
          </DropdownMenuItem>
        )}
        {showMoveArrows && index < count - 1 && (
          <DropdownMenuItem onSelect={() => onMoveRight(index)}>
            <ChevronRight size={14} />
            {t("components.imageUploadGrid.moveRight")}
          </DropdownMenuItem>
        )}
        {(onEdit || !isMain || showMoveArrows) && <DropdownMenuSeparator />}
        <DropdownMenuItem
          onSelect={() => onRemove(index)}
          className="text-destructive focus:text-destructive"
        >
          {t("components.imageUploadGrid.remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** In-flow tile — responsive size; overlay carries the photo during drag. */
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
  onEdit,
  minimalControls = false,
  dragFromHandleOnly = false,
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
  onEdit?: (i: number) => void;
  minimalControls?: boolean;
  dragFromHandleOnly?: boolean;
}) {
  const { t } = useTranslation();
  const isMain = index === 0;

  const startDragIfAllowed = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, [role=menu], [data-radix-collection-item]"))
      return;
    onPointerDownDrag(index, e);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      onMoveLeft(index);
    } else if (e.key === "ArrowRight" && index < count - 1) {
      e.preventDefault();
      onMoveRight(index);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onRemove(index);
    }
  };

  return (
    <motion.div
      layout="position"
      transition={{ layout: LAYOUT_TRANSITION }}
      data-tile-index={index}
      tabIndex={0}
      role="group"
      aria-label={`${t("components.imageUploadGrid.mainBadge")} ${index + 1}`}
      onKeyDown={onKeyDown}
      onPointerDown={dragFromHandleOnly ? undefined : startDragIfAllowed}
      className="relative cursor-grab touch-none overflow-hidden select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:cursor-grabbing"
      style={{
        ...tileBoxStyle(tile),
        background: "var(--background-surface)",
        border: `2px solid ${dropTarget ? "var(--accent)" : isMain ? "var(--accent)" : "var(--border)"}`,
        borderRadius: compact ? "10px" : "var(--r-card-sm)",
      }}
    >
      <TileImage src={src} />

      {isMain && (
        <span
          className="absolute left-[6px] top-[6px] inline-flex items-center gap-[3px] px-[8px] py-[3px] text-[10px] font-semibold uppercase"
          style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-pill)" }}
        >
          <Star size={9} fill="currentColor" /> {t("components.imageUploadGrid.mainBadge")}
        </span>
      )}

      <div className="absolute right-[6px] top-[6px]">
        <TileActionsMenu
          index={index}
          count={count}
          isMain={isMain}
          onMakeMain={onMakeMain}
          onEdit={onEdit}
          onRemove={onRemove}
          onMoveLeft={onMoveLeft}
          onMoveRight={onMoveRight}
          showMoveArrows={!minimalControls}
        />
      </div>

      {dragFromHandleOnly && (
        <button
          type="button"
          aria-label={t("components.imageUploadGrid.dragHandleAria")}
          title={t("components.imageUploadGrid.dragHandleAria")}
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDownDrag(index, e);
          }}
          className="absolute bottom-[6px] left-[6px] grid h-[32px] w-[32px] cursor-grab place-items-center active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: "var(--r-pill)" }}
        >
          <GripVertical size={14} />
        </button>
      )}
    </motion.div>
  );
}

function DragPlaceholder({
  dropTarget,
  tile,
  compact,
}: {
  dropTarget: boolean;
  tile: number;
  compact?: boolean;
}) {
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
  mainLabel,
}: {
  src: string;
  isMain: boolean;
  x: number;
  y: number;
  tile: number;
  mainLabel: string;
}) {
  return (
    <div
      className="pointer-events-none fixed z-[var(--z-modal)] overflow-hidden"
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
          <Star size={9} fill="currentColor" /> {mainLabel}
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
  onEdit,
  photoIds,
  hideUploader = false,
  variant = "default",
  autoOpen,
  controls = "full",
  sizeScale = 1,
  accept = "image/*",
}: Props) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const compact = variant === "compact";
  const minimalControls = controls === "minimal";
  const dragFromHandleOnly = isMobile;
  const tileFallback = Math.round((compact ? TILE_COMPACT : TILE_DEFAULT) * sizeScale);
  const full = photos.length >= max;
  const [drag, setDrag] = useState<DragState | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [measuredTile, setMeasuredTile] = useState(tileFallback);
  const dragRef = useRef<DragState | null>(null);
  const overIndexRef = useRef<number | null>(null);
  const swapLockUntilRef = useRef(0);
  const photosRef = useRef(photos);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [fileDragActive, setFileDragActive] = useState(false);
  const fileDragDepthRef = useRef(0);

  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  photosRef.current = photos;
  const tile = compact ? tileFallback : measuredTile;

  useEffect(() => {
    if (compact) return;
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const first = el.querySelector<HTMLElement>("[data-tile-index]");
      if (first?.offsetWidth) setMeasuredTile(first.offsetWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [photos.length, compact, isMobile]);

  const hasDroppedFiles = (dt: DataTransfer) =>
    Array.from(dt.types).some((type) => type === "Files" || type === "application/x-moz-file");

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
    const timer = setTimeout(() => inputRef.current?.click(), 150);
    return () => clearTimeout(timer);
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
    onReorderRef.current(next);
  };

  const onTilePointerDown = (index: number, e: React.PointerEvent) => {
    const tileEl =
      (e.currentTarget as HTMLElement).dataset.tileIndex != null
        ? (e.currentTarget as HTMLElement)
        : (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-tile-index]");
    if (!tileEl) return;
    const rect = tileEl.getBoundingClientRect();
    tileEl.setPointerCapture(e.pointerId);
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
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      handlePointerMove(e.clientX, e.clientY);
    };
    const onUp = () => {
      if (!dragRef.current) return;
      endDrag();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const overlayPos = drag?.lifted
    ? {
        x: drag.startX - drag.offsetX + drag.dx,
        y: drag.startY - drag.offsetY + drag.dy,
      }
    : null;

  const dropzoneTitle = isMobile
    ? t("components.imageUploadGrid.dropzoneTitleMobile")
    : t("components.imageUploadGrid.dropzoneTitle");

  return (
    <div className={compact ? "space-y-[10px]" : "space-y-[12px]"}>
      {!hideUploader && (
        <label
          onDragEnter={handleFileDragEnter}
          onDragLeave={handleFileDragLeave}
          onDragOver={handleFileDragOver}
          onDrop={handleFileDrop}
          className={`grid cursor-pointer touch-manipulation place-items-center gap-[8px] px-[16px] text-center transition-[border-color,background,transform] active:scale-[0.98] hover:border-[var(--accent)] ${isMobile ? "py-[20px]" : "py-[28px]"}`}
          style={{
            background: fileDragActive ? "var(--accent-soft)" : "var(--background-elevated)",
            border: `2px dashed ${fileDragActive ? "var(--accent)" : "var(--border-strong)"}`,
            borderRadius: "var(--r-card)",
            opacity: full ? 0.55 : 1,
            pointerEvents: full ? "none" : "auto",
          }}
        >
          <div
            className={`grid place-items-center ${isMobile ? "h-[44px] w-[44px]" : "h-[52px] w-[52px]"}`}
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
              borderRadius: "var(--r-pill)",
            }}
          >
            <ImagePlus size={isMobile ? 20 : 22} />
          </div>
          <div
            className={`font-semibold ${isMobile ? "text-[13px]" : "text-[14px]"}`}
            style={{ color: "var(--foreground)" }}
          >
            {dropzoneTitle}
          </div>
          <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {t("components.imageUploadGrid.dropzoneHint", { current: photos.length, max })}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple
            onChange={handleChange}
            className="hidden"
            disabled={full}
          />
        </label>
      )}

      {photos.length > 0 && (
        <>
          <LayoutGroup id={compact ? "ad-photo-row" : "ad-photo-grid"}>
            <div
              ref={gridRef}
              className={
                compact
                  ? "flex gap-[10px] overflow-x-auto pb-[2px] no-scrollbar py-[2px]"
                  : "grid grid-cols-3 min-[480px]:grid-cols-4 gap-[12px] w-full py-[2px]"
              }
            >
              {photos.map((src, i) => {
                const key = photoIds?.[i] ?? src;
                const isDragging = drag?.lifted && drag.index === i;
                if (isDragging) {
                  return (
                    <div
                      key={key}
                      data-placeholder-index={i}
                      className={compact ? "shrink-0" : undefined}
                      style={compact ? { width: tile } : undefined}
                    >
                      <DragPlaceholder
                        dropTarget={overIndex === i && drag.index === i}
                        tile={tile}
                        compact={compact}
                      />
                    </div>
                  );
                }
                return (
                  <div
                    key={key}
                    className={compact ? "shrink-0" : undefined}
                    style={compact ? { width: tile } : undefined}
                  >
                    <PreviewTile
                      src={src}
                      index={i}
                      count={photos.length}
                      dropTarget={
                        overIndex === i && drag !== null && drag.lifted && drag.index !== i
                      }
                      tile={tile}
                      compact={compact}
                      minimalControls={minimalControls}
                      dragFromHandleOnly={dragFromHandleOnly}
                      onRemove={onRemove}
                      onMakeMain={onMakeMain}
                      onMoveLeft={(idx) => moveTo(idx, idx - 1)}
                      onMoveRight={(idx) => moveTo(idx, idx + 1)}
                      onPointerDownDrag={onTilePointerDown}
                      onEdit={onEdit}
                    />
                  </div>
                );
              })}
            </div>
          </LayoutGroup>
          {overlayPos && drag && (
            <DragOverlay
              src={drag.src}
              isMain={drag.index === 0}
              x={overlayPos.x}
              y={overlayPos.y}
              tile={tile}
              mainLabel={t("components.imageUploadGrid.mainBadge")}
            />
          )}
          <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {minimalControls
              ? t("components.imageUploadGrid.hintMinimal", { current: photos.length, max })
              : t("components.imageUploadGrid.hintFull", { current: photos.length, max })}
          </p>
        </>
      )}
    </div>
  );
}
