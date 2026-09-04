export type MediaVariantUrls = {
  /** Best-first: AVIF is only present when the backend measured it smaller than the WebP. */
  avif?: string;
  webp?: string;
  jpeg?: string;
};

export type MediaVariantSet = {
  thumb?: MediaVariantUrls;
  card?: MediaVariantUrls;
  medium?: MediaVariantUrls;
  large?: MediaVariantUrls;
};

export type DisplayMedia = {
  url: string;
  variants?: MediaVariantSet | null;
};

const WIDTH: Record<keyof MediaVariantSet, number> = {
  thumb: 320,
  card: 640,
  medium: 1080,
  large: 1600,
};

export function toDisplayMedia(
  url: string | null | undefined,
  variants?: MediaVariantSet | null,
): DisplayMedia | null {
  if (!url) return null;
  return { url, variants: variants ?? undefined };
}

export function displaySrc(media: DisplayMedia, preferred: keyof MediaVariantSet = "card"): string {
  const slot = media.variants?.[preferred];
  return slot?.webp ?? slot?.jpeg ?? media.url;
}

/** Formats offered as <source> elements, most efficient first. */
export const PICTURE_FORMATS = ["avif", "webp", "jpeg"] as const;
export type PictureFormat = (typeof PICTURE_FORMATS)[number];

export const PICTURE_MIME: Record<PictureFormat, string> = {
  avif: "image/avif",
  webp: "image/webp",
  jpeg: "image/jpeg",
};

export function pictureSrcSet(
  media: DisplayMedia,
  names: Array<keyof MediaVariantSet>,
): { sources: Array<{ format: PictureFormat; type: string; srcSet: string }>; src: string } {
  const parts: Record<PictureFormat, string[]> = { avif: [], webp: [], jpeg: [] };

  for (const name of names) {
    const slot = media.variants?.[name];
    if (!slot) continue;
    for (const format of PICTURE_FORMATS) {
      const url = slot[format];
      if (url) parts[format].push(`${url} ${WIDTH[name]}w`);
    }
  }

  const last = names[names.length - 1];
  const src =
    media.variants?.[last]?.jpeg ??
    media.variants?.[last]?.webp ??
    media.variants?.[names[0]]?.jpeg ??
    media.variants?.[names[0]]?.webp ??
    media.url;

  return {
    sources: PICTURE_FORMATS.filter((f) => parts[f].length > 0).map((format) => ({
      format,
      type: PICTURE_MIME[format],
      srcSet: parts[format].join(", "),
    })),
    src,
  };
}

/**
 * The media proxy answers `/api/v1/media/<uuid>/<name>.webp` with the variant
 * when it exists and with the original when it does not — verified on
 * production against a file that has no variants, which came back 200 with the
 * original bytes. So a derived variant URL is always safe, and callers that
 * only ever received a bare URL (avatars, banners) can ask for the size they
 * actually display without the payload having to carry a variant map.
 */
const MEDIA_PROXY = /\/api\/v1\/media\/[0-9a-f-]{36}$/i;

export function variantUrl(
  url: string | null | undefined,
  name: keyof MediaVariantSet,
  format: "webp" | "jpg" = "webp",
): string {
  if (!url) return "";
  return MEDIA_PROXY.test(url) ? `${url}/${name}.${format}` : url;
}

/** Width-descriptor srcset over derived variant URLs, for the same callers. */
export function derivedSrcSet(
  url: string | null | undefined,
  names: Array<keyof MediaVariantSet>,
): string | undefined {
  if (!url || !MEDIA_PROXY.test(url)) return undefined;
  return names.map((name) => `${variantUrl(url, name)} ${WIDTH[name]}w`).join(", ");
}
