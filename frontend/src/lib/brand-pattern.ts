/**
 * Brand decorative background: a subtle blueprint / graph-paper grid,
 * evoking assembly drawings — the one visual motif tied to modelism rather
 * than generic SaaS decoration. UI Kit 2.0 neutrals only (--neutral-600
 * #5B6878, --neutral-300 #A8B2C2), 5% stroke-opacity baked into the SVG so
 * every consumer renders identically.
 *
 * Two variants because a data-URI SVG can't read CSS custom properties —
 * the stroke color is picked per background lightness, not per light/dark
 * theme: `OnLight` (darker #5B6878 strokes) for the app's light surfaces,
 * `OnDark` (lighter #A8B2C2 strokes) for inherently dark surfaces like the
 * landing hero.
 */

const TILE = 32;

function gridSvg(stroke: string): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}'><path d='M${TILE} 0H0V${TILE}' fill='none' stroke='${stroke}' stroke-opacity='0.05'/></svg>`;
}

export const blueprintGridOnLight = `url("data:image/svg+xml,${encodeURIComponent(gridSvg("#5B6878"))}")`;
export const blueprintGridOnDark = `url("data:image/svg+xml,${encodeURIComponent(gridSvg("#A8B2C2"))}")`;

/** `background-size` companion — keeps the tile crisp regardless of the
 *  consumer's other `background` shorthand values. */
export const blueprintGridSize = `${TILE}px ${TILE}px`;
