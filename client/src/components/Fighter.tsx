import { useMemo } from 'react';
import type { Look } from '@holla/shared';
import { headIcon, teamColour } from '../art/fighter';
import { drawFighter } from '../art/fighter';
import { useCanvas } from '../lib/canvas';
import './Fighter.css';

type HeadProps = {
  look: Look;
  /** Seat index, for the jersey colour behind the head. */
  seat?: number;
  /** CSS size. The raster is twice this, so it stays sharp. */
  size?: number;
  className?: string;
  alt?: string;
};

/**
 * A player's head as an `<img>`, for everywhere the old emoji avatar was.
 *
 * Rasterised once per look and cached, so a lobby of 15 costs 15 small
 * canvases for the whole session rather than one per render.
 */
export function Head({ look, seat = 0, size = 44, className, alt = '' }: HeadProps) {
  const src = useMemo(
    () => headIcon(look, teamColour(seat), Math.round(size * 2)),
    [look, seat, size],
  );
  return (
    <img
      className={['fighter-head', className].filter(Boolean).join(' ')}
      src={src}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
    />
  );
}

type FullProps = { look: Look; seat?: number; height?: number; moving?: boolean };

/**
 * The whole fighter, standing and blinking. Live canvas rather than a raster
 * because the picker wants to show the headband flutter and the idle blink —
 * it is the only place the figure is big enough to notice them.
 */
export function FighterPreview({ look, seat = 0, height = 150, moving = false }: FullProps) {
  const ref = useCanvas(({ ctx, width, height: h, time }) => {
    // the figure is ~62 units tall with its feet at the origin
    const scale = (h * 0.82) / 62;
    ctx.save();
    ctx.translate(width / 2, h * 0.93);
    ctx.beginPath();
    ctx.ellipse(0, 2, 20 * scale, 6 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(14,10,46,.22)';
    ctx.fill();
    ctx.scale(scale, scale);
    drawFighter(ctx, look, {
      team: seat,
      fx: 0,
      fy: 1,
      walk: time * 9,
      moving,
      punching: false,
      stunned: false,
      hurt: false,
      blink: (time * 1000) % 3400 < 140,
      t: time,
      num: seat + 1,
    });
    ctx.restore();
  });

  return (
    <canvas
      ref={ref}
      className="fighter-preview"
      style={{ ['--h' as string]: `${height}px` }}
    />
  );
}
