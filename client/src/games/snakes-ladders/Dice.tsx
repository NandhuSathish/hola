import { useEffect, useRef } from 'react';
import { useCanvas } from '../../lib/canvas';
import { INK, PAPER, RED } from '../../art/palette';

/** Pip positions in die-relative units, from the mock. */
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

/** How long a throw tumbles before it settles. */
const ROLL_MS = 850;

type Props = {
  /** What the server says was rolled. A new `seq` throws them again. */
  values: number[];
  seq: number;
  /** True while the roll button is held down. */
  shaking: boolean;
  /** Two dice next turn, so the tray shows two even before the throw. */
  count: number;
};

export function DiceTray({ values, seq, shaking, count }: Props) {
  // The throw is a local animation with its own clock: the server only ever
  // says what came up, never how it should tumble.
  const thrownAt = useRef<number | null>(null);
  const shown = useRef<number[]>(values.length ? values : [1]);
  const playedSeq = useRef(seq);

  useEffect(() => {
    if (seq === playedSeq.current || values.length === 0) return;
    playedSeq.current = seq;
    thrownAt.current = performance.now();
  }, [seq, values]);

  const ref = useCanvas(({ ctx, width, height, time, animated }) => {
    const now = performance.now();
    const throwing = thrownAt.current !== null && now - thrownAt.current < ROLL_MS;
    if (!throwing) {
      thrownAt.current = null;
      shown.current = values.length ? values : shown.current;
    }

    const faces = values.length ? values : shown.current;
    const n = Math.max(count, faces.length, 1);
    const size = Math.min(height * 0.58, width / (n * 1.6));

    for (let i = 0; i < n; i++) {
      let x = width / 2 + (i - (n - 1) / 2) * size * 1.35;
      let y = height / 2;
      let rot = i ? 0.12 : -0.08;
      let value = faces[i] ?? 1;

      if (shaking && animated) {
        x += Math.sin(time * 48 + i) * 7;
        y += Math.cos(time * 41 + i * 2) * 6;
        rot += Math.sin(time * 37 + i) * 0.35;
      }

      if (throwing && animated) {
        const u = Math.max(0, Math.min(1, (now - thrownAt.current!) / ROLL_MS));
        // The face only settles in the last 15% — before that it blurs
        // through the numbers, which is what sells it as a throw.
        value = u < 0.85 ? 1 + Math.floor((time * 14 + i * 3) % 6) : (faces[i] ?? 1);
        rot += (1 - u) * (1 - u) * 12 * (i ? -1 : 1);
        y -= Math.abs(Math.sin(u * Math.PI * 3)) * (1 - u) * 28;
        x += (1 - u) * (i ? 30 : -30);
      }

      drawDie(ctx, x, y, size, value, rot);
    }
  });

  return <canvas ref={ref} className="sl-dice-cv" aria-hidden="true" />;
}

function drawDie(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  value: number,
  rot: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(-s / 2 + 5, -s / 2 + 5, s, s, s * 0.22);
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.22);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // the one is red, as on a real die
  ctx.fillStyle = value === 1 ? RED : INK;
  for (const [px, py] of PIPS[value] ?? PIPS[1]!) {
    ctx.beginPath();
    ctx.arc(px * s * 0.26, py * s * 0.26, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
