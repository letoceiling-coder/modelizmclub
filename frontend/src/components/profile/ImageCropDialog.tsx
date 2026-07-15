import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  file: File | null;
  /** width / height of both the crop viewport and the final output. */
  aspect: number;
  outputWidth: number;
  outputHeight: number;
  title: string;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}

const VIEWPORT_WIDTH = 320;
const MAX_ZOOM = 3;

/** Simple pan/zoom "cover" crop — drag to reposition, slider to zoom, then
 *  bakes the visible region to a canvas at the target output size before
 *  upload. No cropper library: the math is the standard object-fit:cover
 *  transform (base scale so the image always fills the viewport, offset
 *  clamped so no edge gap ever shows). */
export function ImageCropDialog({ file, aspect, outputWidth, outputHeight, title, onCancel, onCropped }: Props) {
  const viewportH = VIEWPORT_WIDTH / aspect;
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [saving, setSaving] = useState(false);

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
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [file]);

  if (!file || !imgUrl || natural.w === 0) return null;

  const baseScale = Math.max(VIEWPORT_WIDTH / natural.w, viewportH / natural.h);
  const scale = baseScale * zoom;
  const displayedW = natural.w * scale;
  const displayedH = natural.h * scale;

  const clamp = (x: number, y: number) => ({
    x: Math.min(0, Math.max(VIEWPORT_WIDTH - displayedW, x)),
    y: Math.min(0, Math.max(viewportH - displayedH, y)),
  });

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

  const onZoom = (v: number) => {
    setZoom(v);
    const newScale = baseScale * v;
    const w = natural.w * newScale;
    const h = natural.h * newScale;
    setOffset((o) => ({
      x: Math.min(0, Math.max(VIEWPORT_WIDTH - w, o.x)),
      y: Math.min(0, Math.max(viewportH - h, o.y)),
    }));
  };

  const confirm = async () => {
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas context");
      const img = new Image();
      img.src = imgUrl;
      await new Promise((resolve) => { img.onload = resolve; });
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

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div
          className="relative mx-auto touch-none select-none overflow-hidden"
          style={{ width: VIEWPORT_WIDTH, height: viewportH, borderRadius: aspect === 1 ? "50%" : "var(--r-card)", cursor: "grab" }}
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
            // maxWidth/maxHeight: none override Tailwind Preflight's global
            // `img { max-width: 100%; height: auto }` reset. That rule clamps
            // the rendered width to the 320px viewport regardless of the
            // (correct, proportional) inline width computed below — height
            // stays uncapped since inline height wins the same-property
            // cascade — so at any zoom that pushes displayedW past the
            // viewport, the box shrinks in width but not height and the
            // browser's default object-fit:fill stretches the pixels to
            // match, visibly distorting the photo as the slider moves.
            style={{
              width: displayedW, height: displayedH, maxWidth: "none", maxHeight: "none",
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        </div>
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs" style={{ color: "var(--foreground-50)" }}>Масштаб</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
            className="flex-1"
            style={{ accentColor: "var(--accent)" }}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Отмена</Button>
          <Button type="button" onClick={confirm} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
