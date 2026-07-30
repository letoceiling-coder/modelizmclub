/**
 * Canvas-based effects + shape-mask compositing used by PhotoEditorDialog.
 * Cropper.js itself only handles crop/zoom/rotate/flip/resize — everything
 * here (filters, mask shapes) is applied as a second canvas pass on the
 * cropped bitmap it produces.
 */

export interface PhotoEffects {
  /** -100..100, 0 = no change */
  brightness: number;
  /** -100..100, 0 = no change */
  contrast: number;
  /** -100..100, 0 = no change */
  saturation: number;
  grayscale: boolean;
  sepia: boolean;
  /** 0..8 px */
  blur: number;
}

export const DEFAULT_EFFECTS: PhotoEffects = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  grayscale: false,
  sepia: false,
  blur: 0,
};

export type PhotoShape = "free" | "rect" | "rounded" | "circle";

export function effectsToCssFilter(effects: PhotoEffects): string {
  const parts: string[] = [];
  const brightnessPct = Math.max(0, 100 + effects.brightness);
  const contrastPct = Math.max(0, 100 + effects.contrast);
  const saturatePct = Math.max(0, 100 + effects.saturation);
  if (brightnessPct !== 100) parts.push(`brightness(${brightnessPct}%)`);
  if (contrastPct !== 100) parts.push(`contrast(${contrastPct}%)`);
  if (saturatePct !== 100) parts.push(`saturate(${saturatePct}%)`);
  if (effects.grayscale) parts.push("grayscale(1)");
  if (effects.sepia) parts.push("sepia(1)");
  if (effects.blur > 0) parts.push(`blur(${effects.blur}px)`);
  return parts.length ? parts.join(" ") : "none";
}

export function isDefaultEffects(effects: PhotoEffects): boolean {
  return effectsToCssFilter(effects) === "none";
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
}

/**
 * Bakes CSS-style filters and an optional shape mask (circle/rounded) into a
 * fresh canvas. `rect`/`free` shapes only pass the effects through.
 */
export function applyEffectsAndShape(
  source: HTMLCanvasElement,
  effects: PhotoEffects,
  shape: PhotoShape,
): HTMLCanvasElement {
  const filtered = document.createElement("canvas");
  filtered.width = source.width;
  filtered.height = source.height;
  const fctx = filtered.getContext("2d");
  if (!fctx) return source;

  const filter = effectsToCssFilter(effects);
  fctx.filter = filter;
  fctx.drawImage(source, 0, 0);
  fctx.filter = "none";

  if (shape !== "circle" && shape !== "rounded") {
    return filtered;
  }

  const masked = document.createElement("canvas");
  masked.width = filtered.width;
  masked.height = filtered.height;
  const mctx = masked.getContext("2d");
  if (!mctx) return filtered;

  mctx.save();
  mctx.beginPath();
  if (shape === "circle") {
    const r = Math.min(masked.width, masked.height) / 2;
    mctx.arc(masked.width / 2, masked.height / 2, r, 0, Math.PI * 2);
  } else {
    roundRectPath(mctx, 0, 0, masked.width, masked.height, Math.min(masked.width, masked.height) * 0.12);
  }
  mctx.closePath();
  mctx.clip();
  mctx.drawImage(filtered, 0, 0);
  mctx.restore();
  return masked;
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob() returned null"));
      },
      mime,
      quality,
    );
  });
}

/**
 * Resolves any accepted image source into a same-origin `blob:` URL so
 * canvas export never gets tainted by cross-origin restrictions.
 * Throws if the source can't be fetched/read (e.g. blocked by CORS).
 */
export async function resolveToBlobUrl(src: File | Blob | string): Promise<string> {
  if (src instanceof Blob) {
    return URL.createObjectURL(src);
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
