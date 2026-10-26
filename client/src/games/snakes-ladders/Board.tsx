import { useEffect, useRef } from 'react';
import { LADDERS, type Look, type MoveStep, type SnakesView } from '@holla/shared';
import { useCanvas, ease, lerp } from '../../lib/canvas';
import { INK, SUN, TEAL } from '../../art/palette';
import { drawFighter } from '../../art/fighter';
import {
  BOARD,
  colourOfSnake,
  drawLadder,
  drawSnake,
  drawTiles,
  restXY,
  walkXY,
  type SnakeArt,
} from './art';

type Props = {
  view: SnakesView;
  me: string;
  /** Seat order, so a fighter keeps the same jersey all game. */
  seatIndexOf: (playerId: string) => number;
  lookOf: (playerId: string) => Look;
  /**
   * Fired as each leg of a move begins. The board owns the timeline, so it is
   * the only thing that knows *when* a ladder is climbed or a box is opened;
   * the table uses these to land its stamps and the card reveal on the beat
   * rather than all at once when the view arrives.
   */
  onCue?: (step: MoveStep, playerId: string) => void;
};

/** Local animation state, deliberately separate from anything the server sends. */
type Token = {
  x: number;
  y: number;
  hop: number;
  /** Facing, fed to the fighter: -1..1 across, and fy < -0.7 shows its back. */
  fx: number;
  fy: number;
  moving: boolean;
  /** Walk cycle phase, advanced only while moving. */
  walk: number;
  /** Queue of legs still to play for this token. */
  queue: MoveStep[];
  /** Progress through the leg at the head of the queue. */
  t: number;
  /** Whether the leg at the head of the queue has announced itself yet. */
  cued: boolean;
  fromTile: number;
};

/** Per-snake drawing state the server has no business knowing about. */
type SnakeFx = { bulge: number; bonk: number };

export function SnakesBoard({ view, me, seatIndexOf, lookOf, onCue }: Props) {
  /**
   * The server owns positions; this owns pixels. A new turnSeq queues the legs
   * of that move, and the token walks them. Anything not animating simply eases
   * toward where the server says it is, which is also how a reconnecting
   * client catches up without replaying a move it never saw.
   */
  const tokens = useRef(new Map<string, Token>());
  const snakeFx = useRef(new Map<number, SnakeFx>());
  const playedSeq = useRef(0);
  // Kept in a ref so the draw loop never closes over a stale callback.
  const cueRef = useRef(onCue);
  cueRef.current = onCue;

  useEffect(() => {
    const turn = view.lastTurn;
    if (!turn || view.turnSeq === playedSeq.current) return;
    playedSeq.current = view.turnSeq;

    const token = tokens.current.get(turn.playerId);
    if (!token) return;
    token.queue = [...turn.steps];
    token.t = 0;
    token.cued = false;

    // A shield bonk is the snake's moment, not the player's: it sees stars.
    for (const step of turn.steps) {
      if (step.kind === 'bonk') {
        const fx = snakeFx.current.get(step.tile) ?? { bulge: -1, bonk: 0 };
        fx.bonk = 1.1;
        snakeFx.current.set(step.tile, fx);
      }
    }
  }, [view.turnSeq, view.lastTurn]);

  const canvasRef = useCanvas(
    ({ ctx, width, time, delta, animated }) => {
      const scale = width / BOARD;
      ctx.save();
      ctx.scale(scale, scale);

      // make sure every seated player has a token before anything reads one
      for (const seat of view.seats) {
        if (!tokens.current.has(seat.playerId)) {
          const [x, y] = walkXY(seat.pos);
          tokens.current.set(seat.playerId, {
            x, y, hop: 0, fx: 0, fy: 1, moving: false, walk: 0,
            queue: [], t: 0, cued: false, fromTile: seat.pos,
          });
        }
      }

      drawTiles(ctx, time);
      for (const [foot, head] of LADDERS) drawLadder(ctx, foot, head);

      // Snakes look at whoever is taking their turn. It costs nothing and it
      // is the single thing that makes the board feel watched.
      const watching = tokens.current.get(view.turnPlayerId);
      const lookAt: [number, number] | null = watching
        ? [watching.x, watching.y - watching.hop - 30]
        : null;

      view.snakes.forEach((snake, i) => {
        const fx = snakeFx.current.get(snake.head) ?? { bulge: -1, bonk: 0 };
        snakeFx.current.set(snake.head, fx);
        if (fx.bonk > 0) fx.bonk = Math.max(0, fx.bonk - delta);

        const art: SnakeArt = { ...snake, seed: i * 1.7, bulge: fx.bulge, bonk: fx.bonk };
        drawSnake(ctx, art, colourOfSnake(snake, i), time, lookAt);
      });

      // Everyone shares a tile sometimes, so the ones behind are drawn first
      // and the token in turn goes on top.
      const order = [...view.seats].sort((a, b) =>
        a.playerId === view.turnPlayerId ? 1 : b.playerId === view.turnPlayerId ? -1 : 0,
      );
      // Who is standing where, in a stable order, so a shared tile fans out
      // the same way on every client and does not shuffle between frames.
      const sharing = new Map<number, string[]>();
      for (const seat of view.seats) {
        const at = sharing.get(seat.pos) ?? [];
        at.push(seat.playerId);
        sharing.set(seat.pos, at);
      }
      for (const at of sharing.values()) at.sort();

      for (const seat of order) {
        const token = tokens.current.get(seat.playerId);
        if (!token) continue;
        const here = sharing.get(seat.pos) ?? [seat.playerId];
        stepToken(
          token,
          seat.pos,
          delta,
          animated,
          snakeFx.current,
          [here.indexOf(seat.playerId), here.length],
          (step) => cueRef.current?.(step, seat.playerId),
        );
        drawToken(ctx, token, {
          look: lookOf(seat.playerId),
          team: seatIndexOf(seat.playerId),
          crowd: here.length,
          isTurn: seat.playerId === view.turnPlayerId,
          isMe: seat.playerId === me,
          frozen: seat.frozen,
          shield: seat.shield,
          time,
        });
      }

      ctx.restore();
    },
    { square: true },
  );

  return <canvas ref={canvasRef} className="sl-board" aria-label="Snakes and ladders board" />;
}

/** Advances one token: play its queued legs, else ease to the server position. */
function stepToken(
  token: Token,
  serverTile: number,
  delta: number,
  animated: boolean,
  snakeFx: Map<number, SnakeFx>,
  /** Where this player stands among everyone sharing the tile. */
  [slot, sharing]: [number, number],
  cue: (step: MoveStep) => void,
): void {
  const leg = token.queue[0];

  if (!leg || !animated) {
    const [x, y] = restXY(serverTile, slot, sharing);
    if (!animated) {
      // Under reduced motion there is no timeline to hang them on, so every
      // leg announces itself at once and the table still tells the story.
      for (const step of token.queue) cue(step);
      token.x = x;
      token.y = y;
      token.queue = [];
    } else {
      token.x = lerp(token.x, x, 0.2);
      token.y = lerp(token.y, y, 0.2);
    }
    token.hop = 0;
    token.moving = false;
    token.fy = 1;
    token.fx = 0;
    token.fromTile = serverTile;
    return;
  }

  if (!token.cued) {
    token.cued = true;
    cue(leg);
  }

  // A walk is one hop per tile; a jump glides; a bonk or a card is just a beat
  // where the token holds still while the UI says what happened.
  const perLeg =
    leg.kind === 'walk'
      ? 0.12 * leg.path.length
      : leg.kind === 'bonk' || leg.kind === 'card' || leg.kind === 'charmed'
        ? 0.5
        : 0.7;
  token.t += delta / perLeg;
  token.moving = leg.kind === 'walk';
  if (token.moving) token.walk += delta * 14;

  const face = (ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax;
    const dy = by - ay;
    const d = Math.hypot(dx, dy) || 1;
    token.fx = Math.max(-1, Math.min(1, (dx / d) * 1.4));
    // Up the board is away from us, so a fighter climbing turns its back.
    token.fy = Math.max(-1, Math.min(1, (dy / d) * 1.4));
  };

  if (leg.kind === 'bonk' || leg.kind === 'charmed') {
    // a little hop on the spot: a recoil off the nose, or a relieved bounce
    token.hop = Math.sin(Math.min(1, token.t) * Math.PI) * 10;
    token.fy = 1;
    token.fx = 0;
  } else if (leg.kind === 'card') {
    token.hop = 0;
    token.fy = 1;
    token.fx = 0;
  } else if (leg.kind === 'walk') {
    const total = leg.path.length;
    const at = Math.min(total - 1, Math.floor(token.t * total));
    const within = token.t * total - at;
    const prevTile = at === 0 ? token.fromTile : (leg.path[at - 1] ?? token.fromTile);
    const nextTile = leg.path[at] ?? prevTile;
    const [ax, ay] = walkXY(prevTile);
    const [bx, by] = walkXY(nextTile);
    token.x = lerp(ax, bx, Math.min(1, within));
    token.y = lerp(ay, by, Math.min(1, within));
    token.hop = Math.sin(Math.min(1, within) * Math.PI) * 18;
    face(ax, ay, bx, by);
  } else {
    // ladder, snake, jump and swap all glide from one tile to another
    const [ax, ay] = walkXY(leg.from);
    const [bx, by] = walkXY(leg.to);
    const u = ease(Math.min(1, token.t));
    token.x = lerp(ax, bx, u);
    token.y = lerp(ay, by, u);
    // ladders and rocket boots arc up, snakes slide down flat
    token.hop = leg.kind === 'ladder' || leg.kind === 'jump' ? Math.sin(u * Math.PI) * 26 : 0;
    face(ax, ay, bx, by);
    // being swallowed travels as a lump down the snake that ate you
    if (leg.kind === 'snake') {
      const fx = snakeFx.get(leg.from) ?? { bulge: -1, bonk: 0 };
      fx.bulge = u;
      snakeFx.set(leg.from, fx);
    }
  }

  if (token.t >= 1) {
    const done = token.queue.shift();
    token.t = 0;
    token.hop = 0;
    token.cued = false;
    if (done) {
      if (done.kind === 'walk') {
        token.fromTile = done.path[done.path.length - 1] ?? token.fromTile;
      } else if (done.kind === 'bonk' || done.kind === 'charmed') {
        token.fromTile = done.tile;
      } else if (done.kind !== 'card') {
        token.fromTile = done.to;
        if (done.kind === 'snake') {
          const fx = snakeFx.get(done.from);
          if (fx) fx.bulge = -1;
        }
      }
    }
  }
}

type TokenStyle = {
  look: Look;
  team: number;
  /** How many players are on this tile, so a pile-up still fits. */
  crowd: number;
  isTurn: boolean;
  isMe: boolean;
  frozen: boolean;
  shield: boolean;
  time: number;
};

function drawToken(ctx: CanvasRenderingContext2D, t: Token, s: TokenStyle): void {
  const scale = s.crowd > 3 ? 0.62 : s.crowd > 1 ? 0.74 : 0.9;

  ctx.save();
  ctx.translate(t.x, t.y - t.hop);

  // a ring pulsing out from under whoever is to roll
  if (s.isTurn) {
    const pr = (s.time * 1.5) % 1;
    ctx.beginPath();
    ctx.ellipse(0, t.hop, 26 + pr * 10, 9 + pr * 3, 0, 0, Math.PI * 2);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = `rgba(255,194,26,${1 - pr})`;
    ctx.stroke();
  }

  // the shadow stays on the tile while the fighter hops above it
  ctx.beginPath();
  ctx.ellipse(2, t.hop + 1, 16 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(14,10,46,.3)';
  ctx.fill();

  ctx.scale(scale, scale);

  if (s.frozen) ctx.globalAlpha = 0.85;
  drawFighter(ctx, s.look, {
    team: s.team,
    fx: t.fx,
    fy: t.fy,
    walk: t.walk,
    moving: t.moving,
    punching: false,
    stunned: false,
    hurt: false,
    blink: (s.time * 1000 + s.team * 517) % 3300 < 130,
    t: s.time,
    num: s.team + 1,
  });
  ctx.globalAlpha = 1;

  if (s.frozen) {
    ctx.beginPath();
    ctx.roundRect(-24, -80, 48, 82, 14);
    ctx.fillStyle = 'rgba(95,211,232,.4)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = TEAL;
    ctx.stroke();
  }
  if (s.shield) {
    ctx.beginPath();
    ctx.arc(0, -34, 40, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(47,139,255,${0.5 + Math.sin(s.time * 5) * 0.3})`;
    ctx.stroke();
  }

  // a small marker over your own fighter, because at 15 players you lose it
  if (s.isMe) {
    ctx.beginPath();
    ctx.moveTo(-7, -76);
    ctx.lineTo(7, -76);
    ctx.lineTo(0, -66);
    ctx.closePath();
    ctx.fillStyle = SUN;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  ctx.restore();
}
