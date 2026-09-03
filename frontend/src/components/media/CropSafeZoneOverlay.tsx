import { useCallback, useEffect, useState, type ReactNode } from "react";
import type Cropper from "cropperjs";
import { useTranslation } from "react-i18next";
import {
  getSafeZoneRects,
  type SafeZonePreset,
  type VisibleRect,
} from "@/lib/photo-editor-safe-zones";

interface OverlayBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  cropper: Cropper | null;
  container: HTMLElement | null;
  preset: SafeZonePreset;
  enabled: boolean;
  syncTrigger?: number;
}

function pct(value: number): string {
  return `${value * 100}%`;
}

function ZoneLabel({ text, style }: { text: string; style: React.CSSProperties }) {
  return (
    <span
      className="pointer-events-none absolute z-[3] max-w-[min(100%,220px)] rounded-[4px] px-[8px] py-[4px] text-[11px] font-medium leading-snug text-white"
      style={{
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)",
        ...style,
      }}
    >
      {text}
    </span>
  );
}

function DimBands({
  box,
  mobile,
  desktop,
}: {
  box: OverlayBox;
  mobile: VisibleRect;
  desktop: VisibleRect;
}) {
  const dim = "rgba(0,0,0,0.55)";
  const bands: ReactNode[] = [];

  // Outside desktop visible area (top / bottom).
  if (desktop.top > 0) {
    bands.push(
      <div
        key="d-top"
        className="pointer-events-none absolute z-[1]"
        style={{
          left: 0,
          top: 0,
          width: box.width,
          height: desktop.top * box.height,
          background: dim,
        }}
      />,
    );
  }
  if (desktop.top + desktop.height < 1) {
    bands.push(
      <div
        key="d-bottom"
        className="pointer-events-none absolute z-[1]"
        style={{
          left: 0,
          top: (desktop.top + desktop.height) * box.height,
          width: box.width,
          height: (1 - desktop.top - desktop.height) * box.height,
          background: dim,
        }}
      />,
    );
  }

  // Outside mobile visible area (left / right) — full crop height.
  if (mobile.left > 0) {
    bands.push(
      <div
        key="m-left"
        className="pointer-events-none absolute z-[2]"
        style={{
          left: 0,
          top: 0,
          width: mobile.left * box.width,
          height: box.height,
          background: dim,
        }}
      />,
    );
  }
  if (mobile.left + mobile.width < 1) {
    bands.push(
      <div
        key="m-right"
        className="pointer-events-none absolute z-[2]"
        style={{
          left: (mobile.left + mobile.width) * box.width,
          top: 0,
          width: (1 - mobile.left - mobile.width) * box.width,
          height: box.height,
          background: dim,
        }}
      />,
    );
  }

  return <>{bands}</>;
}

function ZoneOutline({
  rect,
  box,
  dashed,
}: {
  rect: VisibleRect;
  box: OverlayBox;
  dashed?: boolean;
}) {
  return (
    <div
      className="pointer-events-none absolute z-[3]"
      style={{
        left: rect.left * box.width,
        top: rect.top * box.height,
        width: rect.width * box.width,
        height: rect.height * box.height,
        border: dashed ? "1px dashed rgba(255,255,255,0.85)" : "2px solid rgba(255,255,255,0.95)",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
      }}
    />
  );
}

/**
 * VK-style safe-zone guides over Cropper.js — shows mobile/desktop visible
 * regions for object-cover banners and covers.
 */
export function CropSafeZoneOverlay({
  cropper,
  container,
  preset,
  enabled,
  syncTrigger = 0,
}: Props) {
  const { t } = useTranslation();
  const [box, setBox] = useState<OverlayBox | null>(null);
  const [zones, setZones] = useState<ReturnType<typeof getSafeZoneRects> | null>(null);

  const sync = useCallback(() => {
    if (!enabled || !cropper || !container) {
      setBox(null);
      setZones(null);
      return;
    }
    const cropEl = container.querySelector(".cropper-crop-box") as HTMLElement | null;
    if (!cropEl) return;

    const cRect = container.getBoundingClientRect();
    const bRect = cropEl.getBoundingClientRect();
    if (bRect.width < 8 || bRect.height < 8) return;

    const data = cropper.getData(true);
    const cropAspect = data.width / data.height;
    setBox({
      left: bRect.left - cRect.left,
      top: bRect.top - cRect.top,
      width: bRect.width,
      height: bRect.height,
    });
    setZones(getSafeZoneRects(preset, cropAspect));
  }, [container, cropper, enabled, preset]);

  useEffect(() => {
    if (!enabled || !cropper || !container) return;
    sync();

    const onChange = () => sync();
    container.addEventListener("crop", onChange);
    container.addEventListener("cropmove", onChange);
    container.addEventListener("cropend", onChange);
    container.addEventListener("zoom", onChange);

    const ro = new ResizeObserver(onChange);
    ro.observe(container);

    return () => {
      container.removeEventListener("crop", onChange);
      container.removeEventListener("cropmove", onChange);
      container.removeEventListener("cropend", onChange);
      container.removeEventListener("zoom", onChange);
      ro.disconnect();
    };
  }, [container, cropper, enabled, sync]);

  useEffect(() => {
    sync();
  }, [sync, syncTrigger]);

  if (!enabled || !box || !zones) return null;

  return (
    <div
      className="pointer-events-none absolute z-[20]"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    >
      <DimBands
        box={{ left: 0, top: 0, width: box.width, height: box.height }}
        mobile={zones.mobile}
        desktop={zones.desktop}
      />
      <ZoneOutline
        rect={zones.desktop}
        box={{ left: 0, top: 0, width: box.width, height: box.height }}
      />
      <ZoneOutline
        rect={zones.mobile}
        box={{ left: 0, top: 0, width: box.width, height: box.height }}
        dashed
      />
      {zones.safe.width > 0.05 && zones.safe.height > 0.05 && (
        <ZoneOutline
          rect={zones.safe}
          box={{ left: 0, top: 0, width: box.width, height: box.height }}
          dashed
        />
      )}
      <ZoneLabel
        text={t("components.photoEditor.safeZoneMobile")}
        style={{
          left: "50%",
          top: pct(Math.max(zones.mobile.top + 0.02, 0.02)),
          transform: "translateX(-50%)",
          maxWidth: "92%",
          textAlign: "center",
        }}
      />
      <ZoneLabel
        text={t("components.photoEditor.safeZoneDesktop")}
        style={{
          left: "50%",
          bottom: pct(Math.max(1 - zones.desktop.top - zones.desktop.height + 0.02, 0.02)),
          top: "auto",
          transform: "translateX(-50%)",
          maxWidth: "92%",
          textAlign: "center",
        }}
      />
    </div>
  );
}
