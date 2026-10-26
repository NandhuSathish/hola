/**
 * The cricketers, ported from design/hand-cricket-mock.html.
 *
 * A different body from the boxer in `art/fighter.ts` — this one is drawn in
 * profile with pads, gloves, a bat and a helmet — but it borrows that file's
 * head, so a player is recognisably the same person whichever game they are
 * in. `bare` turns the head off above the eyebrows where a helmet or an
 * umpire's hat is about to cover it.
 */
import { HAIRS, SKINS, type Look } from '@holla/shared';
import { INK, PAPER, PINK, RED, SKY, blob } from '../../art/palette';
import { drawHead } from '../../art/fighter';
import { lerp } from '../../lib/canvas';

/*
 * The mock's own easing: a clamped smoothstep. The board games use a
 * different curve, and these keyframes were tuned against this one — an
 * unclamped ease would carry a bat past the end of its swing.
 */
const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));


/** Two sides, so two colours. Sky bats first on the left of every chip. */
export const TEAM_COL = [SKY, PINK] as const;
const TROUSERS = ['#1A55B8', '#C42F78'] as const;

/** The umpire is nobody in particular. */
export const UMP_LOOK: Look = { style: 0, skin: 2, hair: 1 };

export const PITCH = '#E9C784';
export const GRASS = '#26B36B';
export const GRASS_2 = '#1F9F5D';
export const SKY_BLUE = '#A8DCFF';
export const INK_3 = '#3A2D93';

export { SKINS, HAIRS };

type Point = [number, number];

/** A hand `len` away from a shoulder, at angle `th`. */
export const armTo = (sh: Point, th: number, len = 26): Point => [
  sh[0] - Math.sin(th) * len,
  sh[1] + Math.cos(th) * len,
];

/** Where the shoulders sit for a given crouch. */
export const shoulders = (cr: number): [Point, Point] => {
  const shY = -52 + cr * 12;
  return [
    [-4, shY + 3],
    [5, shY + 3],
  ];
};

export type Pose = {
  team: number;
  legs?: 'stand' | 'wide' | 'crouch' | 'walk' | 'tuck';
  crouch?: number;
  walk?: number;
  stride?: number;
  lift?: number;
  rot?: number;
  front?: Point;
  back?: Point;
  bat?: [number, number, number];
  ball?: Point | null;
  pads?: boolean;
  bgloves?: boolean;
  kgloves?: boolean;
  helmet?: boolean;
  hat?: boolean;
  ump?: boolean;
  finger?: boolean;
  mood?: 'idle' | 'punch' | 'hurt' | 'dizzy';
  blink?: boolean;
  t?: number;
};

// ---------------------------------------------------------------- props

export function drawBallAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r = 5,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // the seam
  ctx.beginPath();
  ctx.arc(x - r * 0.9, y, r * 0.9, -0.9, 0.9);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = PAPER;
  ctx.stroke();
}

function drawBat(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(r);
  // handle
  ctx.beginPath();
  ctx.roundRect(-2.8, -5, 5.6, 19, 2.5);
  blob(ctx, '#2A1F5C', 2);
  ctx.strokeStyle = 'rgba(255,244,220,.45)';
  ctx.lineWidth = 1.2;
  for (let yy = -2; yy < 12; yy += 4) {
    ctx.beginPath();
    ctx.moveTo(-2.5, yy);
    ctx.lineTo(2.5, yy + 2);
    ctx.stroke();
  }
  // blade
  ctx.beginPath();
  ctx.roundRect(-6.5, 13, 13, 46, [3, 3, 7, 7]);
  blob(ctx, '#EDCB8A', 2.6);
  ctx.beginPath();
  ctx.moveTo(2, 18);
  ctx.lineTo(2, 55);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(14,10,46,.2)';
  ctx.stroke();
  // the sticker's sticker
  ctx.beginPath();
  ctx.roundRect(-4.5, 19, 9, 10, 2);
  ctx.fillStyle = PINK;
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.font = '400 6px "Lilita One", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('h!', 0, 24.5);
  ctx.restore();
}

function drawHelmet(ctx: CanvasRenderingContext2D, hy: number, team: number): void {
  const col = TEAM_COL[team % TEAM_COL.length] ?? TEAM_COL[0];
  ctx.beginPath();
  ctx.arc(0, hy - 1, 18.5, Math.PI * 0.93, Math.PI * 2.03);
  ctx.lineTo(15, hy - 3);
  ctx.quadraticCurveTo(2, hy - 7, -18, hy + 3);
  ctx.closePath();
  blob(ctx, col, 3);
  // peak
  ctx.beginPath();
  ctx.moveTo(9, hy - 9);
  ctx.quadraticCurveTo(22, hy - 10, 26, hy - 5);
  ctx.lineTo(10, hy - 3);
  ctx.closePath();
  blob(ctx, col, 2.5);
  // grille
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(15, hy - 3);
  ctx.quadraticCurveTo(21, hy + 6, 13, hy + 15);
  ctx.moveTo(9, hy - 2);
  ctx.quadraticCurveTo(15, hy + 7, 7, hy + 16);
  ctx.moveTo(9, hy + 4);
  ctx.lineTo(19, hy + 3);
  ctx.moveTo(7, hy + 10);
  ctx.lineTo(16, hy + 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-7, hy - 9, 3.2, 0, Math.PI * 2);
  blob(ctx, PAPER, 1.5);
}

function drawUmpHat(ctx: CanvasRenderingContext2D, hy: number): void {
  ctx.beginPath();
  ctx.ellipse(2, hy - 10, 26, 5.5, 0, 0, Math.PI * 2);
  blob(ctx, PAPER, 2.5);
  ctx.beginPath();
  ctx.roundRect(-11, hy - 27, 25, 17, [9, 9, 2, 2]);
  blob(ctx, PAPER, 2.5);
  ctx.fillStyle = INK;
  ctx.fillRect(-10, hy - 16, 23, 3.5);
}

// ---------------------------------------------------------------- the body

/** Facing right, feet at (0, 0). */
export function drawBody(ctx: CanvasRenderingContext2D, look: Look, o: Pose): void {
  const skin = SKINS[look.skin] ?? SKINS[0];
  const cr = o.crouch ?? 0;

  ctx.save();
  ctx.translate(0, -(o.lift ?? 0));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (o.rot) {
    ctx.translate(0, -26);
    ctx.rotate(o.rot);
    ctx.translate(0, 26);
  }

  const hipY = -26 + cr * 8;
  const shY = -52 + cr * 12;
  const hy = -72 + cr * 12;
  const jersey = o.ump ? PAPER : (TEAM_COL[o.team % TEAM_COL.length] ?? TEAM_COL[0]);
  const pants = o.ump ? '#2A2350' : (TROUSERS[o.team % TROUSERS.length] ?? TROUSERS[0]);

  let f1: Point = [-7, 0];
  let f2: Point = [8, 0];
  const lg = o.legs ?? 'stand';
  if (lg === 'wide' || lg === 'crouch') {
    f1 = [-13, 0];
    f2 = [14, 0];
  } else if (lg === 'walk') {
    const sw = Math.sin(o.walk ?? 0) * (o.stride ?? 11);
    f1 = [-sw, -Math.max(0, Math.sin(o.walk ?? 0)) * 5];
    f2 = [sw, -Math.max(0, -Math.sin(o.walk ?? 0)) * 5];
  } else if (lg === 'tuck') {
    f1 = [-9, -10];
    f2 = [9, -7];
  }

  // Every limb is an ink stroke with a thinner coloured one over it.
  const line = (pts: Point[], w: number, col: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
    ctx.lineWidth = w + 4.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.lineWidth = w;
    ctx.strokeStyle = col;
    ctx.stroke();
  };

  const leg = (f: Point, k: number) => {
    const hip: Point = [k * 3, hipY];
    const knee: Point = [
      (hip[0] + f[0]) / 2 + 3 + cr * 7,
      (hip[1] + f[1]) / 2 + 1 - cr * 3,
    ];
    line([hip, knee, [f[0], f[1] - 3]], 8, pants);
    if (o.pads) line([[knee[0] + 1, knee[1] - 5], [f[0] + 1, f[1] - 5]], 10, '#FFFFFF');
    ctx.beginPath();
    ctx.ellipse(f[0] + 3, f[1] - 1.5, 7.5, 4.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = o.ump ? INK : '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = INK;
    ctx.stroke();
  };

  const shB: Point = [-4, shY + 3];
  const shF: Point = [5, shY + 3];

  const hand = (h: Point, front: boolean) => {
    if (o.kgloves) {
      ctx.beginPath();
      ctx.ellipse(h[0], h[1], 7.5, 8.5, 0, 0, Math.PI * 2);
      blob(ctx, '#F2DFB2', 2.6);
      ctx.beginPath();
      ctx.moveTo(h[0] - 4, h[1] - 2);
      ctx.lineTo(h[0] + 4, h[1] - 2);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      return;
    }
    if (o.bgloves) {
      ctx.beginPath();
      ctx.arc(h[0], h[1], 5.6, 0, Math.PI * 2);
      blob(ctx, '#FFFFFF', 2.4);
      return;
    }
    ctx.beginPath();
    ctx.arc(h[0], h[1], 4.6, 0, Math.PI * 2);
    blob(ctx, skin, 2.4);
    // the umpire's raised finger
    if (front && o.finger) {
      ctx.beginPath();
      ctx.moveTo(h[0], h[1] - 3);
      ctx.lineTo(h[0] + 1.5, h[1] - 12);
      ctx.lineWidth = 5.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = skin;
      ctx.stroke();
    }
  };

  const arm = (sh: Point, h: Point, front: boolean) => {
    line([sh, h], 5.6, o.ump ? PAPER : skin);
    if (!o.ump) {
      ctx.beginPath();
      ctx.arc(sh[0], sh[1] + 1, 6.2, 0, Math.PI * 2);
      blob(ctx, jersey, 2.6);
    }
    hand(h, front);
  };

  if (o.back) arm(shB, o.back, false);
  leg(f1, -1);
  leg(f2, 1);

  const bot = o.ump ? hipY + 12 : hipY + 4;
  ctx.beginPath();
  ctx.roundRect(-12, shY - 5, 24, bot - shY + 5, 9);
  blob(ctx, jersey, 3.2);

  if (o.ump) {
    ctx.fillStyle = INK;
    for (const yy of [shY + 6, shY + 14, shY + 22]) {
      ctx.beginPath();
      ctx.arc(7, yy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.roundRect(-11, shY + 9, 22, 4, 2);
    ctx.fillStyle = 'rgba(255,244,220,.6)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, shY - 5);
    ctx.lineTo(9, shY + 2);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = PAPER;
    ctx.stroke();
  }

  if (o.bat) drawBat(ctx, o.bat[0], o.bat[1], o.bat[2]);
  if (o.front) arm(shF, o.front, true);

  drawHead(ctx, look, hy, {
    side: 1,
    front: false,
    back: false,
    mood: o.mood ?? 'idle',
    blink: o.blink ?? false,
    t: o.t ?? 0,
    fy: 0,
    bare: Boolean(o.helmet || o.hat),
  });
  if (o.helmet) drawHelmet(ctx, hy, o.team);
  if (o.hat) drawUmpHat(ctx, hy);
  if (o.ball) drawBallAt(ctx, o.ball[0], o.ball[1], 4.6);
  ctx.restore();
}

/** A body on the grass, with a shadow and a facing. */
export function person(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  dir: number,
  look: Look,
  pose: Pose,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.ellipse(2 * scale, 0, 15 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(14,10,46,.3)';
  ctx.fill();
  ctx.scale(scale * dir, scale);
  drawBody(ctx, look, pose);
  ctx.restore();
}

// ---------------------------------------------------------------- poses

type Key = [number, number, number, number];

/** Bat keyframes: [progress, x, y, rotation]. */
const SWING: { base: Key[]; [shot: string]: Key[] | number[] } = {
  base: [
    [0, 10, -34, 0.35],
    [0.3, -2, -60, 2.6],
    [0.46, 15, -36, -0.15],
  ],
  loft: [1, 6, -78, -3.7],
  drive: [1, 18, -54, -2.1],
  push: [1, 16, -40, -1.1],
  block: [1, 14, -33, 0],
  miss: [1, 18, -52, -2.0],
};

export type Shot = 'loft' | 'drive' | 'push' | 'block' | 'miss';

function swingAt(p: number, shot: Shot): [number, number, number] {
  const k: Key[] = [...SWING.base];
  if (shot === 'block') k.push([0.6, 14, -33, 0]);
  k.push(SWING[shot] as Key);
  for (let i = 0; i < k.length - 1; i++) {
    if (p <= k[i + 1]![0]) {
      const a = k[i]!;
      const b = k[i + 1]!;
      const u = ease((p - a[0]) / (b[0] - a[0]));
      return [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)];
    }
  }
  const l = k[k.length - 1]!;
  return [l[1], l[2], l[3]];
}

export function batterPose(
  team: number,
  kind: 'stance' | 'swing' | 'run' | 'cele' | 'slump',
  arg: { p: number; shot: Shot } | null,
  t: number,
  blink: boolean,
): Pose {
  const base: Pose = { team, pads: true, bgloves: true, helmet: true, t, blink };
  const withBat = (
    g: [number, number, number],
    cr: number,
    extra: Partial<Pose>,
  ): Pose => {
    const dir: Point = [-Math.sin(g[2]), Math.cos(g[2])];
    return {
      ...base,
      crouch: cr,
      bat: g,
      back: [g[0], g[1]],
      front: [g[0] + dir[0] * 8, g[1] + dir[1] * 8],
      ...extra,
    };
  };
  if (kind === 'swing' && arg)
    return withBat(swingAt(arg.p, arg.shot), 0.5, {
      legs: 'wide',
      mood: arg.p > 0.25 && arg.p < 0.7 ? 'punch' : 'idle',
    });
  if (kind === 'run')
    return withBat([12, -44, -1.3], 0.15, { legs: 'walk', walk: t * 17, stride: 14 });
  if (kind === 'cele')
    return withBat([2, -96, 3.1], 0, {
      legs: 'stand',
      lift: Math.abs(Math.sin(t * 9)) * 10,
    });
  if (kind === 'slump') return withBat([10, -24, 0.95], 0.2, { legs: 'stand', mood: 'hurt' });
  return withBat([10, -34, 0.35 + Math.sin(t * 5) * 0.07], 0.5, { legs: 'wide' });
}

export function bowlerPose(
  team: number,
  kind: 'idle' | 'run' | 'deliver' | 'follow' | 'cele' | 'sad',
  arg: { w?: number; p?: number } | null,
  t: number,
  blink: boolean,
): Pose {
  const base: Pose = { team, t, blink };
  if (kind === 'run') {
    const w = arg?.w ?? 0;
    return {
      ...base,
      legs: 'walk',
      walk: w,
      stride: 15,
      crouch: 0.1,
      front: [12 + Math.sin(w) * 7, -38],
      back: [-10 - Math.sin(w) * 7, -34],
      ball: [15 + Math.sin(w) * 7, -42],
    };
  }
  if (kind === 'deliver') {
    const raw = arg?.p ?? 0;
    const p = ease(raw);
    const [sb, sf] = shoulders(0.25);
    const hb = armTo(sb, lerp(0.9, 4.75, p));
    const hf = armTo(sf, lerp(3.7, 5.9, p));
    return {
      ...base,
      legs: 'wide',
      crouch: 0.25,
      back: hb,
      front: hf,
      ball: raw < 0.55 ? [hb[0], hb[1] - 3] : null,
    };
  }
  if (kind === 'follow')
    return { ...base, legs: 'walk', walk: arg?.w ?? 0, stride: 9, front: [14, -26], back: [-4, -30] };
  if (kind === 'cele') {
    const [sb, sf] = shoulders(0);
    return {
      ...base,
      legs: 'tuck',
      lift: Math.abs(Math.sin(t * 9)) * 14 + 4,
      back: armTo(sb, Math.PI - 0.8, 30),
      front: armTo(sf, Math.PI + 0.8, 30),
    };
  }
  if (kind === 'sad')
    return { ...base, legs: 'stand', front: [17, -80], back: [-17, -80], mood: 'hurt' };
  // idle, tossing the ball up
  const toss = Math.abs(Math.sin(t * 2.6)) * 16;
  return { ...base, legs: 'stand', front: [14, -38], back: [-8, -30], ball: [14, -43 - toss] };
}

export function keeperPose(
  team: number,
  kind: 'ready' | 'jump' | 'catch' | 'stand',
  t: number,
  blink: boolean,
): Pose {
  const base: Pose = { team, pads: true, kgloves: true, t, blink };
  if (kind === 'jump') {
    const [sb, sf] = shoulders(0);
    return {
      ...base,
      legs: 'tuck',
      lift: Math.abs(Math.sin(t * 8)) * 14 + 4,
      back: armTo(sb, Math.PI - 0.75, 30),
      front: armTo(sf, Math.PI + 0.75, 30),
    };
  }
  if (kind === 'catch')
    return { ...base, legs: 'crouch', crouch: 0.6, front: [18, -46], back: [12, -42] };
  if (kind === 'stand') return { ...base, legs: 'stand', front: [12, -36], back: [6, -34] };
  return {
    ...base,
    legs: 'crouch',
    crouch: 1,
    front: [17, -24 + Math.sin(t * 2) * 1.5],
    back: [12, -21],
  };
}

export function umpirePose(
  kind: 'idle' | 'six' | 'four' | 'out',
  t: number,
  blink: boolean,
): Pose {
  const base: Pose = { team: 0, ump: true, hat: true, legs: 'stand', t, blink };
  const [sb, sf] = shoulders(0);
  if (kind === 'six')
    return { ...base, back: armTo(sb, Math.PI - 0.62, 33), front: armTo(sf, Math.PI + 0.62, 33) };
  if (kind === 'four')
    return { ...base, back: [-6, -28], front: armTo(sf, 4.71 + Math.sin(t * 12) * 0.7, 28) };
  if (kind === 'out')
    return { ...base, back: [-6, -30], front: armTo(sf, Math.PI + 0.78, 29), finger: true };
  return { ...base, back: [-12, -36], front: [-8, -35] };
}

export function fielderPose(
  team: number,
  kind: 'ready' | 'chase' | 'dive' | 'pick' | 'throw' | 'cheer',
  arg: { p: number } | null,
  t: number,
  blink: boolean,
): Pose {
  const base: Pose = { team, t, blink };
  if (kind === 'chase')
    return {
      ...base,
      legs: 'walk',
      walk: t * 19,
      stride: 15,
      crouch: 0.1,
      front: [12 + Math.sin(t * 19) * 8, -38],
      back: [-10 - Math.sin(t * 19) * 8, -36],
    };
  if (kind === 'dive')
    return { ...base, legs: 'tuck', rot: -1.25 * (arg?.p ?? 0), front: [24, -46], back: [20, -50] };
  if (kind === 'pick')
    return { ...base, legs: 'crouch', crouch: 0.9, front: [20, -4], back: [6, -20] };
  if (kind === 'throw') {
    const p = arg?.p ?? 0;
    const [sb] = shoulders(0.1);
    const h = armTo(sb, lerp(2.4, 4.9, ease(p)));
    return {
      ...base,
      legs: 'wide',
      crouch: 0.1,
      back: h,
      front: [16, -40],
      ball: p < 0.5 ? [h[0], h[1] - 3] : null,
    };
  }
  if (kind === 'cheer') {
    const [sb, sf] = shoulders(0);
    return {
      ...base,
      legs: 'tuck',
      lift: Math.abs(Math.sin(t * 9)) * 10 + 3,
      back: armTo(sb, Math.PI - 0.8, 30),
      front: armTo(sf, Math.PI + 0.8, 30),
    };
  }
  return {
    ...base,
    legs: 'wide',
    crouch: 0.5 + Math.sin(t * 2.2) * 0.05,
    front: [13, -30],
    back: [1, -30],
  };
}
