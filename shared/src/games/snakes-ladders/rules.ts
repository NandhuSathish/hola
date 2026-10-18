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
import {
  CROWD_VOTE_MS,
  STANDOFF_MS,
  STANDOFF_PERIOD_MS,
  VOTE_PAIRS,
  inZone,
  needleAt,
  tallyVotes,
  type Prompt,
  type VoteEffect,
  type VoteOption,
} from './prompts.js';
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

/** VOTE_PAIRS is never empty, but the index signature cannot say so. */
const FALLBACK_VOTE_PAIR = VOTE_PAIRS[0] as readonly [VoteOption, VoteOption];

/** How far a jump-then-jump chain may run before it is cut off. */
const MAX_CHAIN = 4;
/** Noodle relocates on these rounds. */
const NOODLE_EVERY = 3;

function clone(state: SnakesState): SnakesState {
  return {
    ...state,
    seats: state.seats.map((s) => ({ ...s, stats: { ...s.stats } })),
    snakes: state.snakes.map((s) => ({ ...s })),
    prompt: state.prompt
      ? {
          ...state.prompt,
          awaiting: [...state.prompt.awaiting],
          detail:
            state.prompt.detail.kind === 'crowd'
              ? { ...state.prompt.detail, votes: { ...state.prompt.detail.votes } }
              : { ...state.prompt.detail },
        }
      : null,
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

/** Appends to the move the client is replaying, if one is open. */
function addStep(state: SnakesState, step: MoveStep): void {
  state.lastTurn?.steps.push(step);
}

export function setup(players: PlayerRef[], settings: SnakesSettings, ctx: Ctx): SnakesState {
  const snakes: LiveSnake[] = SNAKES.map(([head, tail]) => ({
    head,
    tail,
    sleep: 0,
    boss: false,
  }));

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
    prompt: null,
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
    const candidate = 38 + Math.floor(rng() * 60);
    if (!taken.has(candidate)) {
      head = candidate;
      break;
    }
  }

  noodle.head = head;
  noodle.tail = Math.max(2, head - (14 + Math.floor(rng() * 17)));
  events.push({ kind: 'noodle', text: `Noodle slithered over. Its head is now on ${head}.` });
}

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

// ---------------------------------------------------------------- prompts

let promptCounter = 0;
/** Ids only need to be unique within a game, and state is server-side. */
function nextPromptId(state: SnakesState): string {
  promptCounter += 1;
  return `${state.turnSeq}-${promptCounter}`;
}

function raiseStandoff(state: SnakesState, seat: SnakesSeat, snake: LiveSnake, ctx: Ctx): void {
  const zoneWidth = 18 + Math.floor(ctx.rng() * 9); // 18..26
  const zoneStart = 18 + Math.floor(ctx.rng() * (82 - zoneWidth - 18 + 1));

  state.prompt = {
    id: nextPromptId(state),
    awaiting: [seat.id],
    startedAt: ctx.now,
    endsAt: ctx.now + STANDOFF_MS,
    detail: {
      kind: 'standoff',
      snakeHead: snake.head,
      zoneStart,
      zoneWidth,
      periodMs: STANDOFF_PERIOD_MS,
    },
  };
}

function raiseCrowdVote(state: SnakesState, seat: SnakesSeat, ctx: Ctx): void {
  const pair = pick(VOTE_PAIRS, ctx.rng) ?? FALLBACK_VOTE_PAIR;
  const voters = state.seats.filter((s) => s.id !== seat.id).map((s) => s.id);

  state.prompt = {
    id: nextPromptId(state),
    awaiting: voters,
    startedAt: ctx.now,
    endsAt: ctx.now + CROWD_VOTE_MS,
    detail: { kind: 'crowd', subjectId: seat.id, options: pair, votes: {} },
  };
}

/** Applies whatever the crowd decided. Returns true when the subject moved. */
function applyVoteEffect(
  state: SnakesState,
  seat: SnakesSeat,
  effect: VoteEffect,
  events: GameEvent[],
): boolean {
  if (effect.shield) {
    seat.shield = true;
    events.push({ kind: 'shield', text: 'was given a shield', playerId: seat.id });
  }
  if (effect.freeze) {
    seat.frozen = true;
    events.push({ kind: 'freeze', text: 'will miss their next turn', playerId: seat.id });
  }
  if (effect.double) {
    seat.double = true;
    events.push({ kind: 'double', text: 'will roll two dice next turn', playerId: seat.id });
  }

  if (effect.swapLast) {
    const last = [...state.seats].sort((a, b) => a.pos - b.pos)[0];
    if (last && last.id !== seat.id) {
      const mine = seat.pos;
      addStep(state, { kind: 'swap', withPlayerId: last.id, from: mine, to: last.pos });
      seat.pos = last.pos;
      last.pos = mine;
      events.push({ kind: 'swap', text: 'swapped with last place', playerId: seat.id });
      return true;
    }
    return false;
  }

  if (effect.move) {
    const to = Math.max(FIRST_TILE, Math.min(LAST_TILE - 1, seat.pos + effect.move));
    addStep(state, { kind: 'jump', from: seat.pos, to });
    events.push({
      kind: effect.move > 0 ? 'rocket' : 'banana',
      text: effect.move > 0 ? `was sent ahead to ${to}` : `was sent back to ${to}`,
      playerId: seat.id,
    });
    seat.pos = to;
    return true;
  }

  return false;
}

// ---------------------------------------------------------------- tiles

function applyCard(
  state: SnakesState,
  seat: SnakesSeat,
  card: CardId,
  events: GameEvent[],
  rng: () => number,
): boolean {
  switch (card) {
    case 'rocket': {
      const to = Math.min(LAST_TILE - 1, seat.pos + ROCKET_TILES);
      addStep(state, { kind: 'jump', from: seat.pos, to });
      events.push({ kind: 'rocket', text: `blasted ahead to ${to}`, playerId: seat.id });
      seat.pos = to;
      return true;
    }
    case 'banana': {
      const to = Math.max(FIRST_TILE, seat.pos - BANANA_TILES);
      addStep(state, { kind: 'jump', from: seat.pos, to });
      events.push({ kind: 'banana', text: `slipped back to ${to}`, playerId: seat.id });
      seat.pos = to;
      return true;
    }
    case 'swap': {
      const others = state.seats.filter((s) => s.id !== seat.id);
      const other = pick(others, rng);
      if (!other) return false;
      const mine = seat.pos;
      addStep(state, { kind: 'swap', withPlayerId: other.id, from: mine, to: other.pos });
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

/** Swallows a player, as a step and an event. */
function swallow(state: SnakesState, seat: SnakesSeat, snake: LiveSnake, events: GameEvent[]): void {
  addStep(state, { kind: 'snake', from: seat.pos, to: snake.tail });
  events.push({
    kind: 'snake',
    text: `was swallowed on ${seat.pos} and popped out on ${snake.tail}`,
    playerId: seat.id,
  });
  seat.pos = snake.tail;
  seat.stats.bites += 1;
}

/**
 * Whatever the tile does once a player has landed. Returns 'waiting' when it
 * has raised a prompt and cannot finish until people answer — the turn stays
 * put and resolution picks up again in `resumeAfterPrompt`.
 */
function resolveTile(
  state: SnakesState,
  seat: SnakesSeat,
  events: GameEvent[],
  ctx: Ctx,
  startDepth = 0,
): 'done' | 'waiting' {
  for (let depth = startDepth; depth < MAX_CHAIN; depth++) {
    const up = ladderAt(seat.pos);
    if (up !== null) {
      addStep(state, { kind: 'ladder', from: seat.pos, to: up });
      events.push({ kind: 'ladder', text: `climbed from ${seat.pos} to ${up}`, playerId: seat.id });
      seat.pos = up;
      seat.stats.ladders += 1;
      continue;
    }

    const snake = awakeSnakeAt(state, seat.pos);
    if (snake) {
      if (seat.shield) {
        seat.shield = false;
        addStep(state, { kind: 'bonk', tile: seat.pos });
        events.push({ kind: 'bonk', text: `bonked the snake on ${seat.pos}`, playerId: seat.id });
        return 'done';
      }
      if (state.settings.standoff) {
        raiseStandoff(state, seat, snake, ctx);
        events.push({ kind: 'standoff', text: `is facing down the snake on ${snake.head}`, playerId: seat.id });
        return 'waiting';
      }
      swallow(state, seat, snake, events);
      continue;
    }

    if (state.settings.mysteryBoxes && MYSTERY_TILES.includes(seat.pos)) {
      const card = drawCard(ctx.rng);
      addStep(state, { kind: 'card', card: card.id });
      events.push({ kind: 'box', text: `opened a box: ${card.name}`, playerId: seat.id });
      seat.stats.boxes += 1;
      if (applyCard(state, seat, card.id, events, ctx.rng)) continue;
      return 'done';
    }

    if (state.settings.crowdVote && CROWD_TILES.includes(seat.pos) && state.seats.length > 1) {
      raiseCrowdVote(state, seat, ctx);
      events.push({ kind: 'crowd', text: 'is at the mercy of the crowd', playerId: seat.id });
      return 'waiting';
    }

    return 'done';
  }
  return 'done';
}

// ---------------------------------------------------------------- turns

/** Wins, sixes and handing over. Runs once a roll has fully settled. */
function finishRoll(state: SnakesState, seat: SnakesSeat, ctx: Ctx, events: GameEvent[]): void {
  // Checking every seat rather than just the roller is defensive: a crowd vote
  // can move someone who was not rolling, and a missed win would stall.
  const home = state.seats.find((s) => s.pos === LAST_TILE);
  if (home) {
    state.finished = true;
    state.winnerId = home.id;
    state.prompt = null;
    events.push({ kind: 'win', text: `reached ${LAST_TILE} and won`, playerId: home.id });
    return;
  }

  const dice = state.lastTurn?.dice ?? [];
  const rolledSix = dice.length === 1 && dice[0] === 6;
  const goAgain =
    state.settings.rollAgainOnSix && rolledSix && state.rollsThisTurn < MAX_ROLLS_PER_TURN;

  if (goAgain) {
    events.push({ kind: 'again', text: 'rolled a six and goes again', playerId: seat.id });
    state.turnStartedAt = ctx.now;
  } else {
    nextTurn(state, ctx, events);
  }
}

/** Picks tile resolution back up once a prompt has been answered. */
function resumeAfterPrompt(
  state: SnakesState,
  seat: SnakesSeat,
  ctx: Ctx,
  events: GameEvent[],
  movedAgain: boolean,
): void {
  state.prompt = null;
  if (movedAgain && resolveTile(state, seat, events, ctx, 1) === 'waiting') return;
  finishRoll(state, seat, ctx, events);
}

function takeRoll(state: SnakesState, seat: SnakesSeat, ctx: Ctx): GameEvent[] {
  const events: GameEvent[] = [];

  const count = seat.double ? 2 : 1;
  seat.double = false;
  const dice = Array.from({ length: count }, () => rollDie(ctx.rng));
  const total = dice.reduce((a, b) => a + b, 0);
  const before = seat.pos;

  const overshot = state.settings.exactFinish && seat.pos + total > LAST_TILE;
  const distance =
    !state.settings.exactFinish && seat.pos + total >= LAST_TILE ? LAST_TILE - seat.pos : total;

  // The move is opened here so every later step, including anything a prompt
  // produces, lands in the same journey the client replays.
  state.lastTurn = { playerId: seat.id, dice, steps: [], overshot };
  state.turnSeq += 1;
  state.rollsThisTurn += 1;

  const path = walkPath(seat.pos, distance);
  const landed = path[path.length - 1];
  if (landed !== undefined) {
    addStep(state, { kind: 'walk', path });
    seat.pos = landed;
  }

  events.push({ kind: 'roll', text: `rolled ${dice.join(' + ')}`, playerId: seat.id });
  if (overshot) events.push({ kind: 'bounce', text: `bounced off ${LAST_TILE}`, playerId: seat.id });

  const outcome = resolveTile(state, seat, events, ctx);
  seat.stats.best = Math.max(seat.stats.best, seat.pos - before);

  if (outcome === 'waiting') return events;
  finishRoll(state, seat, ctx, events);
  return events;
}

// ---------------------------------------------------------------- actions

function handleCharm(state: SnakesState, playerId: string, promptId: string, ctx: Ctx): ActionResult {
  const prompt = state.prompt;
  if (!prompt || prompt.detail.kind !== 'standoff') {
    return { ok: false, error: 'There is no snake to charm.' };
  }
  if (prompt.id !== promptId) return { ok: false, error: 'That moment has passed.' };
  if (!prompt.awaiting.includes(playerId)) return { ok: false, error: 'This one is not yours.' };

  const seat = seatOf(state, playerId);
  if (!seat) return { ok: false, error: 'You are not in this game.' };

  // Judged on the server's clock, so the needle cannot be faked. Latency
  // nudges it slightly late, which is acceptable for a party game.
  const position = needleAt(prompt.startedAt, ctx.now, prompt.detail.periodMs);
  const escaped = inZone(position, prompt.detail.zoneStart, prompt.detail.zoneWidth);
  return settleStandoff(state, seat, escaped, ctx);
}

function settleStandoff(
  state: SnakesState,
  seat: SnakesSeat,
  escaped: boolean,
  ctx: Ctx,
): ActionResult {
  const prompt = state.prompt;
  if (!prompt || prompt.detail.kind !== 'standoff') {
    return { ok: false, error: 'There is no snake to charm.' };
  }

  const events: GameEvent[] = [];
  const head = prompt.detail.snakeHead;
  const target = state.snakes.find((s) => s.head === head);

  if (escaped) {
    if (target) target.sleep = 1;
    addStep(state, { kind: 'charmed', tile: head });
    events.push({ kind: 'charmed', text: `charmed the snake on ${head} and walked away`, playerId: seat.id });
    resumeAfterPrompt(state, seat, ctx, events, false);
  } else {
    if (target) swallow(state, seat, target, events);
    resumeAfterPrompt(state, seat, ctx, events, true);
  }

  return { ok: true, state, events };
}

function handleVote(
  state: SnakesState,
  playerId: string,
  promptId: string,
  option: 0 | 1,
  ctx: Ctx,
): ActionResult {
  const prompt = state.prompt;
  if (!prompt || prompt.detail.kind !== 'crowd') {
    return { ok: false, error: 'There is nothing to vote on.' };
  }
  if (prompt.id !== promptId) return { ok: false, error: 'That vote has closed.' };
  if (prompt.detail.subjectId === playerId) {
    return { ok: false, error: 'You cannot vote on your own fate.' };
  }
  if (!prompt.awaiting.includes(playerId)) return { ok: false, error: 'You already voted.' };
  if (option !== 0 && option !== 1) return { ok: false, error: 'Pick one of the two.' };

  prompt.detail.votes[playerId] = option;
  prompt.awaiting = prompt.awaiting.filter((id) => id !== playerId);

  const events: GameEvent[] = [{ kind: 'vote', text: 'voted', playerId }];

  // Everyone has spoken, so there is nothing left to wait for.
  if (prompt.awaiting.length === 0) {
    events.push(...settleCrowdVote(state, ctx));
  }
  return { ok: true, state, events };
}

function settleCrowdVote(state: SnakesState, ctx: Ctx): GameEvent[] {
  const prompt = state.prompt;
  if (!prompt || prompt.detail.kind !== 'crowd') return [];

  const events: GameEvent[] = [];
  const subject = seatOf(state, prompt.detail.subjectId);
  const { winner, counts } = tallyVotes(prompt.detail.votes, ctx.rng);
  const option = prompt.detail.options[winner];

  if (!subject) {
    // They left mid-vote. Dropping the prompt is not enough: without handing
    // the turn on, nobody can roll and the game sits there forever.
    state.prompt = null;
    nextTurn(state, ctx, events);
    return events;
  }

  events.push({
    kind: 'crowdResult',
    text: `the crowd chose "${option.label}" (${counts[winner]} of ${counts[0] + counts[1]})`,
    playerId: subject.id,
  });

  const moved = applyVoteEffect(state, subject, option.effect, events);
  resumeAfterPrompt(state, subject, ctx, events, moved);
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

  const state = clone(input);
  const seat = seatOf(state, playerId);
  if (!seat) return { ok: false, error: 'You are not in this game.' };

  if (action.type === 'charm') {
    if (typeof action.promptId !== 'string') return { ok: false, error: 'That move makes no sense here.' };
    return handleCharm(state, playerId, action.promptId, ctx);
  }

  if (action.type === 'vote') {
    if (typeof action.promptId !== 'string') return { ok: false, error: 'That move makes no sense here.' };
    return handleVote(state, playerId, action.promptId, action.option, ctx);
  }

  if (action.type !== 'roll') return { ok: false, error: 'That move makes no sense here.' };

  // A roll cannot jump the queue while the table is waiting on someone.
  if (state.prompt) return { ok: false, error: 'Hold on, the table is waiting on someone.' };
  if (currentSeat(state)?.id !== playerId) return { ok: false, error: 'Wait for your turn.' };

  return { ok: true, state, events: takeRoll(state, seat, ctx) };
}

/** Prompt deadlines first, then the ordinary turn timer. */
export function onTick(
  input: SnakesState,
  ctx: Ctx,
): { state: SnakesState; events: GameEvent[] } | null {
  if (input.finished) return null;

  if (input.prompt) {
    if (ctx.now < input.prompt.endsAt) return null;
    const state = clone(input);
    const prompt = state.prompt;
    if (!prompt) return null;

    if (prompt.detail.kind === 'standoff') {
      const seat = seatOf(state, prompt.awaiting[0] ?? '');
      if (!seat) {
        const events: GameEvent[] = [];
        state.prompt = null;
        nextTurn(state, ctx, events);
        return { state, events };
      }
      // Never pressed, so the needle was never stopped: the snake wins.
      const events: GameEvent[] = [
        { kind: 'timeout', text: 'froze, and the snake did not', playerId: seat.id },
      ];
      const settled = settleStandoff(state, seat, false, ctx);
      return settled.ok ? { state: settled.state, events: [...events, ...settled.events] } : null;
    }

    // Crowd vote: whoever answered in time decides it.
    const events: GameEvent[] = [{ kind: 'timeout', text: 'the vote closed' }];
    events.push(...settleCrowdVote(state, ctx));
    return { state, events };
  }

  if (input.settings.turnTimer === 0) return null;
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

// ---------------------------------------------------------------- views

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

function baseView(state: SnakesState): Omit<SnakesView, 'me' | 'awaitingMe'> {
  return {
    snakes: state.snakes.map((s) => ({ ...s })),
    prompt: state.prompt,
    seats: publicSeats(state),
    turnPlayerId: currentSeat(state)?.id ?? '',
    turnEndsAt: turnEndsAt(state),
    round: state.round,
    lastTurn: state.lastTurn,
    turnSeq: state.turnSeq,
    finished: state.finished,
  };
}

export function getPlayerView(state: SnakesState, playerId: string): SnakesView {
  const seat = seatOf(state, playerId);
  const mine = currentSeat(state)?.id === playerId;
  return {
    me: {
      // A roll waits while the table is answering a prompt.
      canRoll: mine && !state.finished && state.prompt === null,
      rollsLeft: mine ? Math.max(0, MAX_ROLLS_PER_TURN - state.rollsThisTurn) : 0,
      shield: seat?.shield ?? false,
      double: seat?.double ?? false,
    },
    awaitingMe: state.prompt?.awaiting.includes(playerId) ?? false,
    ...baseView(state),
  };
}

export function getSpectatorView(state: SnakesState): SnakesView {
  return {
    me: { canRoll: false, rollsLeft: 0, shield: false, double: false },
    awaitingMe: false,
    ...baseView(state),
  };
}

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

  // Never wait on someone who has gone. If they were the only one left to
  // answer, the prompt is simply dropped rather than hanging the game; the
  // tick that follows cannot resolve a prompt with no subject either.
  if (state.prompt) {
    state.prompt.awaiting = state.prompt.awaiting.filter((id) => id !== playerId);
    const detail = state.prompt.detail;
    const subjectGone = detail.kind === 'crowd' && detail.subjectId === playerId;
    if (state.prompt.awaiting.length === 0 || subjectGone) state.prompt = null;
  }

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
