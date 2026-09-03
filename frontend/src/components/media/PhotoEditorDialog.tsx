import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import {
  Circle,
  FlipHorizontal2,
  FlipVertical2,
  Loader2,
  RectangleHorizontal,
  RotateCcw,
  RotateCw,
  Square,
  SquareRoundCorner,
  Trash2,
  ZoomIn,
  ZoomOut,
  Hand,
  Crop,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast";
import {
  applyEffectsAndShape,
  canvasToBlob,
  DEFAULT_EFFECTS,
  effectsToCssFilter,
  resolveToBlobUrl,
  type PhotoEffects,
  type PhotoShape,
} from "@/lib/photo-editor";
import { CropSafeZoneOverlay } from "@/components/media/CropSafeZoneOverlay";
import { BANNER_ASPECT, BANNER_EXPORT_HEIGHT, BANNER_EXPORT_WIDTH, type SafeZonePreset } from "@/lib/photo-editor-safe-zones";

export type CropInteractionMode = "pan" | "frame";

export interface PhotoEditorDialogProps {
  /** Explicit visibility control. Omit to derive it from `file`/`src` being non-null (legacy ImageCropDialog-compatible mode). */
  open?: boolean;
  /** Accepts a freshly picked file/blob or an already-uploaded image URL. */
  src?: File | Blob | string | null;
  /** Legacy alias for `src`, kept so this is a drop-in replacement for the old ImageCropDialog. */
  file?: File | Blob | string | null;
  title?: string;
  /** Fixed crop aspect ratio (width / height). Undefined = free-form. */
  aspect?: number;
  /** When true, hides the "Свободно" option and keeps `aspect` fixed. */
  lockAspect?: boolean;
  /** Initial mask/shape. */
  shape?: PhotoShape;
  /** When true, hides the shape switcher entirely. */
  lockShape?: boolean;
  outputWidth?: number;
  outputHeight?: number;
  outputMime?: "image/jpeg" | "image/png";
  onCancel: () => void;
  onSave?: (blob: Blob) => void;
  /** Legacy alias for `onSave`. */
  onCropped?: (blob: Blob) => void;
  onDelete?: () => void;
  /** VK-style mobile/desktop safe-zone guides for banners and covers. */
  safeZonePreset?: SafeZonePreset;
}

const SHAPES: { value: PhotoShape; labelKey: string; hintKey: string; icon: typeof Square }[] = [
  { value: "free", labelKey: "components.photoEditor.shapeFree", hintKey: "components.photoEditor.shapeFreeHint", icon: RectangleHorizontal },
  { value: "rect", labelKey: "components.photoEditor.shapeRect", hintKey: "components.photoEditor.shapeRectHint", icon: Square },
  { value: "rounded", labelKey: "components.photoEditor.shapeRounded", hintKey: "components.photoEditor.shapeRoundedHint", icon: SquareRoundCorner },
  { value: "circle", labelKey: "components.photoEditor.shapeCircle", hintKey: "components.photoEditor.shapeCircleHint", icon: Circle },
];

/**
 * Full-screen (90vw × 90vh) photo editor: crop/zoom/rotate/flip/resize via
 * Cropper.js, plus a custom effects (filters) and shape-mask layer baked in
 * on save. Drop-in replacement for the old pan/zoom-only ImageCropDialog.
 */
export function PhotoEditorDialog({
  open,
  src,
  file,
  title = "Редактирование фото",
  aspect,
  lockAspect = false,
  shape = "free",
  lockShape = false,
  outputWidth,
  outputHeight,
  outputMime = "image/jpeg",
  onCancel,
  onSave,
  onCropped,
  onDelete,
  safeZonePreset,
}: PhotoEditorDialogProps) {
  const { t } = useTranslation();
  const resolvedSrc = src ?? file ?? null;
  const isOpen = open ?? resolvedSrc != null;
  const emitSave = (blob: Blob) => {
    onSave?.(blob);
    onCropped?.(blob);
  };
  const isBannerEditor = safeZonePreset === "feed-banner";
  const effectiveAspect = isBannerEditor ? BANNER_ASPECT : aspect;
  const effectiveLockAspect = lockAspect || isBannerEditor;
  const effectiveLockShape = lockShape || isBannerEditor;
  const exportWidth = outputWidth ?? (isBannerEditor ? BANNER_EXPORT_WIDTH : undefined);
  const exportHeight = outputHeight ?? (isBannerEditor ? BANNER_EXPORT_HEIGHT : undefined);

  const imgRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const containerElRef = useRef<HTMLElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const [tab, setTab] = useState<"crop" | "effects">("crop");
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [flipX, setFlipX] = useState(1);
  const [flipY, setFlipY] = useState(1);
  const [shapeState, setShapeState] = useState<PhotoShape>(shape);
  const [effects, setEffects] = useState<PhotoEffects>(DEFAULT_EFFECTS);
  const [saving, setSaving] = useState(false);
  const [activeCropper, setActiveCropper] = useState<Cropper | null>(null);
  const [activeContainer, setActiveContainer] = useState<HTMLElement | null>(null);
  const [overlayTick, setOverlayTick] = useState(0);
  const [interactionMode, setInteractionMode] = useState<CropInteractionMode>("pan");
  const [cropBoxSize, setCropBoxSize] = useState<{ width: number; height: number } | null>(null);

  const syncCropMetrics = () => {
    const cropper = cropperRef.current;
    if (!cropper) return;
    const data = cropper.getData(true);
    if (data.width > 0 && data.height > 0) {
      setCropBoxSize({ width: Math.round(data.width), height: Math.round(data.height) });
    }
    setOverlayTick((n) => n + 1);
  };

  // Resolve whatever source we were given into a same-origin blob: URL.
  useEffect(() => {
    if (!isOpen || !resolvedSrc) {
      setLocalUrl(null);
      return;
    }
    let cancelled = false;
    setReady(false);
    setLoadError(false);
    resolveToBlobUrl(resolvedSrc)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = url;
        setLocalUrl(url);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resolvedSrc]);

  // Reset editor state whenever a new image is loaded.
  useEffect(() => {
    if (!localUrl) return;
    setZoom(1);
    setFlipX(1);
    setFlipY(1);
    setShapeState(shape);
    setEffects(DEFAULT_EFFECTS);
    setTab("crop");
    setInteractionMode("pan");
    setCropBoxSize(null);
  }, [localUrl, shape]);

  // Mount/destroy the Cropper.js instance against the resolved image.
  useEffect(() => {
    if (!localUrl || !imgRef.current) return;
    const img = imgRef.current;
    const initialAspect = shapeState === "circle" ? 1 : effectiveAspect;
    const cropper = new Cropper(img, {
      aspectRatio: initialAspect,
      viewMode: isBannerEditor ? 1 : 0,
      dragMode: interactionMode === "pan" ? "move" : "crop",
      autoCropArea: isBannerEditor ? 1 : 0.85,
      background: false,
      guides: true,
      center: true,
      responsive: true,
      movable: true,
      zoomable: true,
      zoomOnWheel: true,
      cropBoxMovable: true,
      cropBoxResizable: !effectiveLockAspect,
      toggleDragModeOnDblclick: false,
      ready() {
        const container = (img.nextElementSibling as HTMLElement) ?? null;
        containerElRef.current = container;
        setActiveContainer(container);
        setActiveCropper(cropper);
        if (effectiveAspect) {
          cropper.setAspectRatio(initialAspect ?? NaN);
        }
        syncCropMetrics();
        setReady(true);
      },
      crop() {
        syncCropMetrics();
      },
      cropmove() {
        syncCropMetrics();
      },
      zoom(event) {
        setZoom(event.detail.ratio);
        syncCropMetrics();
      },
    });
    cropperRef.current = cropper;
    return () => {
      cropper.destroy();
      cropperRef.current = null;
      containerElRef.current = null;
      setActiveCropper(null);
      setActiveContainer(null);
      setReady(false);
      setCropBoxSize(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localUrl, isBannerEditor, effectiveAspect]);

  useEffect(() => {
    if (!ready || !cropperRef.current) return;
    cropperRef.current.setDragMode(interactionMode === "pan" ? "move" : "crop");
  }, [interactionMode, ready]);

  // Live filter preview — applied to the whole cropper container (canvas +
  // crop box), baked into the actual pixels only on save.
  useEffect(() => {
    if (containerElRef.current) {
      containerElRef.current.style.filter = effectsToCssFilter(effects);
    }
  }, [effects, ready]);

  // Round-preview: visually previews a circle mask on the crop box itself
  // (Cropper.js has no native shape option — this is the standard CSS trick).
  useEffect(() => {
    containerElRef.current?.classList.toggle("pe-round-mask", shapeState === "circle");
  }, [shapeState, ready]);

  // Revoke the last blob URL on unmount.
  useEffect(
    () => () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    },
    [],
  );

  const rotate = (deg: number) => cropperRef.current?.rotate(deg);

  const toggleFlipX = () => {
    const next = flipX * -1;
    setFlipX(next);
    cropperRef.current?.scaleX(next);
  };
  const toggleFlipY = () => {
    const next = flipY * -1;
    setFlipY(next);
    cropperRef.current?.scaleY(next);
  };

  const applyZoom = (value: number) => {
    setZoom(value);
    cropperRef.current?.zoomTo(value);
    syncCropMetrics();
  };

  const setPanMode = () => setInteractionMode("pan");
  const setFrameMode = () => setInteractionMode("frame");

  const changeShape = (next: PhotoShape) => {
    setShapeState(next);
    if (next === "circle") {
      cropperRef.current?.setAspectRatio(1);
    } else if (!effectiveLockAspect) {
      cropperRef.current?.setAspectRatio(effectiveAspect ?? NaN);
    }
  };

  const reset = () => {
    cropperRef.current?.reset();
    setZoom(1);
    setFlipX(1);
    setFlipY(1);
    setEffects(DEFAULT_EFFECTS);
    setShapeState(shape);
    setInteractionMode("pan");
    syncCropMetrics();
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleDelete = () => {
    if (!onDelete) return;
    if (!window.confirm("Удалить это фото?")) return;
    onDelete();
  };

  const handleSave = async () => {
    const cropper = cropperRef.current;
    if (!cropper) return;
    setSaving(true);
    try {
      const canvas = cropper.getCroppedCanvas({
        width: exportWidth,
        height: exportHeight,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
        fillColor: outputMime === "image/png" ? undefined : "#ffffff",
      });
      const finalCanvas = applyEffectsAndShape(canvas, effects, shapeState);
      const mime = shapeState === "circle" || shapeState === "rounded" ? "image/png" : outputMime;
      const blob = await canvasToBlob(finalCanvas, mime, 0.92);
      emitSave(blob);
    } catch {
      toast.error("Не удалось сохранить изображение");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <DialogContent
        className="!flex h-[90vh] w-[90vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-[var(--r-card)]"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="shrink-0 border-b px-[20px] py-[14px]" style={{ borderColor: "var(--border)" }}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
            style={{ background: "#111114" }}
          >
            {loadError ? (
              <p className="px-[24px] text-center text-[13px]" style={{ color: "#fff" }}>
                Не удалось загрузить фото для редактирования. Попробуйте выбрать файл заново.
              </p>
            ) : !localUrl ? (
              <Loader2 className="h-8 w-8 animate-spin text-white/70" />
            ) : (
              <>
                {!ready && (
                  <div className="absolute inset-0 z-10 grid place-items-center" style={{ background: "#111114" }}>
                    <Loader2 className="h-8 w-8 animate-spin text-white/70" />
                  </div>
                )}
                <div className="relative h-full min-h-[280px] w-full [&_.cropper-container]:!max-h-full">
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <img ref={imgRef} src={localUrl} width={1200} height={900} loading="lazy" decoding="async" className="block max-w-full" style={{ maxHeight: "min(70vh, 720px)" }} />
                  {safeZonePreset && (
                    <CropSafeZoneOverlay
                      cropper={activeCropper}
                      container={activeContainer}
                      preset={safeZonePreset}
                      enabled={ready && tab === "crop"}
                      syncTrigger={overlayTick}
                    />
                  )}
                </div>
                <style>{`
                  .pe-round-mask .cropper-view-box,
                  .pe-round-mask .cropper-face {
                    border-radius: 50%;
                  }
                `}</style>
              </>
            )}
          </div>

          <div
            className="flex w-full shrink-0 flex-col overflow-y-auto border-t md:h-full md:w-[340px] md:border-l md:border-t-0"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          >
            <Tabs value={tab} onValueChange={(v) => setTab(v as "crop" | "effects")} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="shrink-0 px-[16px]">
                <TabsTrigger value="crop">Обрезка</TabsTrigger>
                <TabsTrigger value="effects">Эффекты</TabsTrigger>
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto px-[20px] py-[18px]">
                <TabsContent value="crop" className="mt-0 space-y-[18px]">
                  <div className="space-y-[8px]">
                    <span className="text-[12px] font-medium" style={{ color: "var(--foreground-70)" }}>
                      {t("components.photoEditor.interactionTitle")}
                    </span>
                    <div className="grid grid-cols-2 gap-[8px]">
                      <button
                        type="button"
                        onClick={setPanMode}
                        disabled={!ready}
                        className="flex items-center gap-[8px] rounded-[var(--r-card-sm)] border px-[12px] py-[10px] text-left text-[12px] transition-colors disabled:opacity-50"
                        style={{
                          borderColor: interactionMode === "pan" ? "var(--accent)" : "var(--border)",
                          background: interactionMode === "pan" ? "var(--accent-soft)" : "transparent",
                          color: interactionMode === "pan" ? "var(--accent)" : "var(--foreground-70)",
                        }}
                      >
                        <Hand className="h-[16px] w-[16px] shrink-0" />
                        <span>
                          <span className="block font-semibold">{t("components.photoEditor.modePan")}</span>
                          <span className="block text-[10px] opacity-80">{t("components.photoEditor.modePanHint")}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={setFrameMode}
                        disabled={!ready}
                        className="flex items-center gap-[8px] rounded-[var(--r-card-sm)] border px-[12px] py-[10px] text-left text-[12px] transition-colors disabled:opacity-50"
                        style={{
                          borderColor: interactionMode === "frame" ? "var(--accent)" : "var(--border)",
                          background: interactionMode === "frame" ? "var(--accent-soft)" : "transparent",
                          color: interactionMode === "frame" ? "var(--accent)" : "var(--foreground-70)",
                        }}
                      >
                        <Crop className="h-[16px] w-[16px] shrink-0" />
                        <span>
                          <span className="block font-semibold">{t("components.photoEditor.modeFrame")}</span>
                          <span className="block text-[10px] opacity-80">{t("components.photoEditor.modeFrameHint")}</span>
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-[8px]">
                    <Button type="button" variant="outline" size="icon" onClick={() => rotate(-90)} title="Повернуть влево" disabled={!ready}>
                      <RotateCcw />
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => rotate(90)} title="Повернуть вправо" disabled={!ready}>
                      <RotateCw />
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={toggleFlipX} title="Отразить по горизонтали" disabled={!ready}>
                      <FlipHorizontal2 />
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={toggleFlipY} title="Отразить по вертикали" disabled={!ready}>
                      <FlipVertical2 />
                    </Button>
                  </div>

                  <div className="space-y-[8px]">
                    <div className="flex items-center justify-between text-[12px] font-medium" style={{ color: "var(--foreground-70)" }}>
                      <span>Масштаб</span>
                      <span>{Math.round(zoom * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-[10px]">
                      <ZoomOut className="h-[16px] w-[16px] shrink-0" style={{ color: "var(--foreground-50)" }} />
                      <Slider
                        value={[zoom]}
                        min={0.1}
                        max={3}
                        step={0.01}
                        onValueChange={([v]) => applyZoom(v)}
                        disabled={!ready}
                      />
                      <ZoomIn className="h-[16px] w-[16px] shrink-0" style={{ color: "var(--foreground-50)" }} />
                    </div>
                  </div>

                  {!effectiveLockShape && (
                    <div className="space-y-[8px]">
                      <div>
                        <span className="text-[12px] font-medium" style={{ color: "var(--foreground-70)" }}>
                          {t("components.photoEditor.shapeTitle")}
                        </span>
                        <p className="mt-[4px] text-[10px] leading-snug" style={{ color: "var(--foreground-50)" }}>
                          {t("components.photoEditor.shapeSectionHint")}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-[6px]">
                        {SHAPES.map(({ value, labelKey, hintKey, icon: Icon }) => (
                          <button
                            key={value}
                            type="button"
                            title={t(hintKey)}
                            onClick={() => changeShape(value)}
                            disabled={!ready}
                            className="flex flex-col items-start gap-[2px] rounded-[var(--r-card-sm)] border px-[10px] py-[8px] text-left text-[10px] transition-colors"
                            style={{
                              borderColor: shapeState === value ? "var(--accent)" : "var(--border)",
                              color: shapeState === value ? "var(--accent)" : "var(--foreground-70)",
                              background: shapeState === value ? "var(--accent-soft)" : "transparent",
                            }}
                          >
                            <span className="flex items-center gap-[6px] font-semibold">
                              <Icon className="h-[16px] w-[16px]" />
                              {t(labelKey)}
                            </span>
                            <span className="opacity-75">{t(hintKey)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className="rounded-[var(--r-card-sm)] border px-[12px] py-[10px] space-y-[8px]"
                    style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
                  >
                    {exportWidth && exportHeight && (
                      <div className="flex items-center justify-between text-[12px]">
                        <span style={{ color: "var(--foreground-50)" }}>{t("components.photoEditor.exportSize")}</span>
                        <span className="font-mono font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                          {exportWidth} × {exportHeight} px
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[12px]">
                      <span style={{ color: "var(--foreground-50)" }}>{t("components.photoEditor.cropBoxSize")}</span>
                      <span className="font-mono font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                        {cropBoxSize ? `${cropBoxSize.width} × ${cropBoxSize.height} px` : "—"}
                      </span>
                    </div>
                    {effectiveLockAspect && effectiveAspect && (
                      <div className="flex items-center justify-between text-[12px]">
                        <span style={{ color: "var(--foreground-50)" }}>{t("components.photoEditor.aspectLocked")}</span>
                        <span className="font-mono tabular-nums" style={{ color: "var(--foreground-70)" }}>
                          {effectiveAspect.toFixed(2)}:1
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: "var(--foreground-50)" }}>
                    {interactionMode === "pan"
                      ? t("components.photoEditor.helpPan")
                      : t("components.photoEditor.helpFrame")}
                  </p>
                  {safeZonePreset && (
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--foreground-50)" }}>
                      {t("components.photoEditor.safeZoneHint")}
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="effects" className="mt-0 space-y-[18px]">
                  <EffectSlider
                    label="Яркость"
                    value={effects.brightness}
                    onChange={(v) => setEffects((e) => ({ ...e, brightness: v }))}
                    disabled={!ready}
                  />
                  <EffectSlider
                    label="Контраст"
                    value={effects.contrast}
                    onChange={(v) => setEffects((e) => ({ ...e, contrast: v }))}
                    disabled={!ready}
                  />
                  <EffectSlider
                    label="Насыщенность"
                    value={effects.saturation}
                    onChange={(v) => setEffects((e) => ({ ...e, saturation: v }))}
                    disabled={!ready}
                  />
                  <div className="space-y-[8px]">
                    <div className="flex items-center justify-between text-[12px] font-medium" style={{ color: "var(--foreground-70)" }}>
                      <span>Размытие</span>
                      <span>{effects.blur} px</span>
                    </div>
                    <Slider
                      value={[effects.blur]}
                      min={0}
                      max={8}
                      step={0.5}
                      onValueChange={([v]) => setEffects((e) => ({ ...e, blur: v }))}
                      disabled={!ready}
                    />
                  </div>
                  <div className="flex gap-[8px]">
                    <ToggleChip
                      label="Ч/б"
                      active={effects.grayscale}
                      onClick={() => setEffects((e) => ({ ...e, grayscale: !e.grayscale, sepia: false }))}
                      disabled={!ready}
                    />
                    <ToggleChip
                      label="Сепия"
                      active={effects.sepia}
                      onClick={() => setEffects((e) => ({ ...e, sepia: !e.sepia, grayscale: false }))}
                      disabled={!ready}
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <div className="flex shrink-0 flex-col gap-[10px] border-t px-[20px] py-[16px]" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between gap-[10px]">
                <Button type="button" variant="ghost" onClick={reset} disabled={!ready || saving}>
                  Сбросить
                </Button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="inline-flex items-center gap-[6px] text-[13px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ color: "var(--error)" }}
                  >
                    <Trash2 className="h-[16px] w-[16px]" />
                    Удалить
                  </button>
                )}
              </div>
              <div className="flex items-center justify-end gap-[8px]">
                <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
                  Отмена
                </Button>
                <Button type="button" onClick={handleSave} disabled={!ready || saving} loading={saving}>
                  {saving ? "Сохранение…" : "Сохранить"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EffectSlider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-[8px]">
      <div className="flex items-center justify-between text-[12px] font-medium" style={{ color: "var(--foreground-70)" }}>
        <span>{label}</span>
        <span>{value > 0 ? `+${value}` : value}</span>
      </div>
      <Slider value={[value]} min={-100} max={100} step={1} onValueChange={([v]) => onChange(v)} disabled={disabled} />
    </div>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[var(--r-pill)] border px-[14px] py-[7px] text-[13px] font-medium transition-colors disabled:opacity-50"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        color: active ? "var(--accent)" : "var(--foreground-70)",
        background: active ? "var(--accent-soft)" : "transparent",
      }}
    >
      {label}
    </button>
  );
}
