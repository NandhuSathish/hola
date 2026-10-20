import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from './motion';

/**
 * A device-pixel-aware canvas with a render loop tied to the component.
 *
 * Shared by the games that draw a board, so each one only writes its own
 * `draw`. It handles the three things that are easy to get wrong:
 *
 * - **Device pixel ratio.** The backing store is sized in device pixels and
 *   the context is scaled, so lines stay crisp on a phone.
 * - **Visibility.** A hidden page stops compositing and its animation
 *   timelines freeze, so the loop pauses rather than burning a frame budget
 *   it will never be given.
 * - **Reduced motion.** `animated` is false, and the game is expected to draw
 *   a correct still frame rather than skip drawing.
 */
export type DrawContext = {
  ctx: CanvasRenderingContext2D;
  /** CSS pixels, not device pixels. */
  width: number;
  height: number;
  /** Seconds since the loop started. Frozen under reduced motion. */
  time: number;
  /** Seconds since the previous frame, clamped so a background tab cannot jump. */
  delta: number;
  animated: boolean;
};

export function useCanvas(
  draw: (frame: DrawContext) => void,
  { square = false }: { square?: boolean } = {},
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let running = true;
    let started: number | null = null;
    let previous = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = rect.width;
      const height = square ? rect.width : rect.height;
      if (width === 0 || height === 0) return null;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      if (square) canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width, height };
    };

    const tick = (now: number) => {
      if (!running) return;
      frame = requestAnimationFrame(tick);

      const size = resize();
      if (!size) return;

      if (started === null) {
        started = now;
        previous = now;
      }
      // A tab that was hidden comes back with a huge gap; clamp it so nothing
      // integrates a half-second step in one frame.
      const delta = Math.min(0.05, (now - previous) / 1000);
      previous = now;

      ctx.clearRect(0, 0, size.width, size.height);
      drawRef.current({
        ctx,
        width: size.width,
        height: size.height,
        time: reduced ? 0 : (now - started) / 1000,
        delta: reduced ? 0 : delta,
        animated: !reduced,
      });
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
        return;
      }
      // Always re-arm on becoming visible. A page that was hidden when this
      // mounted never ran its first frame, and checking `running` here would
      // see it still true and leave the loop dead forever.
      running = true;
      previous = performance.now();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced, square]);

  return canvasRef;
}

/** Linear interpolation, the workhorse of every board animation. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Ease-in-out, for travel that should not start and stop abruptly. */
export const ease = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

/** Reads a design token off the document, so canvas matches the CSS palette. */
export function token(name: string, fallback = '#000'): string {
  if (typeof getComputedStyle !== 'function') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Clamp to 0..1, for progress values that may overshoot their window. */
export const c01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
