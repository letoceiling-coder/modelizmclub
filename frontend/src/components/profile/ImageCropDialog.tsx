import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  file: File | null;
  aspect: number;
  outputWidth: number;
  outputHeight: number;
  title: string;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
  onDelete?: () => void;
}

const VIEWPORT_WIDTH = 320;
const SLIDER_MIN = 0;
const SLIDER_MAX = 100;
const SLIDER_CENTER = 50;
const ZOOM_CENTER = 1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

function sliderToZoom(slider: number): number {
  if (slider <= SLIDER_CENTER) {
    const t = slider / SLIDER_CENTER;
    return ZOOM_MIN + t * (ZOOM_CENTER - ZOOM_MIN);
  }
  const t = (slider - SLIDER_CENTER) / SLIDER_CENTER;
  return ZOOM_CENTER + t * (ZOOM_MAX - ZOOM_CENTER);
}

function clampOffset(
  x: number,
  y: number,
  displayedW: number,
  displayedH: number,
  viewportW: number,
  viewportH: number,
) {
  if (displayedW <= viewportW) {
    x = (viewportW - displayedW) / 2;
  } else {
    x = Math.min(0, Math.max(viewportW - displayedW, x));
  }
  if (displayedH <= viewportH) {
    y = (viewportH - displayedH) / 2;
  } else {
    y = Math.min(0, Math.max(viewportH - displayedH, y));
  }
  return { x, y };
}

/** Pan/zoom cover crop — slider at center = 1×, left = отдалить, right = приблизить. */
export function ImageCropDialog({
  file,
  aspect,
  outputWidth,
  outputHeight,
  title,
  onCancel,
  onCropped,
  onDelete,
}: Props) {
  const viewportH = VIEWPORT_WIDTH / aspect;
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [slider, setSlider] = useState(SLIDER_CENTER);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const centeredForFileRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);

  const zoom = sliderToZoom(slider);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    setSlider(SLIDER_CENTER);
    setNatural({ w: 0, h: 0 });
    setOffset({ x: 0, y: 0 });
    centeredForFileRef.current = null;
  }, [file]);

  const baseScale = natural.w > 0 ? Math.max(VIEWPORT_WIDTH / natural.w, viewportH / natural.h) : 1;
  const scale = baseScale * zoom;
  const displayedW = natural.w * scale;
  const displayedH = natural.h * scale;

  const clamp = useCallback(
    (x: number, y: number) => clampOffset(x, y, displayedW, displayedH, VIEWPORT_WIDTH, viewportH),
    [displayedW, displayedH, viewportH],
  );

  useEffect(() => {
    if (natural.w === 0 || !file) return;
    const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
    if (centeredForFileRef.current === fileKey) return;
    centeredForFileRef.current = fileKey;
    const bs = Math.max(VIEWPORT_WIDTH / natural.w, viewportH / natural.h);
    const w = natural.w * bs;
    const h = natural.h * bs;
    setOffset(clampOffset((VIEWPORT_WIDTH - w) / 2, (viewportH - h) / 2, w, h, VIEWPORT_WIDTH, viewportH));
  }, [natural.w, natural.h, file, viewportH]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { startX, startY, origX, origY } = dragRef.current;
    setOffset(clamp(origX + (e.clientX - startX), origY + (e.clientY - startY)));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const applySlider = (nextSlider: number) => {
    const clamped = Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, nextSlider));
    setSlider(clamped);
    const nextZoom = sliderToZoom(clamped);
    const newScale = baseScale * nextZoom;
    const w = natural.w * newScale;
    const h = natural.h * newScale;
    setOffset((o) => {
      const cx = o.x + VIEWPORT_WIDTH / 2;
      const cy = o.y + viewportH / 2;
      return clampOffset(cx - w / 2, cy - h / 2, w, h, VIEWPORT_WIDTH, viewportH);
    });
  };

  const confirm = async () => {
    if (!imgUrl) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas context");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outputWidth, outputHeight);
      const img = new Image();
      img.src = imgUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sw = VIEWPORT_WIDTH / scale;
      const sh = viewportH / scale;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
      canvas.toBlob(
        (blob) => {
          setSaving(false);
          if (blob) onCropped(blob);
        },
        "image/jpeg",
        0.92,
      );
    } catch {
      setSaving(false);
    }
  };

  if (!file || !imgUrl || natural.w === 0) return null;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="!flex max-w-[380px] flex-col items-center gap-4 p-6 sm:max-w-[380px]">
        <DialogHeader className="w-full space-y-0 text-center">
          <DialogTitle className="w-full text-center">{title}</DialogTitle>
        </DialogHeader>

        <div
          className="relative shrink-0 touch-none select-none overflow-hidden"
          style={{
            width: VIEWPORT_WIDTH,
            height: viewportH,
            borderRadius: aspect === 1 ? "50%" : "var(--r-card)",
            cursor: "grab",
            background: "var(--background-surface)",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img
            src={imgUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-0 top-0"
            style={{
              width: displayedW,
              height: displayedH,
              maxWidth: "none",
              maxHeight: "none",
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        </div>

        <div className="flex w-[320px] shrink-0 flex-col items-center gap-2">
          <span className="w-full text-center text-xs font-medium" style={{ color: "var(--foreground-50)" }}>
            Масштаб
          </span>
          <input
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={1}
            value={slider}
            onChange={(e) => applySlider(Number(e.target.value))}
            className="block w-full cursor-pointer"
            style={{ accentColor: "var(--accent)" }}
          />
        </div>

        {onDelete && (
          <button
            type="button"
            onClick={() => {
              onDelete();
              onCancel();
            }}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ color: "var(--error)" }}
          >
            <Trash2 className="h-4 w-4" />
            Удалить фото
          </button>
        )}

        <div className="flex w-full shrink-0 items-center justify-center gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Отмена
          </Button>
          <Button type="button" onClick={confirm} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
