/** How a saved image is displayed with `object-cover` in a viewport. */
export type SafeZonePreset = "feed-banner" | "cover-wide" | "review-cover";

export interface VisibleRect {
  /** Fractions relative to the cropped image (0–1). */
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Visible region when an image is scaled with object-cover inside a container. */
export function objectCoverVisibleRect(imageAspect: number, containerAspect: number): VisibleRect {
  if (!Number.isFinite(imageAspect) || imageAspect <= 0) {
    return { left: 0, top: 0, width: 1, height: 1 };
  }
  if (imageAspect > containerAspect) {
    const width = containerAspect / imageAspect;
    return { left: (1 - width) / 2, top: 0, width, height: 1 };
  }
  const height = imageAspect / containerAspect;
  return { left: 0, top: (1 - height) / 2, width: 1, height };
}

const PRESETS: Record<
  SafeZonePreset,
  { mobileAspect: number; desktopAspect: number }
> = {
  /** Feed hero slider — `BannerHeroSlide` heights 200–240px, full width. */
  "feed-banner": {
    mobileAspect: 375 / 200,
    desktopAspect: 1200 / 240,
  },
  /** Community / channel cover — `min(220px, 38vw)` height, full width. */
  "cover-wide": {
    mobileAspect: 375 / 142.5,
    desktopAspect: 1200 / 220,
  },
  /** Review poster — card 16:9 + hero carousel 16:7 on desktop. */
  "review-cover": {
    mobileAspect: 16 / 9,
    desktopAspect: 16 / 7,
  },
};

export function getSafeZoneRects(
  preset: SafeZonePreset,
  cropAspect: number,
): { mobile: VisibleRect; desktop: VisibleRect; safe: VisibleRect } {
  const { mobileAspect, desktopAspect } = PRESETS[preset];
  const mobile = objectCoverVisibleRect(cropAspect, mobileAspect);
  const desktop = objectCoverVisibleRect(cropAspect, desktopAspect);

  const safeLeft = Math.max(mobile.left, desktop.left);
  const safeTop = Math.max(mobile.top, desktop.top);
  const safeRight = Math.min(mobile.left + mobile.width, desktop.left + desktop.width);
  const safeBottom = Math.min(mobile.top + mobile.height, desktop.top + desktop.height);

  return {
    mobile,
    desktop,
    safe: {
      left: safeLeft,
      top: safeTop,
      width: Math.max(0, safeRight - safeLeft),
      height: Math.max(0, safeBottom - safeTop),
    },
  };
}
