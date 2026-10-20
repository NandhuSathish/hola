/**
 * The stadium, ported from design/hand-cricket-mock.html.
 *
 * Everything is drawn in a fixed 400-unit-tall world and scaled to whatever
 * the canvas is, so the ball's flight path can be written in real numbers.
 *
 * The scene plays a ball back on its own clock. The server long ago decided
 * what happened — this only tells it, which is why `T` here is seconds since
 * the ball was handed over rather than anything the engine knows about.
 */
import type { Look, Outcome } from '@holla/shared';
import { INK, PAPER, SUN, blob } from '../../art/palette';
import { c01, lerp } from '../../lib/canvas';

/*
 * The mock's own easing: a clamped smoothstep. The board games use a
 * different curve, and these keyframes were tuned against this one — an
 * unclamped ease would carry a bat past the end of its swing.
 */
const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

import {
  GRASS,
  GRASS_2,
  HAIRS,
  INK_3,
  PITCH,
  SKINS,
  SKY_BLUE,
  UMP_LOOK,
  batterPose,
  bowlerPose,
  drawBallAt,
  fielderPose,
  keeperPose,
  person,
  umpirePose,
  armTo,
  shoulders,
  type Shot,
} from './people';

/** Ground level in world units. */
const GY = 338;
const S = 1.45;

/** How long a ball takes to play out, by what it came to. */
export const sceneDuration = (o: Outcome): number =>
  o === 'W' ? 3.6 : o === 6 ? 3.8 : o === 4 ? 3.6 : o === 0 ? 3.0 : 1.95 + 0.55 * o + 0.75;

/** When the big word lands, which is before the ball finishes rolling. */
export const stampAt = (o: Outcome): number =>
  o === 'W' ? 1.86 : o === 6 ? 2.0 : o === 4 ? 2.35 : o === 0 ? 2.0 : 1.9;

export const stampFor = (o: Outcome): { text: string; colour: string } =>
  o === 'W'
    ? { text: 'Out!', colour: 'var(--red)' }
    : o === 6
      ? { text: 'Six!', colour: 'var(--sun)' }
      : o === 4
        ? { text: 'Four!', colour: 'var(--mint)' }
        : o === 0
          ? { text: 'Dot ball', colour: 'var(--paper)' }
          : { text: `${o} run${o === 1 ? '' : 's'}`, colour: 'var(--paper)' };

const crowdSeed = (i: number): number => {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

const SHIRTS = ['#2F8BFF', '#FF5FA8', '#FFC21A', '#22C97A', '#B48CFF', PAPER, '#FF4D4D'];

type Point = [number, number];

// ---------------------------------------------------------------- furniture

function drawStumps(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  breakU: number,
): void {
  const xs = [-7, 0, 7];
  xs.forEach((dx, i) => {
    ctx.save();
    ctx.translate(x + dx, y);
    if (breakU > 0) {
      const u = ease(breakU);
      ctx.translate((i - 1) * 14 * u + 4 * u, -6 * u);
      ctx.rotate(((i - 1) * 0.9 + (i === 1 ? 0.35 : 0)) * u);
    }
    ctx.beginPath();
    ctx.roundRect(-2.2, -44, 4.4, 44, 1.5);
    blob(ctx, PAPER, 1.8);
    ctx.restore();
  });
  // the bails, which fly
  ([[-7, 0], [0, 7]] as const).forEach(([a, b], i) => {
    ctx.save();
    if (breakU > 0) {
      const u = Math.min(1, breakU * 1.4);
      ctx.translate(
        x + (a + b) / 2 + (i ? 18 : -14) * u,
        y - 47 - 40 * Math.sin(u * Math.PI) + 14 * u,
      );
      ctx.rotate((i ? 5 : -4) * u);
      ctx.translate(-(x + (a + b) / 2), -(y - 47));
    }
    ctx.beginPath();
    ctx.roundRect(x + a, y - 48, b - a, 3.4, 1.5);
    blob(ctx, SUN, 1.4);
    ctx.restore();
  });
}

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  lw: number,
  tt: number,
  excitement: number,
  X: (v: number) => number,
): void {
  ctx.fillStyle = SKY_BLUE;
  ctx.fillRect(0, 0, lw, 200);

  for (let i = 0; i < 4; i++) {
    const x = ((i * 260 + tt * 8) % (lw + 240)) - 120;
    const y = 26 + (i % 2) * 20;
    ctx.beginPath();
    ctx.arc(x, y, 16, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(x + 18, y - 10, 18, Math.PI, Math.PI * 2);
    ctx.arc(x + 40, y, 15, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    blob(ctx, '#FFFFFF', 2.5);
  }

  for (const fx of [Math.max(30, X(-430)), Math.min(lw - 30, X(430))]) {
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(fx, 62);
    ctx.lineTo(fx, 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(fx - 18, 4, 36, 16, 4);
    blob(ctx, SUN, 2.5);
    ctx.fillStyle = INK;
    for (let j = -1; j <= 1; j++) {
      ctx.beginPath();
      ctx.arc(fx + j * 10, 12, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.beginPath();
  ctx.rect(-10, 58, lw + 20, 112);
  blob(ctx, INK_3, 3);
  ctx.fillStyle = INK;
  ctx.fillRect(-10, 54, lw + 20, 10);

  // the crowd, who jump when something happens
  let n = 0;
  for (let row = 0; row < 5; row++) {
    const y = 84 + row * 17;
    for (let x = -8 + (row % 2) * 8; x < lw + 12; x += 16) {
      n++;
      const s = crowdSeed(n);
      const jump =
        excitement * (Math.max(0, Math.sin(tt * 10 + s * 20)) * 7 + 2) * (s > 0.25 ? 1 : 0.3);
      const y2 = y - jump - Math.sin(tt * 2 + s * 9) * 0.8;
      ctx.fillStyle = SHIRTS[Math.floor(s * SHIRTS.length)]!;
      ctx.beginPath();
      ctx.roundRect(x - 6, y2 + 3, 12, 9, 4);
      ctx.fill();
      if (excitement > 0.4 && s > 0.45) {
        ctx.strokeStyle = SKINS[Math.floor(s * 50) % 5]!;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 5, y2 + 4);
        ctx.lineTo(x - 8, y2 - 7);
        ctx.moveTo(x + 5, y2 + 4);
        ctx.lineTo(x + 8, y2 - 7);
        ctx.stroke();
      }
      ctx.fillStyle = SKINS[Math.floor(s * 50) % 5]!;
      ctx.beginPath();
      ctx.arc(x, y2, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = HAIRS[Math.floor(s * 70) % 6]!;
      ctx.beginPath();
      ctx.arc(x, y2 - 1.5, 5.6, Math.PI, 0);
      ctx.fill();
    }
  }

  const msgs: [string, string][] = [
    ['holla!', '#FF5FA8'],
    ['HAND CRICKET', SUN],
    ['6 IT!', '#22C97A'],
    ['holla!', '#2F8BFF'],
    ['HOWZAT?', '#FF4D4D'],
  ];
  for (let i = 0, x = 0; x < lw; i++, x += 150) {
    const [m, col] = msgs[i % msgs.length]!;
    ctx.beginPath();
    ctx.rect(x, 168, 150, 28);
    blob(ctx, col, 3);
    ctx.fillStyle = col === SUN || col === '#22C97A' ? INK : PAPER;
    ctx.font = '400 15px "Lilita One", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m, x + 75, 183);
  }

  // grass in bands, so the outfield reads as going away from you
  const bands = [196, 212, 230, 250, 273, 298, 326, 356, 400];
  for (let i = 0; i < bands.length - 1; i++) {
    ctx.fillStyle = i % 2 ? GRASS_2 : GRASS;
    ctx.fillRect(0, bands[i]!, lw, bands[i + 1]! - bands[i]!);
  }
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 3.5;
  ctx.setLineDash([2, 9]);
  ctx.beginPath();
  ctx.moveTo(0, 203);
  ctx.lineTo(lw, 203);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPitch(ctx: CanvasRenderingContext2D, X: (v: number) => number): void {
  const l = X(-340);
  const r = X(340);
  ctx.beginPath();
  ctx.moveTo(l + 10, GY - 20);
  ctx.lineTo(r - 10, GY - 20);
  ctx.lineTo(r, GY + 10);
  ctx.lineTo(l, GY + 10);
  ctx.closePath();
  blob(ctx, PITCH, 3);
  ctx.beginPath();
  ctx.moveTo(l + 40, GY - 14);
  ctx.lineTo(r - 40, GY - 14);
  ctx.lineTo(r - 34, GY + 4);
  ctx.lineTo(l + 34, GY + 4);
  ctx.closePath();
  ctx.fillStyle = '#F3D9A2';
  ctx.fill();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 3;
  for (const cx of [X(-252), X(252)]) {
    ctx.beginPath();
    ctx.moveTo(cx - 2, GY - 19);
    ctx.lineTo(cx + 2, GY + 9);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- the ball

type Marks = {
  X: (v: number) => number;
  rel: Point;
  bounce: Point;
  contact: Point;
  stump: Point;
  kp: Point;
  f1: Point;
};

/** Where the ball is at time T, or null when it is out of play. */
function ballPath(T: number, o: Outcome, m: Marks): { p: Point; g: number | null; r: number } | null {
  const { rel, bounce, contact, stump, kp, f1, X } = m;
  const arc = (a: Point, b: Point, u: number, h: number): Point => [
    lerp(a[0], b[0], u),
    lerp(a[1], b[1], u) - Math.sin(u * Math.PI) * h,
  ];

  if (T < 1.15) return null;
  if (T < 1.45) {
    const u = (T - 1.15) / 0.3;
    const p = arc(rel, bounce, u, 0);
    p[1] = lerp(rel[1], bounce[1], u * u);
    return { p, g: GY - 4, r: 5 };
  }
  if (T < 1.68) return { p: arc(bounce, contact, (T - 1.45) / 0.23, 10), g: GY - 4, r: 5 };

  const t = T - 1.68;

  if (o === 'W') {
    if (t < 0.12) return { p: arc(contact, stump, t / 0.12, 0), g: GY - 4, r: 5 };
    const u = c01((t - 0.12) / 0.8);
    return { p: arc(stump, [kp[0] - 14, GY - 6], ease(u), 12), g: GY - 4, r: 5 };
  }
  if (o === 0) {
    const u = c01(t / 0.5);
    if (u < 1) return { p: arc(contact, [contact[0] - 26, GY - 5], u, 10), g: GY - 4, r: 5 };
    const u2 = c01((t - 0.5) / 0.6);
    return { p: [lerp(contact[0] - 26, contact[0] - 42, ease(u2)), GY - 5], g: GY - 4, r: 5 };
  }
  if (o === 6) {
    const u = c01(t / 1.25);
    if (u >= 1) return null;
    const a = contact;
    const cpt: Point = [X(-40), -190];
    const e: Point = [X(-290), 118];
    const x = (1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * cpt[0] + u * u * e[0];
    const y = (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * cpt[1] + u * u * e[1];
    return { p: [x, y], g: null, r: lerp(5, 3, u) };
  }
  if (o === 4) {
    const B: Point = [X(-430), 210];
    if (t < 0.8) {
      const u = t / 0.8;
      return {
        p: [
          lerp(contact[0], B[0], ease(u)),
          lerp(contact[1], B[1], u) - Math.abs(Math.sin(u * Math.PI * 3)) * 14 * (1 - u),
        ],
        g: lerp(GY - 4, B[1] + 3, u),
        r: lerp(5, 3.6, u),
      };
    }
    const u = c01((t - 0.8) / 0.35);
    return { p: [lerp(B[0], B[0] + 16, u), B[1] + 3 - Math.sin(u * Math.PI) * 5], g: B[1] + 5, r: 3.6 };
  }

  // 1, 2 or 3: out to the fielder, then thrown back
  const pick: Point = [f1[0] + 14, 262];
  if (t < 0.57) {
    const u = t / 0.57;
    return {
      p: [
        lerp(contact[0], pick[0], ease(u)),
        lerp(contact[1], pick[1], u) - Math.abs(Math.sin(u * Math.PI * 2)) * 10 * (1 - u),
      ],
      g: lerp(GY - 4, pick[1] + 2, u),
      r: lerp(5, 4, u),
    };
  }
  if (t < 0.77) return null;
  if (t < 1.27) {
    const u = (t - 0.77) / 0.5;
    return {
      p: arc([pick[0] + 8, pick[1] - 34], [kp[0] - 16, GY - 44], u, 80),
      g: lerp(pick[1] + 2, GY - 2, u),
      r: lerp(4, 5, u),
    };
  }
  return null;
}

// ---------------------------------------------------------------- the scene

export type SceneCast = {
  /** Looks, by role, already resolved from the room. */
  batter: Look;
  bowler: Look;
  keeper: Look | null;
  fielders: Look[];
  /** Team index for the batter's colours. */
  batTeam: number;
  bowlTeam: number;
};

/** The winning side, out on the field after the last ball. */
export type Celebration = {
  /** Looks of everyone who won, so the whole team is out there. */
  looks: Look[];
  team: number;
  /** Seconds since it started. */
  t: number;
};

export type SceneFrame = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Seconds, for idle motion. */
  time: number;
  /** Seconds into the ball being played back, or null when nothing is live. */
  T: number | null;
  outcome: Outcome | null;
  cast: SceneCast;
  /** Set once the match is won; replaces the players on the pitch. */
  celebration?: Celebration | null;
};

export function drawScene({
  ctx,
  width,
  height,
  time,
  T,
  outcome,
  cast,
  celebration,
}: SceneFrame): void {
  const sc = height / 400;
  const lw = width / sc;
  ctx.save();
  ctx.scale(sc, sc);
  ctx.clearRect(0, 0, lw, 400);

  const k = Math.min(1, (lw - 40) / 900);
  const cx = lw / 2;
  const X = (v: number) => cx + v * k;
  const tt = time;
  const live = T !== null && outcome !== null;
  const o = live ? outcome! : null;
  const t = live ? T! : 0;

  // the crowd gets up for the big moments
  let ex = 0;
  if (celebration) ex = 1;
  else if (o === 6) ex = c01((t - 1.9) * 2);
  else if (o === 4) ex = c01((t - 2.3) * 2) * 0.75;
  else if (o === 'W') ex = c01((t - 1.86) * 2) * 0.6;

  drawBackdrop(ctx, lw, tt, ex, X);

  // A win empties the middle and puts the whole side out there instead.
  if (celebration) {
    drawPitch(ctx, X);
    drawStumps(ctx, X(-270), GY - 2, 0);
    drawStumps(ctx, X(270), GY - 1, 0);
    drawCelebration(ctx, lw, celebration);
    ctx.restore();
    return;
  }

  const blink = (seed: number) => ((tt * 1000 + seed * 397) % 3300) < 130;
  const pos = {
    batX: X(222),
    stX: X(270),
    kpX: X(330),
    umpX: X(-322),
    bwS: X(-470),
    bwD: X(-250),
    f1X: X(-70),
    f2X: X(140),
  };
  const marks: Marks = {
    X,
    rel: [pos.bwD + 7, GY - 104],
    bounce: [X(118), GY - 6],
    contact: [pos.batX - 27, GY - 17],
    stump: [pos.stX - 1, GY - 26],
    kp: [pos.kpX, GY],
    f1: [pos.f1X, 250],
  };

  // outfielders
  let f1x = pos.f1X;
  let f1dir = 1;
  let f1pose = fielderPose(cast.bowlTeam, 'ready', null, tt, blink(5));
  if (o === 4 && t > 1.75) {
    const u = c01((t - 1.75) / 0.55);
    f1x = lerp(pos.f1X, X(-190), ease(u));
    f1dir = -1;
    f1pose =
      u < 1
        ? fielderPose(cast.bowlTeam, 'chase', null, tt, false)
        : fielderPose(cast.bowlTeam, 'dive', { p: c01((t - 2.3) / 0.25) }, tt, false);
  } else if (o !== null && o !== 4 && o !== 6 && o !== 0 && o !== 'W' && t > 1.72) {
    const u = t - 1.68;
    if (u < 0.5) {
      f1pose = fielderPose(cast.bowlTeam, 'chase', null, tt, false);
      f1x = lerp(pos.f1X, pos.f1X + 8, u / 0.5);
    } else if (u < 0.77) {
      f1pose = fielderPose(cast.bowlTeam, 'pick', null, tt, false);
      f1x = pos.f1X + 8;
    } else if (u < 1.1) {
      f1pose = fielderPose(cast.bowlTeam, 'throw', { p: (u - 0.77) / 0.33 }, tt, false);
      f1x = pos.f1X + 8;
    }
  } else if (o === 'W' && t > 1.95) {
    f1pose = fielderPose(cast.bowlTeam, 'cheer', null, tt, false);
  }

  if (cast.fielders[0]) person(ctx, f1x, 250, S * 0.62, f1dir, cast.fielders[0], { ...f1pose, team: cast.bowlTeam });
  if (cast.fielders[1])
    person(ctx, pos.f2X, 246, S * 0.58, -1, cast.fielders[1], {
      ...(o === 'W' && t > 1.95
        ? fielderPose(cast.bowlTeam, 'cheer', null, tt + 0.3, false)
        : fielderPose(cast.bowlTeam, 'ready', null, tt + 1, blink(9))),
      team: cast.bowlTeam,
    });

  drawPitch(ctx, X);
  drawStumps(ctx, X(-270), GY - 2, 0);

  const umpKind =
    o === 'W' && t > 2.1 ? 'out' : o === 6 && t > 2.2 ? 'six' : o === 4 && t > 2.5 ? 'four' : 'idle';
  person(ctx, pos.umpX, GY, S, 1, UMP_LOOK, umpirePose(umpKind, tt, blink(3)));

  // bowler: run-up, delivery, follow-through
  let bx = pos.bwS;
  let bp;
  if (!live) bp = bowlerPose(cast.bowlTeam, 'idle', null, tt, blink(1));
  else if (t < 0.95) {
    bx = lerp(pos.bwS, pos.bwD, Math.pow(t / 0.95, 1.3));
    bp = bowlerPose(cast.bowlTeam, 'run', { w: t * 15 }, tt, false);
  } else if (t < 1.3) {
    bx = pos.bwD;
    bp = bowlerPose(cast.bowlTeam, 'deliver', { p: (t - 0.95) / 0.35 }, tt, false);
  } else {
    const u = c01((t - 1.3) / 0.8);
    bx = pos.bwD + 60 * k * Math.sin((u * Math.PI) / 2);
    if (o === 'W' && t > 1.9) bp = bowlerPose(cast.bowlTeam, 'cele', null, tt, false);
    else if ((o === 0 || o === 6 || o === 4) && t > 2.1)
      bp = bowlerPose(cast.bowlTeam, 'sad', null, tt, false);
    else
      bp =
        u < 1
          ? bowlerPose(cast.bowlTeam, 'follow', { w: t * 10 }, tt, false)
          : bowlerPose(cast.bowlTeam, 'idle', null, 0, blink(1));
    if (u >= 1 && bp.ball) bp.ball = null;
  }
  person(ctx, bx, GY, S, 1, cast.bowler, { ...bp, team: cast.bowlTeam });

  // keeper
  let kk: 'ready' | 'jump' | 'catch' | 'stand' = 'ready';
  if (o === 'W' && t > 1.9) kk = 'jump';
  else if (o === 6 && t > 2.0) kk = 'stand';
  else if (o !== null && o !== 'W' && o !== 6 && o !== 4 && o !== 0 && t > 2.9) kk = 'catch';
  if (cast.keeper)
    person(ctx, pos.kpX, GY + 2, S, -1, cast.keeper, {
      ...keeperPose(cast.bowlTeam, kk, tt, blink(7)),
      team: cast.bowlTeam,
    });

  drawStumps(ctx, pos.stX, GY - 1, o === 'W' ? c01((t - 1.8) / 0.5) : 0);

  // batter
  let btx = pos.batX;
  let bdir = -1;
  let btp;
  if (!live) btp = batterPose(cast.batTeam, 'stance', null, tt, blink(2));
  else if (o === 'W') {
    btp =
      t < 2.1
        ? batterPose(cast.batTeam, 'swing', { p: c01((t - 1.36) / 0.5), shot: 'miss' }, tt, false)
        : batterPose(cast.batTeam, 'slump', null, tt, false);
  } else {
    const shot: Shot = o === 6 ? 'loft' : o === 4 ? 'drive' : o === 0 ? 'block' : 'push';
    btp = batterPose(cast.batTeam, 'swing', { p: c01((t - 1.45) / 0.5), shot }, tt, false);
    if (o === 6 && t > 2.3) btp = batterPose(cast.batTeam, 'cele', null, tt, false);
    if (o === 4 && t > 2.55) btp = batterPose(cast.batTeam, 'cele', null, tt, false);
    if (o === 0 && t > 2.4) btp = batterPose(cast.batTeam, 'stance', null, tt, blink(2));

    // one, two or three: actually run them, with a counter popping each time
    const n = typeof o === 'number' ? o : 0;
    if (n >= 1 && n <= 3 && t > 1.95) {
      const rt = t - 1.95;
      const legNo = Math.min(n - 1, Math.floor(rt / 0.55));
      const u = c01((rt - legNo * 0.55) / 0.55);
      const far = X(-215);
      const from = legNo % 2 ? far : pos.batX;
      const to = legNo % 2 ? pos.batX : far;
      if (rt < n * 0.55) {
        btx = lerp(from, to, ease(u));
        bdir = legNo % 2 ? 1 : -1;
        btp = batterPose(cast.batTeam, 'run', null, tt, false);
      } else {
        btx = n % 2 ? far : pos.batX;
        bdir = n % 2 ? 1 : -1;
        btp = batterPose(cast.batTeam, 'stance', null, tt, false);
      }
      for (let i = 0; i < n; i++) {
        const tp = (i + 1) * 0.55;
        if (rt > tp - 0.05 && rt < tp + 0.6) {
          const a = 1 - c01((rt - tp) / 0.6);
          ctx.globalAlpha = a;
          const px = i % 2 ? pos.batX : far;
          ctx.beginPath();
          ctx.arc(px, GY - 150 - (1 - a) * 20, 15, 0, Math.PI * 2);
          blob(ctx, SUN, 3);
          ctx.fillStyle = INK;
          ctx.font = '400 18px "Lilita One", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(i + 1), px, GY - 150 - (1 - a) * 20 + 1);
          ctx.globalAlpha = 1;
        }
      }
    }
  }
  person(ctx, btx, GY + 3, S, bdir, cast.batter, btp);

  // the ball itself, and the stumps bursting
  if (live && o !== null) {
    const b = ballPath(t, o, marks);
    if (b) {
      if (b.g != null) {
        ctx.beginPath();
        ctx.ellipse(b.p[0] + 2, b.g, b.r * 1.2, b.r * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(14,10,46,.35)';
        ctx.fill();
      }
      drawBallAt(ctx, b.p[0], b.p[1], b.r);
      // a six gets a trail, because it is going a long way
      if (o === 6 && t > 1.68 && t < 2.9) {
        ctx.globalAlpha = 0.35;
        for (let i = 1; i < 4; i++) {
          const pb = ballPath(t - i * 0.04, o, marks);
          if (pb) drawBallAt(ctx, pb.p[0], pb.p[1], pb.r * 0.8);
        }
        ctx.globalAlpha = 1;
      }
    }
    if (o === 'W' && t > 1.78 && t < 2.2) {
      ctx.save();
      ctx.translate(pos.stX, GY - 30);
      const u = c01((t - 1.78) / 0.4);
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = SUN;
      ctx.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (10 + u * 20), Math.sin(a) * (10 + u * 20));
        ctx.lineTo(Math.cos(a) * (18 + u * 34), Math.sin(a) * (18 + u * 34));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * The winners, out on the field.
 *
 * Deliberately not the six celebration: that is one batter punching the air
 * for a beat, this is the whole side spread across the ground jumping out of
 * phase with each other, with the stumps pulled and the crowd on its feet.
 */
function drawCelebration(
  ctx: CanvasRenderingContext2D,
  lw: number,
  { looks, team, t }: Celebration,
): void {
  const n = Math.max(1, looks.length);
  const gap = Math.min(150, (lw - 120) / n);
  const S = 1.25;

  looks.forEach((look, i) => {
    const x = lw / 2 + (i - (n - 1) / 2) * gap;
    // staggered, so they are not a chorus line
    const ph = t + i * 0.4;
    const dir = i % 2 ? -1 : 1;
    const [sb, sf] = shoulders(0);
    person(ctx, x, GY + 6, S, dir, look, {
      team,
      legs: 'tuck',
      lift: Math.abs(Math.sin(ph * 7)) * 18 + 4,
      back: armTo(sb, Math.PI - 0.8, 32),
      front: armTo(sf, Math.PI + 0.8, 32),
      t: ph,
    });
  });

  // caps going up
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 14; i++) {
    const seed = crowdSeed(i + 300);
    const u = (t * 0.45 + seed) % 1;
    const x = 40 + seed * (lw - 80);
    const y = GY - 40 - u * 240;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(u * 7 + seed * 6);
    ctx.beginPath();
    ctx.roundRect(-9, -5, 18, 10, 4);
    blob(ctx, i % 3 === 0 ? SUN : i % 3 === 1 ? PAPER : '#FF5FA8', 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
