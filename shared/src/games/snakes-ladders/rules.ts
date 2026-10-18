import type { GameEvent, PlayerRef, RoundResult } from '../types.js';
import { LAST_TILE, ladderAt, snakeAt, walkPath } from './board.js';
import { MAX_ROLLS_PER_TURN, SNAKES_DEFAULTS, type SnakesSettings } from './settings.js';
import type { LastTurn, MoveStep, SnakesAction, SnakesSeat, SnakesState, SnakesView } from './types.js';

export type Ctx = { now: number; rng: () => number };

export type ActionResult =
  | { ok: true; state: SnakesState; events: GameEvent[] }
  | { ok: false; error: string };

/**
 * How far a ladder-then-ladder chain may run. The mock caps recursion at 3;
 * with this board no chain is that long, but the cap stops a hand-edited board
 * from hanging the server.
 */
const MAX_CHAIN = 3;

function clone(state: SnakesState): SnakesState {
  return {
    ...state,
    seats: state.seats.map((s) => ({ ...s, stats: { ...s.stats } })),
    lastTurn: state.lastTurn
      ? { ...state.lastTurn, dice: [...state.lastTurn.dice], steps: [...state.lastTurn.steps] }
      : null,
    settings: { ...state.settings },
  };
}

const seatOf = (state: SnakesState, id: string) => state.seats.find((s) => s.id === id);
const currentSeat = (state: SnakesState) => state.seats[state.turnIndex];

function rollDie(rng: () => number): number {
  return 1 + Math.floor(rng() * 6);
}

export function setup(players: PlayerRef[], settings: SnakesSettings, ctx: Ctx): SnakesState {
  return {
    seats: players.map((p) => ({
      id: p.id,
      pos: 1,
      present: true,
      stats: { ladders: 0, bites: 0, best: 0 },
    })),
    // Everyone starts on tile 1 and the host leads, unlike Last Card where the
    // player after the host does — there is no dealer here to go last.
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

/** Advances to the next seat, counting a round each time it wraps. */
function nextTurn(state: SnakesState, now: number): void {
  const n = state.seats.length;
  if (n === 0) return;
  const next = (state.turnIndex + 1) % n;
  if (next <= state.turnIndex) state.round += 1;
  state.turnIndex = next;
  state.rollsThisTurn = 0;
  state.turnStartedAt = now;
}

/**
 * Applies whatever the tile does once a player has landed on it: a ladder
 * carries them up, a snake swallows them down, and a ladder may lead straight
 * to another.
 */
function resolveTile(seat: SnakesSeat, steps: MoveStep[], events: GameEvent[]): void {
  for (let depth = 0; depth < MAX_CHAIN; depth++) {
    const up = ladderAt(seat.pos);
    if (up !== null) {
      steps.push({ kind: 'ladder', from: seat.pos, to: up });
      events.push({ kind: 'ladder', text: `climbed from ${seat.pos} to ${up}`, playerId: seat.id });
      seat.pos = up;
      seat.stats.ladders += 1;
      continue;
    }

    const down = snakeAt(seat.pos);
    if (down !== null) {
      steps.push({ kind: 'snake', from: seat.pos, to: down });
      events.push({ kind: 'snake', text: `was swallowed on ${seat.pos} and popped out on ${down}`, playerId: seat.id });
      seat.pos = down;
      seat.stats.bites += 1;
      continue;
    }

    return;
  }
}

/** One roll, fully resolved. Shared by a player's action and a turn timeout. */
function takeRoll(state: SnakesState, seat: SnakesSeat, ctx: Ctx): GameEvent[] {
  const events: GameEvent[] = [];
  const steps: MoveStep[] = [];

  const dice = [rollDie(ctx.rng)];
  const total = dice.reduce((a, b) => a + b, 0);
  const before = seat.pos;

  // Exact finish: an overshoot is still walked, so the token bounces back off
  // 100. With it off, the roll is clamped and they simply land on 100.
  const overshot = state.settings.exactFinish && seat.pos + total > LAST_TILE;
  const steps_to_walk =
    !state.settings.exactFinish && seat.pos + total >= LAST_TILE ? LAST_TILE - seat.pos : total;

  const path = walkPath(seat.pos, steps_to_walk);
  const landed = path[path.length - 1];
  if (landed !== undefined) {
    steps.push({ kind: 'walk', path });
    seat.pos = landed;
  }

  events.push({ kind: 'roll', text: `rolled ${dice.join(' + ')}`, playerId: seat.id });
  if (overshot) {
    events.push({ kind: 'bounce', text: `bounced off ${LAST_TILE}`, playerId: seat.id });
  }

  resolveTile(seat, steps, events);
  seat.stats.best = Math.max(seat.stats.best, seat.pos - before);

  state.lastTurn = { playerId: seat.id, dice, steps, overshot };
  state.turnSeq += 1;
  state.rollsThisTurn += 1;

  if (seat.pos === LAST_TILE) {
    state.finished = true;
    state.winnerId = seat.id;
    events.push({ kind: 'win', text: `reached ${LAST_TILE} and won`, playerId: seat.id });
    return events;
  }

  // A six buys another roll, up to three in a turn.
  const rolledSix = dice.length === 1 && dice[0] === 6;
  const canGoAgain =
    state.settings.rollAgainOnSix && rolledSix && state.rollsThisTurn < MAX_ROLLS_PER_TURN;

  if (canGoAgain) {
    events.push({ kind: 'again', text: 'rolled a six and goes again', playerId: seat.id });
    state.turnStartedAt = ctx.now;
  } else {
    nextTurn(state, ctx.now);
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
  }));
}

function turnEndsAt(state: SnakesState): number | null {
  return state.settings.turnTimer === 0
    ? null
    : state.turnStartedAt + state.settings.turnTimer * 1000;
}

/**
 * Nothing here is secret — everyone can see the whole board. The per-player
 * view still exists so the interface stays uniform and `canRoll` is answered
 * for the one player it applies to.
 */
export function getPlayerView(state: SnakesState, playerId: string): SnakesView {
  const mine = currentSeat(state)?.id === playerId;
  return {
    me: {
      canRoll: mine && !state.finished,
      rollsLeft: mine ? Math.max(0, MAX_ROLLS_PER_TURN - state.rollsThisTurn) : 0,
    },
    seats: publicSeats(state),
    turnPlayerId: currentSeat(state)?.id ?? '',
    turnEndsAt: turnEndsAt(state),
    round: state.round,
    lastTurn: state.lastTurn,
    turnSeq: state.turnSeq,
    finished: state.finished,
  };
}

export function getSpectatorView(state: SnakesState): SnakesView {
  return {
    me: { canRoll: false, rollsLeft: 0 },
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
