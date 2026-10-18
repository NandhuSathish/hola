import { describe, expect, it } from 'vitest';
import type { PlayerRef } from '../types.js';
import {
  COLUMNS,
  LADDERS,
  LAST_TILE,
  MYSTERY_TILES,
  SNAKES,
  ladderAt,
  snakeAt,
  tileToCell,
  walkPath,
} from './board.js';
import { MAX_ROLLS_PER_TURN, SNAKES_DEFAULTS, type SnakesSettings } from './settings.js';
import {
  getPlayerView,
  getResult,
  getSpectatorView,
  onAction,
  onPlayerLeft,
  onTick,
  setup,
} from './rules.js';
import type { SnakesState } from './types.js';

/** Deterministic rng, so a failing test fails the same way twice. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** An rng that yields exactly these die faces, in order, then repeats. */
function dice(...faces: number[]): () => number {
  let i = 0;
  return () => {
    const face = faces[i++ % faces.length] ?? 1;
    // rollDie does 1 + floor(r * 6), so aim at the middle of the band
    return (face - 1) / 6 + 0.01;
  };
}

const players = (n: number): PlayerRef[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: '🦊' }));

const ctx = (now = 0, rng = seeded()) => ({ now, rng });

function table(opts: {
  positions: number[];
  turnIndex?: number;
  settings?: Partial<SnakesSettings>;
}): SnakesState {
  return {
    seats: opts.positions.map((pos, i) => ({
      id: `p${i}`,
      pos,
      present: true,
      shield: false,
      double: false,
      frozen: false,
      stats: { ladders: 0, bites: 0, boxes: 0, best: 0 },
    })),
    snakes: SNAKES.map(([head, tail]) => ({ head, tail, sleep: 0, boss: false })),
    turnIndex: opts.turnIndex ?? 0,
    rollsThisTurn: 0,
    turnStartedAt: 0,
    round: 1,
    finished: false,
    winnerId: null,
    lastTurn: null,
    turnSeq: 0,
    settings: { ...SNAKES_DEFAULTS, mysteryBoxes: false, noodle: false, ...opts.settings },
  };
}

function ok(result: ReturnType<typeof onAction>): SnakesState {
  if (!result.ok) throw new Error('expected success, got: ' + result.error);
  return result.state;
}

function err(result: ReturnType<typeof onAction>): string {
  if (result.ok) throw new Error('expected a refusal, but the move was allowed');
  return result.error;
}

const roll = (state: SnakesState, who: string, ...faces: number[]) =>
  onAction(state, who, { type: 'roll' }, ctx(0, dice(...faces)));

// ---------------------------------------------------------------- board

describe('the board', () => {
  it('runs boustrophedon, tile 1 at the bottom left', () => {
    expect(tileToCell(1)).toEqual({ row: 0, col: 0 });
    expect(tileToCell(10)).toEqual({ row: 0, col: 9 });
    // row 1 runs the other way, so 11 sits above 10
    expect(tileToCell(11)).toEqual({ row: 1, col: 9 });
    expect(tileToCell(20)).toEqual({ row: 1, col: 0 });
    expect(tileToCell(21)).toEqual({ row: 2, col: 0 });
    expect(tileToCell(100)).toEqual({ row: 9, col: 0 });
  });

  it('gives every tile its own cell', () => {
    const seen = new Set<string>();
    for (let t = 1; t <= LAST_TILE; t++) {
      const { row, col } = tileToCell(t);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(COLUMNS);
      seen.add(`${row},${col}`);
    }
    expect(seen.size).toBe(LAST_TILE);
  });

  it('has ladders that climb and snakes that drop', () => {
    for (const [foot, head] of LADDERS) expect(head).toBeGreaterThan(foot);
    for (const [head, tail] of SNAKES) expect(tail).toBeLessThan(head);
  });

  it('never puts a snake head and a ladder foot on the same tile', () => {
    const feet = new Set(LADDERS.map(([foot]) => foot));
    for (const [head] of SNAKES) expect(feet.has(head)).toBe(false);
  });

  it('keeps the special tiles clear of snakes and ladders', () => {
    const taken = new Set([...LADDERS.flat(), ...SNAKES.flat()]);
    for (const tile of MYSTERY_TILES) expect(taken.has(tile)).toBe(false);
  });

  it('looks jumps up by tile', () => {
    expect(ladderAt(4)).toBe(25);
    expect(ladderAt(5)).toBeNull();
    expect(snakeAt(99)).toBe(41);
    expect(snakeAt(98)).toBeNull();
  });
});

describe('walking', () => {
  it('returns every tile stepped on', () => {
    expect(walkPath(1, 4)).toEqual([2, 3, 4, 5]);
  });

  it('bounces back off 100', () => {
    // from 98, a 5 goes 99, 100, then back down 99, 98, 97
    expect(walkPath(98, 5)).toEqual([99, 100, 99, 98, 97]);
  });

  it('lands exactly when the roll fits', () => {
    expect(walkPath(97, 3)).toEqual([98, 99, 100]);
  });

  it('never walks below tile 1', () => {
    expect(walkPath(2, -5).every((t) => t >= 1)).toBe(true);
  });

  it('stays put for a zero', () => {
    expect(walkPath(40, 0)).toEqual([]);
  });
});

// ---------------------------------------------------------------- setup

describe('setup', () => {
  it('puts everyone on tile 1 with the host to roll', () => {
    const state = setup(players(4), SNAKES_DEFAULTS, ctx());
    expect(state.seats.map((s) => s.pos)).toEqual([1, 1, 1, 1]);
    expect(state.seats[state.turnIndex]?.id).toBe('p0');
    expect(state.round).toBe(1);
    expect(state.finished).toBe(false);
  });

  it('is reproducible for a seed', () => {
    const a = setup(players(3), SNAKES_DEFAULTS, ctx(0, seeded(9)));
    const b = setup(players(3), SNAKES_DEFAULTS, ctx(0, seeded(9)));
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------- rolling

describe('rolling', () => {
  it('refuses a roll out of turn', () => {
    const state = table({ positions: [1, 1] });
    expect(err(roll(state, 'p1', 3))).toBe('Wait for your turn.');
  });

  it('refuses a stranger', () => {
    const state = table({ positions: [1, 1] });
    expect(err(roll(state, 'nobody', 3))).toBe('You are not in this game.');
  });

  it('refuses malformed actions instead of throwing', () => {
    const state = table({ positions: [1, 1] });
    for (const junk of [null, undefined, 42, 'roll', [], {}, { type: 7 }, { type: 'fly' }]) {
      expect(onAction(state, 'p0', junk as never, ctx()).ok).toBe(false);
    }
  });

  it('moves the token and passes the turn on', () => {
    const state = table({ positions: [1, 1], settings: { rollAgainOnSix: false } });
    const next = ok(roll(state, 'p0', 3));
    expect(next.seats[0]?.pos).toBe(4 + 21); // tile 4 is a ladder foot to 25
    expect(next.turnIndex).toBe(1);
  });

  it('does not mutate the state it was given', () => {
    const state = table({ positions: [1, 1] });
    const before = JSON.stringify(state);
    roll(state, 'p0', 3);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('records the journey for the renderer', () => {
    const state = table({ positions: [1, 1] });
    const next = ok(roll(state, 'p0', 3));
    expect(next.lastTurn?.playerId).toBe('p0');
    expect(next.lastTurn?.dice).toEqual([3]);
    expect(next.lastTurn?.steps[0]).toEqual({ kind: 'walk', path: [2, 3, 4] });
    expect(next.lastTurn?.steps[1]).toEqual({ kind: 'ladder', from: 4, to: 25 });
    expect(next.turnSeq).toBe(1);
  });
});

// ---------------------------------------------------------------- jumps

describe('ladders and snakes', () => {
  it('climbs a ladder and counts it', () => {
    const state = table({ positions: [3, 1], settings: { rollAgainOnSix: false } });
    const next = ok(roll(state, 'p0', 1)); // onto 4
    expect(next.seats[0]?.pos).toBe(25);
    expect(next.seats[0]?.stats.ladders).toBe(1);
  });

  it('gets swallowed by a snake and counts it', () => {
    const state = table({ positions: [31, 1], settings: { rollAgainOnSix: false } });
    const next = ok(roll(state, 'p0', 1)); // onto 32, a snake head
    expect(next.seats[0]?.pos).toBe(10);
    expect(next.seats[0]?.stats.bites).toBe(1);
    expect(next.lastTurn?.steps.at(-1)).toEqual({ kind: 'snake', from: 32, to: 10 });
  });

  it('chains a ladder into whatever is at the top', () => {
    // 21 -> 42 is a ladder; nothing sits on 42, so the chain stops there
    const state = table({ positions: [20, 1], settings: { rollAgainOnSix: false } });
    const next = ok(roll(state, 'p0', 1));
    expect(next.seats[0]?.pos).toBe(42);
    expect(next.lastTurn?.steps.filter((s) => s.kind === 'ladder')).toHaveLength(1);
  });

  it('tracks the best single turn', () => {
    const state = table({ positions: [3, 1], settings: { rollAgainOnSix: false } });
    const next = ok(roll(state, 'p0', 1)); // 3 -> 4 -> 25
    expect(next.seats[0]?.stats.best).toBe(22);
  });
});

// ---------------------------------------------------------------- finishing

describe('finishing', () => {
  it('wins on landing exactly on 100', () => {
    const state = table({ positions: [97, 1], settings: { rollAgainOnSix: false } });
    const next = ok(roll(state, 'p0', 3));
    expect(next.seats[0]?.pos).toBe(LAST_TILE);
    expect(next.finished).toBe(true);
    expect(next.winnerId).toBe('p0');
  });

  it('bounces back when exact finish is on and the roll is too big', () => {
    const state = table({ positions: [98, 1], settings: { exactFinish: true, rollAgainOnSix: false } });
    const next = ok(roll(state, 'p0', 5));
    expect(next.seats[0]?.pos).toBe(97);
    expect(next.finished).toBe(false);
    expect(next.lastTurn?.overshot).toBe(true);
  });

  it('just lands on 100 when exact finish is off', () => {
    const state = table({ positions: [98, 1], settings: { exactFinish: false, rollAgainOnSix: false } });
    const next = ok(roll(state, 'p0', 5));
    expect(next.seats[0]?.pos).toBe(LAST_TILE);
    expect(next.finished).toBe(true);
  });

  it('refuses any move once the game is over', () => {
    const state = table({ positions: [97, 1], settings: { rollAgainOnSix: false } });
    const done = ok(roll(state, 'p0', 3));
    expect(err(roll(done, 'p1', 2))).toBe('The game is over.');
  });

  it('scores the winner top and everyone else by distance', () => {
    const state = table({ positions: [97, 40, 12], settings: { rollAgainOnSix: false } });
    const done = ok(roll(state, 'p0', 3));
    const result = getResult(done);

    expect(result?.winnerId).toBe('p0');
    expect(result?.scores.find((s) => s.playerId === 'p0')?.points).toBe(100);
    expect(result?.scores.find((s) => s.playerId === 'p1')?.points).toBe(40);
    expect(result?.scores.find((s) => s.playerId === 'p2')?.points).toBe(12);
    // cardsLeft doubles as "tiles from home" on the results screen
    expect(result?.scores.find((s) => s.playerId === 'p1')?.cardsLeft).toBe(60);
  });

  it('has no result while the game runs', () => {
    expect(getResult(table({ positions: [1, 1] }))).toBeNull();
  });
});

// ---------------------------------------------------------------- sixes

describe('rolling a six', () => {
  it('keeps the turn', () => {
    const state = table({ positions: [10, 1], settings: { rollAgainOnSix: true } });
    const next = ok(roll(state, 'p0', 6));
    expect(next.turnIndex).toBe(0);
    expect(next.rollsThisTurn).toBe(1);
  });

  it('hands over after three rolls however many sixes', () => {
    let state = table({ positions: [10, 1], settings: { rollAgainOnSix: true } });
    for (let i = 0; i < MAX_ROLLS_PER_TURN; i++) {
      state = ok(roll(state, 'p0', 6));
    }
    expect(state.turnIndex).toBe(1);
  });

  it('hands over immediately when the rule is off', () => {
    const state = table({ positions: [10, 1], settings: { rollAgainOnSix: false } });
    expect(ok(roll(state, 'p0', 6)).turnIndex).toBe(1);
  });
});

// ---------------------------------------------------------------- rounds

describe('turn order', () => {
  it('counts a round each time it wraps', () => {
    let state = table({ positions: [1, 1], settings: { rollAgainOnSix: false } });
    expect(state.round).toBe(1);
    state = ok(roll(state, 'p0', 2));
    expect(state.round).toBe(1);
    state = ok(roll(state, 'p1', 2));
    expect(state.round).toBe(2);
  });
});

// ---------------------------------------------------------------- views

describe('views', () => {
  it('only lets the player whose turn it is roll', () => {
    const state = table({ positions: [1, 1] });
    expect(getPlayerView(state, 'p0').me.canRoll).toBe(true);
    expect(getPlayerView(state, 'p1').me.canRoll).toBe(false);
  });

  it('shows the whole board to everyone, since none of it is secret', () => {
    const state = table({ positions: [5, 60] });
    const view = getPlayerView(state, 'p1');
    expect(view.seats.map((s) => s.pos)).toEqual([5, 60]);
    expect(getSpectatorView(state).seats.map((s) => s.pos)).toEqual([5, 60]);
  });

  it('stops offering a roll once the game is over', () => {
    const state = table({ positions: [97, 1], settings: { rollAgainOnSix: false } });
    const done = ok(roll(state, 'p0', 3));
    expect(getPlayerView(done, 'p0').me.canRoll).toBe(false);
  });

  it('gives a deadline only when the timer is on', () => {
    const timed = table({ positions: [1, 1], settings: { turnTimer: 20 } });
    expect(getPlayerView(timed, 'p0').turnEndsAt).toBe(20_000);
    const off = table({ positions: [1, 1], settings: { turnTimer: 0 } });
    expect(getPlayerView(off, 'p0').turnEndsAt).toBeNull();
  });
});

// ---------------------------------------------------------------- timer

describe('the turn timer', () => {
  it('does nothing before the deadline or when switched off', () => {
    const timed = table({ positions: [1, 1], settings: { turnTimer: 20 } });
    expect(onTick(timed, ctx(19_999))).toBeNull();
    const off = table({ positions: [1, 1], settings: { turnTimer: 0 } });
    expect(onTick(off, ctx(10_000_000))).toBeNull();
  });

  it('rolls for whoever stalled', () => {
    const state = table({ positions: [10, 1], settings: { turnTimer: 20, rollAgainOnSix: false } });
    const ticked = onTick(state, { now: 20_000, rng: dice(3) });
    expect(ticked?.state.seats[0]?.pos).toBe(13 + 21); // 13 is a ladder foot to 34
    expect(ticked?.state.turnIndex).toBe(1);
    expect(ticked?.events[0]?.kind).toBe('timeout');
  });

  it('stops once the game is over', () => {
    const state = { ...table({ positions: [100, 1] }), finished: true, winnerId: 'p0' };
    expect(onTick(state, ctx(999_999))).toBeNull();
  });
});

// ---------------------------------------------------------------- leaving

describe('players leaving', () => {
  it('removes them and keeps the game going', () => {
    const state = table({ positions: [10, 20, 30] });
    const next = onPlayerLeft(state, 'p1');
    expect(next.seats).toHaveLength(2);
    expect(next.finished).toBe(false);
  });

  it('ends it when only one is left', () => {
    const state = table({ positions: [10, 20] });
    const next = onPlayerLeft(state, 'p1');
    expect(next.finished).toBe(true);
    expect(next.winnerId).toBe('p0');
  });

  it('keeps the turn on the same player', () => {
    const state = table({ positions: [10, 20, 30], turnIndex: 2 });
    expect(onPlayerLeft(state, 'p0').seats[onPlayerLeft(state, 'p0').turnIndex]?.id).toBe('p2');
  });

  it('shrugs off someone who was never there', () => {
    expect(onPlayerLeft(table({ positions: [1, 1] }), 'ghost').seats).toHaveLength(2);
  });
});

// ---------------------------------------------------------------- soak

describe('a whole game', () => {
  it('finishes from a seeded start without stalling', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = seeded(seed);
      let state = setup(
        players(4),
        { ...SNAKES_DEFAULTS, turnTimer: 0, mysteryBoxes: true, noodle: true },
        { now: 0, rng },
      );

      let turns = 0;
      while (!state.finished && turns < 5000) {
        turns++;
        const who = state.seats[state.turnIndex]?.id;
        if (!who) break;
        const res = onAction(state, who, { type: 'roll' }, { now: turns * 1000, rng });
        if (!res.ok) throw new Error(`seed ${seed} refused a legal roll: ${res.error}`);
        state = res.state;
      }

      expect(state.finished).toBe(true);
      expect(state.winnerId).not.toBeNull();
      expect(state.seats.find((s) => s.id === state.winnerId)?.pos).toBe(LAST_TILE);
    }
  });
});

// ---------------------------------------------------------------- twists

/** Feeds exact rng values in order: first the dice, then any card draw. */
function rngSeq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++] ?? 0.5;
}

/** rollDie does 1 + floor(r * 6), so aim at the middle of the band. */
const die = (face: number) => (face - 1) / 6 + 0.01;

/**
 * drawCard walks the deck subtracting weights, so each card owns a band of the
 * 0..1 range. These values land in the middle of each band.
 */
const card = (id: string): number => {
  const bands: Record<string, number> = {
    rocket: 1 / 12,
    banana: 3 / 12,
    swap: 4.5 / 12,
    shield: 6 / 12,
    double: 8 / 12,
    freeze: 9.5 / 12,
    charm: 10.5 / 12,
    quake: 11.5 / 12,
  };
  return bands[id] ?? 0.5;
};

/** Walks onto the gift tile at 7 from tile 5, drawing the named card. */
const openBox = (state: SnakesState, who: string, id: string) =>
  onAction(state, who, { type: 'roll' }, { now: 0, rng: rngSeq(die(2), card(id)) });

const boxes = { mysteryBoxes: true, rollAgainOnSix: false } as const;

describe('mystery boxes', () => {
  it('draws nothing when the rule is off', () => {
    const state = table({
      positions: [5, 1],
      settings: { mysteryBoxes: false, rollAgainOnSix: false },
    });
    const next = ok(openBox(state, 'p0', 'rocket'));
    expect(next.seats[0]?.pos).toBe(7);
    expect(next.seats[0]?.stats.boxes).toBe(0);
  });

  it('counts a box and records the card for the renderer', () => {
    const state = table({ positions: [5, 1], settings: boxes });
    const next = ok(openBox(state, 'p0', 'shield'));
    expect(next.seats[0]?.stats.boxes).toBe(1);
    expect(next.lastTurn?.steps.some((s) => s.kind === 'card')).toBe(true);
  });

  it('rocket boots blast ten tiles ahead', () => {
    const state = table({ positions: [5, 1], settings: boxes });
    expect(ok(openBox(state, 'p0', 'rocket')).seats[0]?.pos).toBe(17);
  });

  it('a banana peel slips four back', () => {
    const state = table({ positions: [5, 1], settings: boxes });
    expect(ok(openBox(state, 'p0', 'banana')).seats[0]?.pos).toBe(3);
  });

  it('never pushes anyone below tile 1', () => {
    const state = table({ positions: [15, 1], settings: boxes });
    expect(ok(openBox(state, 'p0', 'banana')).seats[0]?.pos).toBeGreaterThanOrEqual(1);
  });

  it('swap trades places', () => {
    const state = table({ positions: [5, 60], settings: boxes });
    const next = ok(openBox(state, 'p0', 'swap'));
    expect(next.seats[0]?.pos).toBe(60);
    expect(next.seats[1]?.pos).toBe(7);
  });

  it('a shield bonks the next snake instead of being eaten', () => {
    let state = table({ positions: [5, 1], settings: boxes });
    state = ok(openBox(state, 'p0', 'shield'));
    expect(state.seats[0]?.shield).toBe(true);

    // park them in front of the snake on 32 and walk on
    const parked: SnakesState = {
      ...state,
      turnIndex: 0,
      seats: state.seats.map((s, i) => (i === 0 ? { ...s, pos: 31 } : s)),
    };
    const bonked = ok(onAction(parked, 'p0', { type: 'roll' }, { now: 0, rng: rngSeq(die(1)) }));

    expect(bonked.seats[0]?.pos).toBe(32); // not dropped to 10
    expect(bonked.seats[0]?.shield).toBe(false); // and it was used up
    expect(bonked.lastTurn?.steps.some((s) => s.kind === 'bonk')).toBe(true);
  });

  it('double dice rolls two on the next turn', () => {
    let state = table({ positions: [5, 1], settings: boxes });
    state = ok(openBox(state, 'p0', 'double'));
    expect(state.seats[0]?.double).toBe(true);

    const mine: SnakesState = { ...state, turnIndex: 0 };
    const doubled = ok(
      onAction(mine, 'p0', { type: 'roll' }, { now: 0, rng: rngSeq(die(2), die(3)) }),
    );
    expect(doubled.lastTurn?.dice).toHaveLength(2);
    expect(doubled.seats[0]?.double).toBe(false);
  });

  it('a freeze ray makes the next player miss a turn', () => {
    const state = table({ positions: [5, 1, 1], settings: boxes });
    const next = ok(openBox(state, 'p0', 'freeze'));
    // p1 was frozen, so the turn skipped straight past them
    expect(next.seats[1]?.frozen).toBe(false);
    expect(next.seats[next.turnIndex]?.id).toBe('p2');
  });

  it('a charmed snake sleeps and stops biting', () => {
    const state = table({ positions: [5, 1], settings: boxes });
    const charmed = ok(openBox(state, 'p0', 'charm'));
    const asleep = charmed.snakes.find((s) => s.sleep > 0);
    expect(asleep).toBeDefined();

    // stand in front of its head and walk onto it; it should not bite
    const parked: SnakesState = {
      ...charmed,
      turnIndex: 0,
      seats: charmed.seats.map((s, i) => (i === 0 ? { ...s, pos: asleep!.head - 1 } : s)),
    };
    const safe = ok(onAction(parked, 'p0', { type: 'roll' }, { now: 0, rng: rngSeq(die(1)) }));
    expect(safe.seats[0]?.pos).toBe(asleep!.head);
  });

  it('an earthquake pushes everyone else back two', () => {
    const state = table({ positions: [5, 40, 50], settings: boxes });
    const next = ok(openBox(state, 'p0', 'quake'));
    expect(next.seats[1]?.pos).toBe(38);
    expect(next.seats[2]?.pos).toBe(48);
    expect(next.seats[0]?.pos).toBe(7); // the thrower stays put
  });
});

describe('snake sleep', () => {
  it('wears off as the rounds pass', () => {
    const base = table({ positions: [1, 1], settings: { rollAgainOnSix: false } });
    const drowsy: SnakesState = {
      ...base,
      snakes: base.snakes.map((s, i) => (i === 0 ? { ...s, sleep: 2 } : s)),
    };

    // one full lap of the table is one round
    let state = ok(onAction(drowsy, 'p0', { type: 'roll' }, { now: 0, rng: rngSeq(die(1)) }));
    state = ok(onAction(state, 'p1', { type: 'roll' }, { now: 0, rng: rngSeq(die(1)) }));
    expect(state.round).toBe(2);
    expect(state.snakes[0]?.sleep).toBe(1);
  });
});

describe('Noodle the wanderer', () => {
  it('is only on the board when the rule is on', () => {
    const off = setup(players(2), { ...SNAKES_DEFAULTS, noodle: false }, ctx());
    expect(off.snakes.some((s) => s.boss)).toBe(false);
    const on = setup(players(2), { ...SNAKES_DEFAULTS, noodle: true }, ctx());
    expect(on.snakes.some((s) => s.boss)).toBe(true);
  });

  it('relocates to a legal tile as the rounds pass', () => {
    const rng = seeded(5);
    let state = setup(
      players(2),
      { ...SNAKES_DEFAULTS, noodle: true, mysteryBoxes: false, rollAgainOnSix: false, turnTimer: 0 },
      { now: 0, rng },
    );
    const startHead = state.snakes.find((s) => s.boss)?.head;

    for (let i = 0; i < 24 && !state.finished; i++) {
      const who = state.seats[state.turnIndex]?.id;
      if (!who) break;
      state = ok(onAction(state, who, { type: 'roll' }, { now: i * 1000, rng }));
    }

    const noodle = state.snakes.find((s) => s.boss);
    expect(noodle).toBeDefined();
    expect(noodle!.head).not.toBe(startHead);
    expect(noodle!.tail).toBeLessThan(noodle!.head);
    expect(noodle!.tail).toBeGreaterThanOrEqual(2);
    // it must not squat on anything that already means something
    expect(new Set<number>([...LADDERS.flat(), LAST_TILE]).has(noodle!.head)).toBe(false);
  });
});

describe('a whole game with every twist on', () => {
  it('finishes from a seeded start without stalling or going off the board', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const rng = seeded(seed);
      let state = setup(
        players(4),
        { ...SNAKES_DEFAULTS, turnTimer: 0, mysteryBoxes: true, noodle: true },
        { now: 0, rng },
      );

      let turns = 0;
      while (!state.finished && turns < 8000) {
        turns++;
        const who = state.seats[state.turnIndex]?.id;
        if (!who) break;
        const res = onAction(state, who, { type: 'roll' }, { now: turns * 1000, rng });
        if (!res.ok) throw new Error(`seed ${seed} refused a legal roll: ${res.error}`);
        state = res.state;
        for (const seat of state.seats) {
          expect(seat.pos).toBeGreaterThanOrEqual(1);
          expect(seat.pos).toBeLessThanOrEqual(LAST_TILE);
        }
      }

      expect(state.finished).toBe(true);
      expect(state.seats.find((s) => s.id === state.winnerId)?.pos).toBe(LAST_TILE);
    }
  });
});
