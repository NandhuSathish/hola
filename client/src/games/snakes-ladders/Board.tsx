import { useEffect, useRef } from 'react';
import {
  COLUMNS,
  LADDERS,
  LAST_TILE,
  MYSTERY_TILES,
  tileToCell,
  type LiveSnake,
  type MoveStep,
  type SnakesView,
} from '@holla/shared';
import { useCanvas, ease, lerp, token } from '../../lib/canvas';

type Props = {
  view: SnakesView;
  me: string;
  colourOf: (playerId: string) => string;
  labelOf: (playerId: string) => string;
};

/** Where a token rests, in board units of 0..1000. */
const BOARD = 1000;
const PAD = 14;

function tileCentre(tile: number): [number, number] {
  const { row, col } = tileToCell(tile);
  const size = (BOARD - PAD * 2) / COLUMNS;
  return [PAD + (col + 0.5) * size, PAD + (COLUMNS - 1 - row + 0.5) * size];
}

/** Local animation state, deliberately separate from anything the server sends. */
type Token = {
  x: number;
  y: number;
  hop: number;
  /** Queue of legs still to play for this token. */
  queue: MoveStep[];
  /** Progress through the leg at the head of the queue. */
  t: number;
  /** Where the current leg started. */
  fromX: number;
  fromY: number;
  fromTile: number;
};

export function SnakesBoard({ view, me, colourOf, labelOf }: Props) {
  /**
   * The server owns positions; this owns pixels. A new turnSeq queues the legs
   * of that move, and the token walks them. Anything not animating simply eases
   * toward where the server says it is, which is also how a reconnecting
   * client catches up without replaying a move it never saw.
   */
  const tokens = useRef(new Map<string, Token>());
  const playedSeq = useRef(0);

  useEffect(() => {
    const turn = view.lastTurn;
    if (!turn || view.turnSeq === playedSeq.current) return;
    playedSeq.current = view.turnSeq;

    const token = tokens.current.get(turn.playerId);
    if (!token) return;
    token.queue = [...turn.steps];
    token.t = 0;
    token.fromX = token.x;
    token.fromY = token.y;
  }, [view.turnSeq, view.lastTurn]);

  const canvasRef = useCanvas(
    ({ ctx, width, time, delta, animated }) => {
      const scale = width / BOARD;
      ctx.save();
      ctx.scale(scale, scale);

      drawTiles(ctx, time, animated);
      for (const [foot, head] of LADDERS) drawLadder(ctx, foot, head);
      view.snakes.forEach((snake, i) => drawSnake(ctx, snake, i, time, animated));

      // make sure every seated player has a token to draw
      for (const seat of view.seats) {
        if (!tokens.current.has(seat.playerId)) {
          const [x, y] = tileCentre(seat.pos);
          tokens.current.set(seat.playerId, {
            x, y, hop: 0, queue: [], t: 0, fromX: x, fromY: y, fromTile: seat.pos,
          });
        }
      }

      for (const seat of view.seats) {
        const token = tokens.current.get(seat.playerId);
        if (!token) continue;
        stepToken(token, seat.pos, delta, animated);
        drawToken(ctx, token, colourOf(seat.playerId), labelOf(seat.playerId), seat.playerId === me);
      }

      ctx.restore();
    },
    { square: true },
  );

  return <canvas ref={canvasRef} className="sl-board" aria-label="Snakes and ladders board" />;
}

/** Advances one token: play its queued legs, else ease to the server position. */
function stepToken(token: Token, serverTile: number, delta: number, animated: boolean): void {
  const leg = token.queue[0];

  if (!leg || !animated) {
    const [x, y] = tileCentre(serverTile);
    if (!animated) {
      token.x = x;
      token.y = y;
      token.hop = 0;
      token.queue = [];
    } else {
      token.x = lerp(token.x, x, 0.2);
      token.y = lerp(token.y, y, 0.2);
      token.hop = 0;
    }
    token.fromTile = serverTile;
    return;
  }

  // A walk is one hop per tile; a jump glides; a bonk or a card is just a beat
  // where the token holds still while the UI says what happened.
  const perLeg =
    leg.kind === 'walk' ? 0.12 * leg.path.length : leg.kind === 'bonk' || leg.kind === 'card' ? 0.5 : 0.7;
  token.t += delta / perLeg;

  if (leg.kind === 'bonk') {
    // a little recoil off the snake's nose
    token.hop = Math.sin(Math.min(1, token.t) * Math.PI) * 10;
  } else if (leg.kind === 'card') {
    token.hop = 0;
  } else if (leg.kind === 'walk') {
    const total = leg.path.length;
    const at = Math.min(total - 1, Math.floor(token.t * total));
    const within = token.t * total - at;
    const prevTile = at === 0 ? token.fromTile : (leg.path[at - 1] ?? token.fromTile);
    const nextTile = leg.path[at] ?? prevTile;
    const [ax, ay] = tileCentre(prevTile);
    const [bx, by] = tileCentre(nextTile);
    token.x = lerp(ax, bx, Math.min(1, within));
    token.y = lerp(ay, by, Math.min(1, within));
    token.hop = Math.sin(Math.min(1, within) * Math.PI) * 18;
  } else {
    // ladder, snake, jump and swap all glide from one tile to another
    const [ax, ay] = tileCentre(leg.from);
    const [bx, by] = tileCentre(leg.to);
    const u = ease(Math.min(1, token.t));
    token.x = lerp(ax, bx, u);
    token.y = lerp(ay, by, u);
    // ladders and rocket boots arc up, snakes slide down flat
    token.hop = leg.kind === 'ladder' || leg.kind === 'jump' ? Math.sin(u * Math.PI) * 26 : 0;
  }

  if (token.t >= 1) {
    const done = token.queue.shift();
    token.t = 0;
    token.hop = 0;
    if (done) {
      if (done.kind === 'walk') {
        token.fromTile = done.path[done.path.length - 1] ?? token.fromTile;
      } else if (done.kind === 'bonk') {
        token.fromTile = done.tile;
      } else if (done.kind !== 'card') {
        token.fromTile = done.to;
      }
    }
    const [x, y] = tileCentre(token.fromTile);
    token.fromX = x;
    token.fromY = y;
  }
}

function drawTiles(ctx: CanvasRenderingContext2D, time: number, animated: boolean): void {
  const size = (BOARD - PAD * 2) / COLUMNS;
  const line = token('--line', '#0E0A2E');
  const paper = token('--paper', '#FFF4DC');
  const paper2 = token('--paper-2', '#F1E0B8');
  const sun = token('--sun', '#FFC21A');

  ctx.lineWidth = 3;
  ctx.strokeStyle = line;
  ctx.font = `500 ${size * 0.26}px 'Nunito', system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  for (let tile = 1; tile <= LAST_TILE; tile++) {
    const { row, col } = tileToCell(tile);
    const x = PAD + col * size;
    const y = PAD + (COLUMNS - 1 - row) * size;

    const special = MYSTERY_TILES.includes(tile);
    ctx.fillStyle = special ? sun : (row + col) % 2 === 0 ? paper : paper2;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, size - 4, size - 4, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = line;
    ctx.globalAlpha = 0.55;
    ctx.fillText(String(tile), x + 9, y + 7);
    ctx.globalAlpha = 1;
  }

  // the home tile gets a gentle pulse so the goal reads at a glance
  const [hx, hy] = tileCentre(LAST_TILE);
  const pulse = animated ? 1 + Math.sin(time * 2.4) * 0.05 : 1;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = token('--mint', '#22C97A');
  ctx.beginPath();
  ctx.roundRect(-size / 2 + 4, -size / 2 + 4, size - 8, size - 8, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawLadder(ctx: CanvasRenderingContext2D, foot: number, head: number): void {
  const [x0, y0] = tileCentre(foot);
  const [x1, y1] = tileCentre(head);
  const line = token('--line', '#0E0A2E');
  const sun = token('--sun', '#FFC21A');

  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  // offset perpendicular to the run, to make two rails
  const nx = (-dy / len) * 13;
  const ny = (dx / len) * 13;

  ctx.lineCap = 'round';
  for (const [colour, w] of [[line, 13], [sun, 7]] as const) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = w;
    for (const side of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(x0 + nx * side, y0 + ny * side);
      ctx.lineTo(x1 + nx * side, y1 + ny * side);
      ctx.stroke();
    }
  }

  const rungs = Math.max(2, Math.round(len / 46));
  ctx.strokeStyle = line;
  ctx.lineWidth = 4;
  for (let i = 1; i < rungs; i++) {
    const t = i / rungs;
    const cx = lerp(x0, x1, t);
    const cy = lerp(y0, y1, t);
    ctx.beginPath();
    ctx.moveTo(cx + nx, cy + ny);
    ctx.lineTo(cx - nx, cy - ny);
    ctx.stroke();
  }
}

const SNAKE_COLOURS = ['--mint', '--pink', '--sky', '--sun', '--red', '--orange', '--teal', '--mint'];

function drawSnake(
  ctx: CanvasRenderingContext2D,
  snake: LiveSnake,
  index: number,
  time: number,
  animated: boolean,
): void {
  const [hx, hy] = tileCentre(snake.head);
  const [tx, ty] = tileCentre(snake.tail);
  // Noodle is always purple so it reads as the one that moves
  const colour = snake.boss
    ? token('--purple', '#B48CFF')
    : token(SNAKE_COLOURS[index % SNAKE_COLOURS.length] ?? '--mint', '#22C97A');
  const line = token('--line', '#0E0A2E');
  const asleep = snake.sleep > 0;

  // a slow sine along the body, so the snakes look alive without moving
  const wobble = animated && !asleep ? Math.sin(time * 1.3 + index * 1.7) * 26 : 0;
  const midX = (hx + tx) / 2 + wobble;
  const midY = (hy + ty) / 2;

  // a charmed snake is drawn faded, so you can see it is safe to step on
  ctx.globalAlpha = asleep ? 0.4 : 1;

  const width = snake.boss ? 32 : 26;
  ctx.lineCap = 'round';
  for (const [stroke, w] of [[line, width], [colour, width - 9]] as const) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(midX, midY, hx, hy);
    ctx.stroke();
  }

  const radius = snake.boss ? 23 : 19;
  ctx.fillStyle = colour;
  ctx.strokeStyle = line;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(hx, hy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = line;
  if (asleep) {
    // closed eyes, so a sleeping snake is obvious at a glance
    ctx.lineWidth = 3;
    ctx.strokeStyle = line;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + side * 6, hy - 4, 4, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  } else {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + side * 6, hy - 5, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Noodle wears a crown
  if (snake.boss) {
    ctx.fillStyle = token('--sun', '#FFC21A');
    ctx.strokeStyle = line;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx - 13, hy - radius - 2);
    ctx.lineTo(hx - 8, hy - radius - 14);
    ctx.lineTo(hx, hy - radius - 5);
    ctx.lineTo(hx + 8, hy - radius - 14);
    ctx.lineTo(hx + 13, hy - radius - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

function drawToken(
  ctx: CanvasRenderingContext2D,
  t: Token,
  colour: string,
  label: string,
  isMe: boolean,
): void {
  const line = token('--line', '#0E0A2E');
  const paper = token('--paper', '#FFF4DC');
  const x = t.x;
  const y = t.y - t.hop;

  // shadow stays on the tile while the token hops above it
  ctx.fillStyle = 'rgba(14,10,46,0.25)';
  ctx.beginPath();
  ctx.ellipse(t.x, t.y + 16, 15, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colour;
  ctx.strokeStyle = line;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (isMe) {
    ctx.strokeStyle = paper;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 27, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = paper;
  ctx.font = "400 22px 'Lilita One', system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.slice(0, 2).toUpperCase(), x, y + 1);
}
