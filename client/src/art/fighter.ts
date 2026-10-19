/**
 * The little boxer every game draws.
 *
 * A faithful port of `drawFighter` / `drawHead` from
 * design/snakes-ladders-mock.html (rule 8: the mock is the visual source of
 * truth). It lives here rather than under one game because both board games
 * and Hand Cricket draw the same figure, from the same three-number look.
 *
 * Everything is in one coordinate space: the fighter stands with its feet at
 * (0, 0) and is about 62 units tall. Callers translate and scale.
 */
import { HAIRS, SHORTS, SKINS, STYLES, TEAM_COLOURS, type Look } from '@holla/shared';
import { INK, PAPER, PINK, blob } from './palette';

/** Where the figure is facing and what its face is doing. */
export type Pose = {
  /** Jersey index. Wraps past eight players. */
  team: number;
  /** Facing: -1..1 across, and fy < -0.7 turns its back to us. */
  fx: number;
  fy: number;
  /** Walk cycle phase, in radians. */
  walk: number;
  moving: boolean;
  punching: boolean;
  stunned: boolean;
  hurt: boolean;
  blink: boolean;
  /** Seconds, for the headband flutter. */
  t: number;
  /** Shown on the back of the jersey. */
  num: number;
};

export const restingPose = (team: number, t = 0): Pose => ({
  team,
  fx: 0,
  fy: 1,
  walk: 0,
  moving: false,
  punching: false,
  stunned: false,
  hurt: false,
  blink: false,
  t,
  num: 1,
});

type Mood = 'idle' | 'punch' | 'hurt' | 'dizzy';

type HeadOptions = {
  side: number;
  front: boolean;
  back: boolean;
  mood: Mood;
  blink: boolean;
  /** Carried through so the face shifts with the body's facing. */
  fy: number;
  t: number;
};

const styleHat = (style: (typeof STYLES)[number]): string =>
  'hat' in style ? style.hat : PAPER;

/** The dome of hair or fabric over the top of the skull. */
function hairCap(
  ctx: CanvasRenderingContext2D,
  colour: string,
  hy: number,
  side: number,
  r = 17,
  dip = 3,
): void {
  ctx.beginPath();
  ctx.arc(0, hy, r, Math.PI * 1.07, Math.PI * 1.93);
  ctx.quadraticCurveTo(
    side * 5,
    hy - r * 0.24 + dip * 2.2,
    Math.cos(Math.PI * 1.07) * r,
    hy + Math.sin(Math.PI * 1.07) * r,
  );
  ctx.closePath();
  blob(ctx, colour);
}

/** The head, centred at (0, hy). Exported because avatars are head-only. */
export function drawHead(
  ctx: CanvasRenderingContext2D,
  look: Look,
  hy: number,
  o: HeadOptions,
): void {
  const style = STYLES[look.style] ?? STYLES[0];
  const hat = styleHat(style);
  const skin = SKINS[look.skin] ?? SKINS[0];
  const hair = HAIRS[look.hair] ?? HAIRS[0];
  const { side, back } = o;
  const R = 16;

  // pieces that sit behind the skull
  if (style.id === 'hood') {
    for (const ex of [-8, 8]) {
      ctx.save();
      ctx.translate(ex, hy - 26);
      ctx.rotate(ex / 40);
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.5, 13, 0, 0, Math.PI * 2);
      blob(ctx, hat);
      ctx.beginPath();
      ctx.ellipse(0, 1, 2.5, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = PINK;
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, hy, R + 5, 0, Math.PI * 2);
    blob(ctx, hat, 3.5);
  }
  if (style.id === 'bun') {
    ctx.beginPath();
    ctx.arc(back ? 0 : -side * 4, hy - R - 2, 7.5, 0, Math.PI * 2);
    blob(ctx, hair);
  }
  if (style.id === 'band' && !back) {
    const flutter = Math.sin(o.t * 14) * 2;
    ctx.beginPath();
    ctx.moveTo(-side * 12, hy - 6);
    ctx.lineTo(-side * 24, hy - 10 + flutter);
    ctx.lineTo(-side * 22, hy - 3 + flutter);
    ctx.closePath();
    blob(ctx, hat, 2.5);
  }

  ctx.beginPath();
  ctx.arc(0, hy, R, 0, Math.PI * 2);
  blob(ctx, skin, 3.5);

  if (back) {
    if (style.id === 'cap') {
      ctx.beginPath();
      ctx.arc(0, hy - 1, R + 1, Math.PI * 0.95, Math.PI * 2.05);
      ctx.closePath();
      blob(ctx, hat);
      ctx.beginPath();
      ctx.arc(0, hy + 2, R, Math.PI * 0.1, Math.PI * 0.9);
      ctx.fillStyle = hair;
      ctx.fill();
    } else if (style.id === 'beanie') {
      ctx.beginPath();
      ctx.arc(0, hy - 1, R + 1.5, Math.PI * 0.9, Math.PI * 2.1);
      ctx.closePath();
      blob(ctx, hat);
      ctx.beginPath();
      ctx.arc(0, hy - R - 3, 5, 0, Math.PI * 2);
      blob(ctx, PAPER, 2.5);
    } else if (style.id === 'mohawk') {
      ctx.beginPath();
      ctx.moveTo(-3, hy - R + 2);
      ctx.lineTo(0, hy - R - 12);
      ctx.lineTo(3, hy - R + 2);
      ctx.lineTo(3, hy + R - 4);
      ctx.lineTo(-3, hy + R - 4);
      ctx.closePath();
      blob(ctx, hair, 2.5);
    } else if (style.id === 'hood') {
      ctx.beginPath();
      ctx.arc(0, hy, R + 5, 0, Math.PI * 2);
      blob(ctx, hat, 3.5);
      ctx.beginPath();
      ctx.moveTo(0, hy - R - 3);
      ctx.lineTo(0, hy + R);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(14,10,46,.25)';
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, hy - 1, R + 0.5, 0, Math.PI * 2);
      blob(ctx, hair, 3.5);
      if (style.id === 'band') {
        ctx.beginPath();
        ctx.roundRect(-R - 1, hy - 8, R * 2 + 2, 5.5, 2);
        blob(ctx, hat, 2);
      }
      if (style.id === 'curly' || style.id === 'spiky') {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          ctx.beginPath();
          ctx.arc(
            Math.cos(a) * 13,
            hy - 2 + Math.sin(a) * 12,
            style.id === 'curly' ? 6 : 4,
            0,
            Math.PI * 2,
          );
          blob(ctx, hair, 2.5);
        }
      }
    }
    return;
  }

  // face
  const ox = o.front ? 0 : side * 4.5;
  const oy = o.fy ? o.fy * 1.5 : 0;
  const ey = hy + 2 + oy;

  ctx.fillStyle = 'rgba(255,95,168,.45)';
  for (const bx of [-9, 9]) {
    ctx.beginPath();
    ctx.ellipse(ox + bx, hy + 7 + oy, 3.4, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 2.4;
  for (const ex of [-5.5, 5.5]) {
    const x = ox + ex;
    if (o.mood === 'dizzy') {
      ctx.beginPath();
      ctx.arc(x, ey, 3.4, 0, Math.PI * 1.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, ey, 1.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.mood === 'hurt') {
      const d = ex < 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x - 2.6 * d, ey - 3);
      ctx.lineTo(x + 2.4 * d, ey);
      ctx.lineTo(x - 2.6 * d, ey + 3);
      ctx.stroke();
    } else if (o.blink) {
      ctx.beginPath();
      ctx.moveTo(x - 2.6, ey);
      ctx.lineTo(x + 2.6, ey);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(x, ey, 2.6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - 0.9, ey - 1.3, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
    }
    if (o.mood === 'punch') {
      const d = ex < 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x - 3.4 * d, ey - 7);
      ctx.lineTo(x + 2.8 * d, ey - 4.5);
      ctx.stroke();
    }
  }

  const my = hy + 9 + oy;
  if (o.mood === 'punch') {
    ctx.beginPath();
    ctx.ellipse(ox, my, 3, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (o.mood === 'hurt' || o.mood === 'dizzy') {
    ctx.beginPath();
    ctx.moveTo(ox - 4, my);
    ctx.quadraticCurveTo(ox - 2, my - 2.5, ox, my);
    ctx.quadraticCurveTo(ox + 2, my + 2.5, ox + 4, my);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(ox, my - 1.5, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // hair and hats, over the face
  if (style.id === 'cap') {
    hairCap(ctx, hat, hy, side, 17.5, 1);
    ctx.beginPath();
    if (o.front) ctx.ellipse(0, hy - 4.5, 15, 4.5, 0, 0, Math.PI * 2);
    else ctx.ellipse(side * 13, hy - 4.5, 10, 3.6, side * 0.1, 0, Math.PI * 2);
    blob(ctx, '#C8323A', 2.5);
    ctx.beginPath();
    ctx.arc(0, hy - R - 1, 2.4, 0, Math.PI * 2);
    blob(ctx, PAPER, 1.5);
  } else if (style.id === 'beanie') {
    hairCap(ctx, hat, hy, side, 18.5, 2);
    ctx.beginPath();
    ctx.roundRect(-17.5, hy - 9, 35, 6.5, 3);
    blob(ctx, PAPER, 2.5);
    ctx.beginPath();
    ctx.arc(-side * 2, hy - R - 5, 5.5, 0, Math.PI * 2);
    blob(ctx, PAPER, 2.5);
  } else if (style.id === 'spiky') {
    const a0 = Math.PI * 1.05;
    const a1 = Math.PI * 1.95;
    const n = 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a0) * 17, hy + Math.sin(a0) * 17);
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const am = a0 + ((a1 - a0) * (i + 0.5)) / n;
      ctx.lineTo(Math.cos(a) * 16, hy + Math.sin(a) * 16);
      if (i < n) ctx.lineTo(Math.cos(am) * 24 + side * 2, hy + Math.sin(am) * 24 - 1);
    }
    ctx.quadraticCurveTo(side * 5, hy - 1, Math.cos(a0) * 17, hy + Math.sin(a0) * 17);
    ctx.closePath();
    blob(ctx, hair);
  } else if (style.id === 'bun') {
    hairCap(ctx, hair, hy, side, 17, 4);
  } else if (style.id === 'band') {
    hairCap(ctx, hair, hy, side, 17, 3);
    ctx.beginPath();
    ctx.roundRect(-16.5, hy - 10, 33, 5.5, 2.5);
    blob(ctx, hat, 2.2);
  } else if (style.id === 'curly') {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1 + i / 6);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 14, hy - 1 + Math.sin(a) * 13, 6.5, 0, Math.PI * 2);
      blob(ctx, hair, 2.5);
    }
    hairCap(ctx, hair, hy, side, 15, 2);
  } else if (style.id === 'mohawk') {
    ctx.beginPath();
    ctx.moveTo(-5, hy - R + 3);
    ctx.lineTo(-7, hy - R - 8);
    ctx.lineTo(-2.5, hy - R - 4);
    ctx.lineTo(0, hy - R - 14);
    ctx.lineTo(2.5, hy - R - 4);
    ctx.lineTo(7, hy - R - 8);
    ctx.lineTo(5, hy - R + 3);
    ctx.closePath();
    blob(ctx, hair, 2.5);
  } else if (style.id === 'hood') {
    ctx.beginPath();
    ctx.arc(0, hy - R + 3, 9, Math.PI, 0);
    ctx.quadraticCurveTo(side * 3, hy - R + 6, -9, hy - R + 3);
    blob(ctx, hair, 2);
  }
}

/** The whole fighter, feet at (0, 0). */
export function drawFighter(ctx: CanvasRenderingContext2D, look: Look, s: Pose): void {
  const skin = SKINS[look.skin] ?? SKINS[0];
  const side = s.fx < 0 ? -1 : 1;
  const back = s.fy < -0.7;
  const front = !back && Math.abs(s.fx) < 0.35;
  const mv = s.moving ? 1 : 0;
  const ph = s.walk;
  const bob = mv * Math.abs(Math.sin(ph)) * 2.2;
  const sw = Math.sin(ph) * 7 * mv;
  const mood: Mood = s.stunned ? 'dizzy' : s.hurt ? 'hurt' : s.punching ? 'punch' : 'idle';

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // an outlined limb: a fat ink stroke with a thinner skin stroke over it
  const limb = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 9;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.lineWidth = 4.6;
    ctx.strokeStyle = skin;
    ctx.stroke();
  };
  const glove = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    blob(ctx, PAPER, 3);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.55, y + r * 0.25);
    ctx.lineTo(x + r * 0.2, y + r * 0.25);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  };

  const shoulderY = -25 - bob;
  const reach: [number, number] = [s.fx * 34, shoulderY + 6 + s.fy * 14];
  const rest = (k: number): [number, number] =>
    front || back
      ? [k * 16, -12 - bob + k * sw * 0.25]
      : [k === side ? side * 15 - sw * 0.6 : -side * 9 + sw * 0.6, -12 - bob];

  // back arm, side view only
  if (!front && !back) {
    const [gx, gy] = rest(-side);
    limb(-side * 9, shoulderY, gx, gy);
    glove(gx, gy, 6.5);
  }

  // legs, out of phase so it walks rather than hops
  const feet: [number, number][] = [
    [-5 + sw, -Math.max(0, Math.sin(ph)) * 3 * mv],
    [5 - sw, -Math.max(0, -Math.sin(ph)) * 3 * mv],
  ];
  for (const [fx, fy] of feet) {
    limb(fx * 0.4, -8 - bob, fx, fy - 1);
    ctx.beginPath();
    ctx.ellipse(fx + (front || back ? 0 : side * 2.5), fy + 1, 6, 3.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.roundRect(-12, -13 - bob, 24, 9, 4);
  blob(ctx, SHORTS[s.team % SHORTS.length] ?? SHORTS[0], 3);
  ctx.beginPath();
  ctx.roundRect(-13, -31 - bob, 26, 22, 10);
  blob(ctx, TEAM_COLOURS[s.team % TEAM_COLOURS.length] ?? TEAM_COLOURS[0], 3.5);

  if (back) {
    ctx.font = '400 12px "Lilita One", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PAPER;
    ctx.fillText(String(s.num), 0, -20 - bob);
  } else {
    ctx.beginPath();
    ctx.moveTo(-6, -31 - bob);
    ctx.lineTo(0, -25 - bob);
    ctx.lineTo(6, -31 - bob);
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = PAPER;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-12, -21 - bob, 24, 3.5, 1.5);
    ctx.fillStyle = 'rgba(255,244,220,.55)';
    ctx.fill();
  }

  // front arm, or both when facing us or away
  if (front || back) {
    for (const k of [-1, 1]) {
      let [gx, gy] = rest(k);
      const isPunch = s.punching && k === (s.fx >= 0 ? 1 : -1);
      if (isPunch) [gx, gy] = reach;
      limb(k * 11, shoulderY, gx, gy);
      glove(gx, gy, isPunch ? 8.5 : 6.5);
    }
  } else {
    let [gx, gy] = rest(side);
    if (s.punching) [gx, gy] = reach;
    limb(side * 9, shoulderY, gx, gy);
    glove(gx, gy, s.punching ? 8.5 : 6.5);
  }

  drawHead(ctx, look, -46 - bob, { side, front, back, mood, blink: s.blink, fy: s.fy, t: s.t });
  ctx.restore();
}

/**
 * A head on a coloured square, as a data URL, for the places that want an
 * `<img>` rather than a canvas: seat grids, podiums, the event log.
 *
 * Cached, because a lobby of 15 would otherwise rasterise 15 heads on every
 * React render.
 */
const iconCache = new Map<string, string>();

export function headIcon(look: Look, background: string, size = 96): string {
  const key = `${look.style}-${look.skin}-${look.hair}-${background}-${size}`;
  const hit = iconCache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  const scale = (size / 96) * 1.75;
  ctx.translate(size / 2, size * 0.604);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  drawHead(ctx, look, 0, {
    side: 1,
    front: true,
    back: false,
    mood: 'idle',
    blink: false,
    fy: 1,
    t: 0,
  });

  const url = canvas.toDataURL();
  iconCache.set(key, url);
  return url;
}

/** The jersey colour a seat index wears, so DOM chrome matches the canvas. */
export const teamColour = (index: number): string =>
  TEAM_COLOURS[index % TEAM_COLOURS.length] ?? TEAM_COLOURS[0];
