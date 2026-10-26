/**
 * The canvas palette.
 *
 * Literal hexes rather than `token()` reads: these are wanted hundreds of
 * times per frame and `getComputedStyle` is not free. They are the same values
 * as `styles/tokens.css`, which stays the thing the DOM uses.
 */
export const INK = '#0E0A2E';
export const PAPER = '#FFF4DC';
export const PAPER_2 = '#F1E0B8';
export const RED = '#FF4D4D';
export const SUN = '#FFC21A';
export const MINT = '#22C97A';
export const SKY = '#2F8BFF';
export const PINK = '#FF5FA8';
export const PURPLE = '#B48CFF';
export const ORANGE = '#FF9F45';
export const TEAL = '#5FD3E8';

/** Fill, then outline in ink — the sticker look, in one call. */
export function blob(ctx: CanvasRenderingContext2D, fill: string, lineWidth = 3): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** Lighten (positive) or darken (negative) a `#rrggbb` by a fraction. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * (1 + amount));
  const g = clamp(((n >> 8) & 255) * (1 + amount));
  const b = clamp((n & 255) * (1 + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
