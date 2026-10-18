import type { GameEvent, PlayerRef, RoundResult } from '../types.js';
import {
  CROWD_TILES,
  FIRST_TILE,
  LADDERS,
  LAST_TILE,
  MYSTERY_TILES,
  SNAKES,
  ladderAt,
  walkPath,
} from './board.js';
import {
  BANANA_TILES,
  CHARM_ROUNDS,
  QUAKE_TILES,
  ROCKET_TILES,
  drawCard,
  type CardId,
} from './cards.js';
import { MAX_ROLLS_PER_TURN, type SnakesSettings } from './settings.js';
import type {
  LiveSnake,
  MoveStep,
  SnakesAction,
  SnakesSeat,
  SnakesState,
  SnakesView,
} from './types.js';

export type Ctx = { now: number; rng: () => number };

export type ActionResult =
  | { ok: true; state: SnakesState; events: GameEvent[] }
  | { ok: false; error: string };

/** How far a jump-then-jump chain may run before it is cut off. */
const MAX_CHAIN = 4;
/** Noodle relocates on these rounds. */
const NOODLE_EVERY = 3;

function clone(state: SnakesState): SnakesState {
  return {
    ...state,
    seats: state.seats.map((s) => ({ ...s, stats: { ...s.stats } })),
    snakes: state.snakes.map((s) => ({ ...s })),
    lastTurn: state.lastTurn
      ? { ...state.lastTurn, dice: [...state.lastTurn.dice], steps: [...state.lastTurn.steps] }
      : null,
    settings: { ...state.settings },
  };
}

const seatOf = (state: SnakesState, id: string) => state.seats.find((s) => s.id === id);
const currentSeat = (state: SnakesState) => state.seats[state.turnIndex];

const rollDie = (rng: () => number) => 1 + Math.floor(rng() * 6);
const pick = <T>(items: readonly T[], rng: () => number): T | undefined =>
  items[Math.floor(rng() * items.length)];

/** An awake snake whose head is on this tile. Sleeping ones let you pass. */
function awakeSnakeAt(state: SnakesState, tile: number): LiveSnake | undefined {
  return state.snakes.find((s) => s.head === tile && s.sleep <= 0);
}

export function setup(players: PlayerRef[], settings: SnakesSettings, ctx: Ctx): SnakesState {
  const snakes: LiveSnake[] = SNAKES.map(([head, tail]) => ({
    head,
    tail,
    sleep: 0,
    boss: false,
  }));

  // Noodle starts where the mock puts it and wanders from there.
  if (settings.noodle) snakes.push({ head: 83, tail: 63, sleep: 0, boss: true });

  return {
    seats: players.map((p) => ({
      id: p.id,
      pos: FIRST_TILE,
      present: true,
      shield: false,
      double: false,
      frozen: false,
      stats: { ladders: 0, bites: 0, boxes: 0, best: 0 },
    })),
    snakes,
    turnIndex: 0,
    rollsThisTurn: 0,
    turnStartedAt: ctx.now,
    round: 1,
    finished: false,
    winnerId: null,
    lastTurn: null,
    turnSeq: 0,
    settings,
  };
}

/**
 * Moves Noodle somewhere new, avoiding anything that already means something:
 * ladder ends, other snake heads, the special tiles and home.
 */
function moveNoodle(state: SnakesState, rng: () => number, events: GameEvent[]): void {
  const noodle = state.snakes.find((s) => s.boss);
  if (!noodle) return;

  const taken = new Set<number>([
    ...LADDERS.flat(),
    ...state.snakes.filter((s) => s !== noodle).map((s) => s.head),
    ...MYSTERY_TILES,
    ...CROWD_TILES,
    LAST_TILE,
  ]);

  let head = noodle.head;
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = 38 + Math.floor(rng() * 60); // 38..97
    if (!taken.has(candidate)) {
      head = candidate;
      break;
    }
  }

  noodle.head = head;
  noodle.tail = Math.max(2, head - (14 + Math.floor(rng() * 17)));
  events.push({ kind: 'noodle', text: `Noodle slithered over. Its head is now on ${head}.` });
}

/** Wraps to the next seat, counting rounds and ageing everything that ticks. */
function nextTurn(state: SnakesState, ctx: Ctx, events: GameEvent[]): void {
  const n = state.seats.length;
  if (n === 0) return;

  for (let step = 0; step < n; step++) {
    const next = (state.turnIndex + 1) % n;
    const wrapped = next <= state.turnIndex;
    state.turnIndex = next;

    if (wrapped) {
      state.round += 1;
      for (const snake of state.snakes) if (snake.sleep > 0) snake.sleep -= 1;
      if (state.settings.noodle && state.round > 1 && state.round % NOODLE_EVERY === 1) {
        moveNoodle(state, ctx.rng, events);
      }
    }

    // A frozen player burns their turn here rather than taking one.
    const seat = state.seats[state.turnIndex];
    if (seat?.frozen) {
      seat.frozen = false;
      events.push({ kind: 'frozen', text: 'is frozen and misses this turn', playerId: seat.id });
      continue;
    }
    break;
  }

  state.rollsThisTurn = 0;
  state.turnStartedAt = ctx.now;
}

/** Applies a drawn card. Returns true when the player's tile changed. */
function applyCard(
  state: SnakesState,
  seat: SnakesSeat,
  card: CardId,
  steps: MoveStep[],
  events: GameEvent[],
  rng: () => number,
): boolean {
  switch (card) {
    case 'rocket': {
      const to = Math.min(LAST_TILE - 1, seat.pos + ROCKET_TILES);
      steps.push({ kind: 'jump', from: seat.pos, to });
      events.push({ kind: 'rocket', text: `blasted ahead to ${to}`, playerId: seat.id });
      seat.pos = to;
      return true;
    }
    case 'banana': {
      const to = Math.max(FIRST_TILE, seat.pos - BANANA_TILES);
      steps.push({ kind: 'jump', from: seat.pos, to });
      events.push({ kind: 'banana', text: `slipped back to ${to}`, playerId: seat.id });
      seat.pos = to;
      return true;
    }
    case 'swap': {
      const others = state.seats.filter((s) => s.id !== seat.id);
      const other = pick(others, rng);
      if (!other) return false;
      const mine = seat.pos;
      steps.push({ kind: 'swap', withPlayerId: other.id, from: mine, to: other.pos });
      events.push({ kind: 'swap', text: `swapped places with someone on ${other.pos}`, playerId: seat.id });
      seat.pos = other.pos;
      other.pos = mine;
      return true;
    }
    case 'shield':
      seat.shield = true;
      events.push({ kind: 'shield', text: 'picked up a snake shield', playerId: seat.id });
      return false;
    case 'double':
      seat.double = true;
      events.push({ kind: 'double', text: 'will roll two dice next turn', playerId: seat.id });
      return false;
    case 'freeze': {
      const n = state.seats.length;
      const next = state.seats[(state.turnIndex + 1) % n];
      if (next && next.id !== seat.id) {
        next.frozen = true;
        events.push({ kind: 'freeze', text: 'got frozen and will miss a turn', playerId: next.id });
      }
      return false;
    }
    case 'charm': {
      const ahead = state.snakes
        .filter((s) => s.head > seat.pos && s.sleep <= 0)
        .sort((a, b) => a.head - b.head)[0];
      const target = ahead ?? state.snakes.find((s) => s.sleep <= 0);
      if (target) {
        target.sleep = CHARM_ROUNDS;
        events.push({ kind: 'charm', text: `put the snake on ${target.head} to sleep`, playerId: seat.id });
      }
      return false;
    }
    case 'quake': {
      events.push({ kind: 'quake', text: 'set off an earthquake', playerId: seat.id });
      for (const other of state.seats) {
        if (other.id === seat.id) continue;
        other.pos = Math.max(FIRST_TILE, other.pos - QUAKE_TILES);
      }
      return false;
    }
    default:
      return false;
  }
}

/**
 * Whatever the tile does once a player has landed: ladders carry up, awake
 * snakes swallow down unless a shield takes the hit, and gift tiles hand out a
 * card whose effect may land them somewhere new all over again.
 */
function resolveTile(
  state: SnakesState,
  seat: SnakesSeat,
  steps: MoveStep[],
  events: GameEvent[],
  rng: () => number,
): void {
  for (let depth = 0; depth < MAX_CHAIN; depth++) {
    const up = ladderAt(seat.pos);
    if (up !== null) {
      steps.push({ kind: 'ladder', from: seat.pos, to: up });
      events.push({ kind: 'ladder', text: `climbed from ${seat.pos} to ${up}`, playerId: seat.id });
      seat.pos = up;
      seat.stats.ladders += 1;
      continue;
    }

    const snake = awakeSnakeAt(state, seat.pos);
    if (snake) {
      if (seat.shield) {
        seat.shield = false;
        steps.push({ kind: 'bonk', tile: seat.pos });
        events.push({ kind: 'bonk', text: `bonked the snake on ${seat.pos}`, playerId: seat.id });
        return;
      }
      steps.push({ kind: 'snake', from: seat.pos, to: snake.tail });
      events.push({
        kind: 'snake',
        text: `was swallowed on ${seat.pos} and popped out on ${snake.tail}`,
        playerId: seat.id,
      });
      seat.pos = snake.tail;
      seat.stats.bites += 1;
      continue;
    }

    if (state.settings.mysteryBoxes && MYSTERY_TILES.includes(seat.pos)) {
      const card = drawCard(rng);
      steps.push({ kind: 'card', card: card.id });
      events.push({ kind: 'box', text: `opened a box: ${card.name}`, playerId: seat.id });
      seat.stats.boxes += 1;
      // Only a card that moved them needs the tile resolving again.
      if (applyCard(state, seat, card.id, steps, events, rng)) continue;
      return;
    }

    return;
  }
}

/** One roll, fully resolved. Shared by a player's action and a turn timeout. */
function takeRoll(state: SnakesState, seat: SnakesSeat, ctx: Ctx): GameEvent[] {
  const events: GameEvent[] = [];
  const steps: MoveStep[] = [];

  const count = seat.double ? 2 : 1;
  seat.double = false;
  const dice = Array.from({ length: count }, () => rollDie(ctx.rng));
  const total = dice.reduce((a, b) => a + b, 0);
  const before = seat.pos;

  // Exact finish: an overshoot is still walked, so the token bounces back off
  // 100. With it off, the roll is clamped and they simply land on 100.
  const overshot = state.settings.exactFinish && seat.pos + total > LAST_TILE;
  const distance =
    !state.settings.exactFinish && seat.pos + total >= LAST_TILE ? LAST_TILE - seat.pos : total;

  const path = walkPath(seat.pos, distance);
  const landed = path[path.length - 1];
  if (landed !== undefined) {
    steps.push({ kind: 'walk', path });
    seat.pos = landed;
  }

  events.push({ kind: 'roll', text: `rolled ${dice.join(' + ')}`, playerId: seat.id });
  if (overshot) events.push({ kind: 'bounce', text: `bounced off ${LAST_TILE}`, playerId: seat.id });

  resolveTile(state, seat, steps, events, ctx.rng);
  seat.stats.best = Math.max(seat.stats.best, seat.pos - before);

  state.lastTurn = { playerId: seat.id, dice, steps, overshot };
  state.turnSeq += 1;
  state.rollsThisTurn += 1;

  // Checking every seat rather than just the roller is defensive: no card can
  // currently reach 100 (rocket caps at 99, the rest move backwards), but a
  // future one might, and a missed win would be a silent stall.
  const home = state.seats.find((s) => s.pos === LAST_TILE);
  if (home) {
    state.finished = true;
    state.winnerId = home.id;
    events.push({ kind: 'win', text: `reached ${LAST_TILE} and won`, playerId: home.id });
    return events;
  }

  const rolledSix = dice.length === 1 && dice[0] === 6;
  const goAgain =
    state.settings.rollAgainOnSix && rolledSix && state.rollsThisTurn < MAX_ROLLS_PER_TURN;

  if (goAgain) {
    events.push({ kind: 'again', text: 'rolled a six and goes again', playerId: seat.id });
    state.turnStartedAt = ctx.now;
  } else {
    nextTurn(state, ctx, events);
  }

  return events;
}

export function onAction(
  input: SnakesState,
  playerId: string,
  action: SnakesAction,
  ctx: Ctx,
): ActionResult {
  if (input.finished) return { ok: false, error: 'The game is over.' };

  // Actions arrive straight off a socket, so nothing about the shape is
  // trusted. An illegal move is an error, never a throw.
  if (typeof action !== 'object' || action === null || typeof action.type !== 'string') {
    return { ok: false, error: 'That move makes no sense here.' };
  }
  if (action.type !== 'roll') return { ok: false, error: 'That move makes no sense here.' };

  const state = clone(input);
  const seat = seatOf(state, playerId);
  if (!seat) return { ok: false, error: 'You are not in this game.' };
  if (currentSeat(state)?.id !== playerId) return { ok: false, error: 'Wait for your turn.' };

  return { ok: true, state, events: takeRoll(state, seat, ctx) };
}

/** Turn timeout: roll for them so one person cannot stall the board. */
export function onTick(
  input: SnakesState,
  ctx: Ctx,
): { state: SnakesState; events: GameEvent[] } | null {
  if (input.finished || input.settings.turnTimer === 0) return null;

  const deadline = input.turnStartedAt + input.settings.turnTimer * 1000;
  if (ctx.now < deadline) return null;

  const state = clone(input);
  const seat = currentSeat(state);
  if (!seat) return null;

  const events: GameEvent[] = [
    { kind: 'timeout', text: 'ran out of time, so the dice rolled themselves', playerId: seat.id },
  ];
  events.push(...takeRoll(state, seat, ctx));
  return { state, events };
}

function publicSeats(state: SnakesState): SnakesView['seats'] {
  return state.seats.map((s) => ({
    playerId: s.id,
    pos: s.pos,
    connected: s.present,
    ladders: s.stats.ladders,
    bites: s.stats.bites,
    shield: s.shield,
    frozen: s.frozen,
  }));
}

function turnEndsAt(state: SnakesState): number | null {
  return state.settings.turnTimer === 0
    ? null
    : state.turnStartedAt + state.settings.turnTimer * 1000;
}

function baseView(state: SnakesState): Omit<SnakesView, 'me'> {
  return {
    snakes: state.snakes.map((s) => ({ ...s })),
    seats: publicSeats(state),
    turnPlayerId: currentSeat(state)?.id ?? '',
    turnEndsAt: turnEndsAt(state),
    round: state.round,
    lastTurn: state.lastTurn,
    turnSeq: state.turnSeq,
    finished: state.finished,
  };
}

/**
 * Nothing here is secret — everyone can see the whole board. The per-player
 * view still exists so `canRoll` is answered for the one player it applies to.
 */
export function getPlayerView(state: SnakesState, playerId: string): SnakesView {
  const seat = seatOf(state, playerId);
  const mine = currentSeat(state)?.id === playerId;
  return {
    me: {
      canRoll: mine && !state.finished,
      rollsLeft: mine ? Math.max(0, MAX_ROLLS_PER_TURN - state.rollsThisTurn) : 0,
      shield: seat?.shield ?? false,
      double: seat?.double ?? false,
    },
    ...baseView(state),
  };
}

export function getSpectatorView(state: SnakesState): SnakesView {
  return {
    me: { canRoll: false, rollsLeft: 0, shield: false, double: false },
    ...baseView(state),
  };
}

/**
 * First past the post takes the round. Everyone else scores by how far they
 * got, so a close second is worth more than being stuck on tile 12.
 */
export function getResult(state: SnakesState): RoundResult | null {
  if (!state.finished || !state.winnerId) return null;
  const winnerId = state.winnerId;

  return {
    winnerId,
    scores: state.seats.map((s) => ({
      playerId: s.id,
      cardsLeft: LAST_TILE - s.pos,
      points: s.id === winnerId ? LAST_TILE : s.pos,
    })),
  };
}

export function onPlayerLeft(input: SnakesState, playerId: string): SnakesState {
  const state = clone(input);
  const index = state.seats.findIndex((s) => s.id === playerId);
  if (index < 0) return state;

  state.seats.splice(index, 1);

  if (state.seats.length === 0) {
    state.finished = true;
    state.winnerId = null;
    return state;
  }
  if (state.seats.length === 1) {
    const last = state.seats[0];
    state.finished = true;
    state.winnerId = last ? last.id : null;
    return state;
  }

  if (index < state.turnIndex) state.turnIndex -= 1;
  const n = state.seats.length;
  state.turnIndex = ((state.turnIndex % n) + n) % n;
  return state;
}
