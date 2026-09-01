export type MediaVariantUrls = {
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

export function pictureSrcSet(
  media: DisplayMedia,
  names: Array<keyof MediaVariantSet>,
): { webp?: string; jpeg?: string; src: string } {
  const webpParts: string[] = [];
  const jpegParts: string[] = [];

  for (const name of names) {
    const slot = media.variants?.[name];
    if (slot?.webp) webpParts.push(`${slot.webp} ${WIDTH[name]}w`);
    if (slot?.jpeg) jpegParts.push(`${slot.jpeg} ${WIDTH[name]}w`);
  }

  const last = names[names.length - 1];
  const src =
    media.variants?.[last]?.jpeg ??
    media.variants?.[last]?.webp ??
    media.variants?.[names[0]]?.jpeg ??
    media.variants?.[names[0]]?.webp ??
    media.url;

  return {
    webp: webpParts.length ? webpParts.join(", ") : undefined,
    jpeg: jpegParts.length ? jpegParts.join(", ") : undefined,
    src,
  };
}
