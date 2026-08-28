const cache = new Map<string, number>();

/** Seeded from API dimensions so the feed can size a media box before the
 *  bytes arrive — measuring after load is what causes the layout jump. */
export function rememberMediaAspect(url: string, ratio: number): void {
  if (!Number.isFinite(ratio) || ratio <= 0) return;
  cache.set(url, ratio);
}

export function getMediaAspect(url: string): number | undefined {
  return cache.get(url);
}
