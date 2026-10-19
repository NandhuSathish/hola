/**
 * The board, ported from design/snakes-ladders-mock.html.
 *
 * Geometry is the mock's: a 1000-unit square, a 10x10 grid of 98-unit tiles
 * inset by 10. The caller scales that to whatever the canvas is.
 *
 * The snakes are the part worth reading. Each one is a 56-point spine with a
 * sine wave along it under an envelope that pins both ends, drawn as a run of
 * overlapping circles with a tapering radius — not a stroked curve. That is
 * what makes them read as animals rather than cable.
 */
import { CROWD_TILES, LAST_TILE, MYSTERY_TILES, type LiveSnake } from '@holla/shared';
import { INK, MINT, ORANGE, PAPER, PINK, RED, SKY, SUN, TEAL, blob, shade } from '../../art/palette';
import { lerp } from '../../lib/canvas';

/** Board side, in the units everything below is written in. */
export const BOARD = 1000;
/** Inset of the grid from the board edge. */
const O = 10;
/** Tile side. */
const T = 98;

export function tileXY(tile: number): [number, number] {
  const i = tile - 1;
  const row = Math.floor(i / 10);
  const col = row % 2 === 0 ? i % 10 : 9 - (i % 10);
  return [O + (col + 0.5) * T, O + (9 - row + 0.5) * T];
}

/** Pastel pairs, one per row-pair, bottom to top. */
const BANDS: readonly (readonly [string, string])[] = [
  ['#BFF0D4', '#A4E6C2'],
  ['#FFE7A3', '#FFDA80'],
  ['#FFCCE3', '#FFB5D6'],
  ['#CFE0FF', '#B7CEFF'],
  ['#DCCDFF', '#C9B5FF'],
];

/** Snake body colours, in the order the board lists its snakes. */
const SNAKE_COLOURS = [MINT, PINK, SKY, SUN, RED, ORANGE, TEAL, MINT];
/** Noodle, the one that wanders, is always purple. */
const NOODLE_COLOUR = '#B48CFF';

/** Fill then outline, against the board's own ink. */
const blob2 = blob;

// ---------------------------------------------------------------- furniture

function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-18, 10);
  ctx.lineTo(-15, -12);
  ctx.lineTo(-7, -2);
  ctx.lineTo(0, -16);
  ctx.lineTo(7, -2);
  ctx.lineTo(15, -12);
  ctx.lineTo(18, 10);
  ctx.closePath();
  blob2(ctx, SUN, 3);
  ctx.beginPath();
  ctx.arc(0, 4, 3, 0, Math.PI * 2);
  ctx.fillStyle = PINK;
  ctx.fill();
  ctx.restore();
}

/** A mystery box. */
function drawGift(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.roundRect(-17, -8, 34, 26, 4);
  blob2(ctx, PINK, 3);
  ctx.beginPath();
  ctx.roundRect(-20, -17, 40, 11, 3);
  blob2(ctx, PINK, 3);
  ctx.fillStyle = SUN;
  ctx.fillRect(-4, -16, 8, 33);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(-4, -16, 8, 33);
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.bezierCurveTo(-10, -30, -18, -22, -6, -17);
  ctx.moveTo(0, -17);
  ctx.bezierCurveTo(10, -30, 18, -22, 6, -17);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = '400 15px "Lilita One", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PAPER;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeText('?', -11, 6);
  ctx.fillText('?', -11, 6);
  ctx.restore();
}

/** A crowd-vote tile. */
function drawMegaphone(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.2 + Math.sin(t * 4) * 0.05);
  ctx.beginPath();
  ctx.moveTo(-18, -6);
  ctx.lineTo(-6, -6);
  ctx.lineTo(14, -18);
  ctx.lineTo(14, 18);
  ctx.lineTo(-6, 6);
  ctx.lineTo(-18, 6);
  ctx.closePath();
  blob2(ctx, SUN, 3);
  ctx.beginPath();
  ctx.moveTo(-14, 6);
  ctx.lineTo(-10, 20);
  ctx.lineTo(-3, 20);
  ctx.lineTo(-5, 6);
  blob2(ctx, PAPER, 2.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  for (let i = 0; i < 2; i++) {
    const a = (t * 2 + i * 0.5) % 1;
    ctx.globalAlpha = 1 - a;
    ctx.beginPath();
    ctx.arc(14, 0, 8 + a * 14, -0.7, 0.7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------------------------------------------------------------- the grid

export function drawTiles(ctx: CanvasRenderingContext2D, t: number): void {
  // hard offset shadow under the whole board, the sticker look at board scale
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(O + 8, O + 8, T * 10, T * 10, 26);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(O, O, T * 10, T * 10, 26);
  ctx.clip();

  for (let n = 1; n <= LAST_TILE; n++) {
    const [x, y] = tileXY(n);
    const row = Math.floor((n - 1) / 10);
    const band = BANDS[Math.floor(row / 2)] ?? BANDS[0]!;
    ctx.fillStyle = n === LAST_TILE ? SUN : (band[(n + row) % 2 === 0 ? 0 : 1] as string);
    ctx.fillRect(x - T / 2, y - T / 2, T, T);
  }

  ctx.strokeStyle = 'rgba(14,10,46,.35)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(O + i * T, O);
    ctx.lineTo(O + i * T, O + T * 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(O, O + i * T);
    ctx.lineTo(O + T * 10, O + i * T);
    ctx.stroke();
  }

  ctx.font = '400 22px "Lilita One", sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(14,10,46,.6)';
  for (let n = 1; n <= LAST_TILE; n++) {
    const [x, y] = tileXY(n);
    ctx.fillText(String(n), x - T / 2 + 8, y - T / 2 + 6);
  }

  for (const n of MYSTERY_TILES) {
    const [x, y] = tileXY(n);
    drawGift(ctx, x + 10, y + 4 + Math.sin(t * 3 + n) * 3);
  }
  for (const n of CROWD_TILES) {
    const [x, y] = tileXY(n);
    drawMegaphone(ctx, x + 8, y + 4, t);
  }

  ctx.font = '400 17px "Lilita One", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  const [sx, sy] = tileXY(1);
  ctx.fillText('Start', sx + 14, sy - T / 2 + 10);

  const [fx, fy] = tileXY(LAST_TILE);
  ctx.save();
  ctx.translate(fx + 10, fy - 6);
  ctx.rotate(Math.sin(t * 2) * 0.08);
  drawCrown(ctx, 0, 0, 1.15);
  ctx.restore();
  ctx.fillStyle = INK;
  ctx.fillText('Finish', fx + 12, fy + 22);

  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(O, O, T * 10, T * 10, 26);
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

// ---------------------------------------------------------------- ladders

export function drawLadder(ctx: CanvasRenderingContext2D, foot: number, head: number): void {
  const [x1, y1] = tileXY(foot);
  const [x2, y2] = tileXY(head);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const nx = -uy * 17;
  const ny = ux * 17;
  const s1 = [x1 + ux * 6, y1 + uy * 6];
  const s2 = [x2 - ux * 6, y2 - uy * 6];

  ctx.save();
  ctx.lineCap = 'round';

  const rails = (off: number, colour: string, w: number) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = w;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s1[0]! + nx * k + off, s1[1]! + ny * k + off);
      ctx.lineTo(s2[0]! + nx * k + off, s2[1]! + ny * k + off);
      ctx.stroke();
    }
  };
  const rungs = (off: number, colour: string, w: number) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = w;
    for (let at = 22; at < d - 14; at += 30) {
      const px = x1 + ux * at;
      const py = y1 + uy * at;
      ctx.beginPath();
      ctx.moveTo(px - nx + off, py - ny + off);
      ctx.lineTo(px + nx + off, py + ny + off);
      ctx.stroke();
    }
  };

  // shadow first, then ink underlay, then the wood
  rails(6, 'rgba(14,10,46,.35)', 13);
  rungs(6, 'rgba(14,10,46,.35)', 10);
  rungs(0, INK, 10);
  rungs(0, '#FFE1A8', 5);
  rails(0, INK, 13);
  rails(0, '#FFB547', 7.5);
  ctx.restore();
}

// ---------------------------------------------------------------- snakes

/** A snake with its drawing extras: a phase offset and a swallowing bulge. */
export type SnakeArt = LiveSnake & {
  /** Keeps two snakes from waving in lockstep. */
  seed: number;
  /** 0..1 along the body while someone is being swallowed; -1 when idle. */
  bulge: number;
  /** Seconds left of seeing stars after a shield bonk. */
  bonk: number;
};

export const colourOfSnake = (snake: LiveSnake, index: number): string =>
  snake.boss ? NOODLE_COLOUR : (SNAKE_COLOURS[index % SNAKE_COLOURS.length] ?? MINT);

/**
 * The spine. A sine along the run, amplitude set by length and pinned to zero
 * at both ends by the envelope, so head and tail sit on their tiles.
 */
function snakePts(
  snake: SnakeArt,
  hx: number,
  hy: number,
  tx: number,
  ty: number,
  t: number,
): [number, number][] {
  const N = 56;
  const pts: [number, number][] = [];
  const dx = tx - hx;
  const dy = ty - hy;
  const d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d;
  const ny = dx / d;
  const waves = Math.max(1.5, Math.round(d / 170));
  const A = Math.min(46, d * 0.11 + 14) * (snake.boss ? 1.15 : 1);
  const wobble = snake.sleep > 0 ? 0 : Math.sin(t * 1.6 + snake.seed) * 0.55;

  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const env = Math.pow(Math.sin(u * Math.PI), 0.6);
    const off = A * Math.sin(u * Math.PI * waves + snake.seed + wobble) * env;
    pts.push([hx + dx * u + nx * off, hy + dy * u + ny * off]);
  }
  return pts;
}

export function drawSnake(
  ctx: CanvasRenderingContext2D,
  snake: SnakeArt,
  colour: string,
  t: number,
  /** Where the snake's eyes should point — usually the player in turn. */
  lookAt: [number, number] | null,
): void {
  const [hx0, hy0] = tileXY(snake.head);
  const [tx, ty] = tileXY(snake.tail);
  const pts = snakePts(snake, hx0, hy0, tx, ty, t);
  const N = pts.length;
  const r0 = snake.boss ? 25 : 20;
  const r1 = snake.boss ? 9 : 7;

  const rad = (i: number): number => {
    const u = i / (N - 1);
    let r = lerp(r0, r1, u);
    // the lump travelling down a snake that just ate someone
    if (snake.bulge >= 0) r += 13 * Math.exp(-Math.pow(u - snake.bulge, 2) / 0.004);
    return r;
  };

  // The body is a run of circles rather than a stroked path: it lets the
  // radius taper and bulge, which a single lineWidth cannot do.
  ctx.fillStyle = 'rgba(14,10,46,.3)';
  for (let i = N - 1; i >= 0; i -= 2) {
    ctx.beginPath();
    ctx.arc(pts[i]![0] + 7, pts[i]![1] + 7, rad(i), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = INK;
  for (let i = N - 1; i >= 0; i--) {
    ctx.beginPath();
    ctx.arc(pts[i]![0], pts[i]![1], rad(i) + 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const dark = shade(colour, -0.12);
  for (let i = N - 1; i >= 0; i--) {
    ctx.beginPath();
    ctx.arc(pts[i]![0], pts[i]![1], rad(i), 0, Math.PI * 2);
    ctx.fillStyle = Math.floor(i / 4) % 2 ? colour : dark;
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,244,220,.45)';
  for (let i = 6; i < N - 3; i += 4) {
    ctx.beginPath();
    ctx.arc(pts[i]![0] - 2, pts[i]![1] - 3, rad(i) * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  const [hx, hy] = pts[0]!;
  const ang = Math.atan2(pts[0]![1] - pts[3]![1], pts[0]![0] - pts[3]![0]);
  const hs = snake.boss ? 1.25 : 1;

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ang);
  ctx.scale(hs, hs);
  // the tongue flicks out for a third of a second every 2.6s
  if (snake.sleep <= 0 && snake.bonk <= 0 && (t + snake.seed) % 2.6 < 0.35) {
    ctx.strokeStyle = RED;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    const tl = 34 + Math.sin(t * 30) * 4;
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(tl + 8, 0);
    ctx.lineTo(tl + 16, -6);
    ctx.moveTo(tl + 8, 0);
    ctx.lineTo(tl + 16, 6);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(4, 0, 33, 26, 0, 0, Math.PI * 2);
  blob2(ctx, colour, 4);
  ctx.fillStyle = 'rgba(255,95,168,.5)';
  ctx.beginPath();
  ctx.ellipse(16, -15, 6, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(16, 15, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Eyes stay upright whatever the head's angle, which is what stops it
  // reading as a machine part.
  for (const k of [-1, 1]) {
    const x = hx + Math.cos(ang) * 6 * hs - Math.sin(ang) * k * 11 * hs;
    const y = hy + Math.sin(ang) * 6 * hs + Math.cos(ang) * k * 11 * hs - 8;

    if (snake.sleep > 0) {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      continue;
    }
    if (snake.bonk > 0) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 1.6);
      ctx.stroke();
      continue;
    }
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    blob2(ctx, '#fff', 3);
    if ((t + snake.seed * 3) % 3.7 < 0.12) {
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.stroke();
    } else {
      let lx = 0;
      let ly = 0;
      if (lookAt) {
        const dx = lookAt[0] - x;
        const dy = lookAt[1] - y;
        const d = Math.hypot(dx, dy) || 1;
        lx = dx / d;
        ly = dy / d;
      }
      ctx.beginPath();
      ctx.arc(x + lx * 3.5, y + ly * 3.5, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
  }

  if (snake.sleep > 0) {
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.font = '400 20px "Lilita One", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < 2; i++) {
      const a = (t * 0.6 + i * 0.5) % 1;
      ctx.globalAlpha = 1 - a;
      ctx.strokeText('z', hx + 14 + a * 16, hy - 30 - a * 30);
      ctx.fillText('z', hx + 14 + a * 16, hy - 30 - a * 30);
    }
    ctx.globalAlpha = 1;
  }

  if (snake.boss) {
    ctx.save();
    ctx.translate(hx, hy - 36 * hs);
    ctx.rotate(Math.sin(t * 2) * 0.1);
    drawCrown(ctx, 0, 0, 0.9);
    ctx.restore();
  }

  if (snake.bonk > 0) {
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + i * 2.1;
      ctx.beginPath();
      ctx.arc(hx + Math.cos(a) * 24, hy - 36 + Math.sin(a) * 7, 4.5, 0, Math.PI * 2);
      blob2(ctx, SUN, 2);
    }
  }
}

// ---------------------------------------------------------------- placement

/**
 * Where a fighter's feet go on a tile.
 *
 * The figure is drawn feet-at-origin, so it stands below the tile centre
 * rather than through it. Players sharing a tile fan out into a small grid,
 * because at 15 players a pile-up is the normal case, not the edge case.
 */
export function restXY(tile: number, index: number, count: number): [number, number] {
  const [cx, cy] = tileXY(tile);
  if (count <= 1) return [cx, cy + 26];
  const cols = Math.min(count, 4);
  const rows = Math.ceil(count / cols);
  const row = Math.floor(index / cols);
  const col = index % cols;
  return [cx + (col - (cols - 1) / 2) * (T / cols) * 0.9, cy + 30 - (rows - 1 - row) * 16];
}

/** Where a fighter's feet go while it is travelling across the board. */
export const walkXY = (tile: number): [number, number] => {
  const [x, y] = tileXY(tile);
  return [x, y + 26];
};
