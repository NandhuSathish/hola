import { beforeEach, describe, expect, it } from 'vitest';
import type { PlayerRef } from '../types.js';
import { LAST_CARD_DEFAULTS, type LastCardSettings } from './settings.js';
import {
  getPlayerView,
  getResult,
  getSpectatorView,
  onAction,
  onPlayerLeft,
  onTick,
  setup,
  topCard,
} from './rules.js';
import type { Card, Color, LastCardState } from './types.js';

/** Deterministic rng, so a failing test fails the same way twice. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const players = (n: number): PlayerRef[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: '🦊' }));

const ctx = (now = 0, seed = 1) => ({ now, rng: seeded(seed) });

const card = (color: Card['color'], value: Card['value'], id?: string): Card => ({
  id: id ?? `${color}-${value}`,
  color,
  value,
});

/**
 * Builds an exact table instead of dealing one, so each rule can be aimed at
 * precisely. Anything not named falls back to a sane default.
 */
function table(opts: {
  hands: Card[][];
  top?: Card;
  color?: Color;
  turnIndex?: number;
  settings?: Partial<LastCardSettings>;
  drawPile?: Card[];
  direction?: 1 | -1;
  pendingDraw?: number;
  pendingDrawType?: 'draw2' | 'wild4' | null;
}): LastCardState {
  const top = opts.top ?? card('red', '5', 'top');
  return {
    seats: opts.hands.map((hand, i) => ({ id: `p${i}`, hand, shouted: false, present: true })),
    drawPile: opts.drawPile ?? [card('blue', '9', 'd1'), card('green', '3', 'd2'), card('blue', '1', 'd3')],
    discardPile: [top],
    currentColor: opts.color ?? (top.color === 'wild' ? 'red' : top.color),
    direction: opts.direction ?? 1,
    turnIndex: opts.turnIndex ?? 0,
    pendingDraw: opts.pendingDraw ?? 0,
    pendingDrawType: opts.pendingDrawType ?? null,
    hasDrawn: false,
    catchableId: null,
    turnStartedAt: 0,
    finished: false,
    winnerId: null,
    settings: { ...LAST_CARD_DEFAULTS, ...opts.settings },
  };
}

/** Unwraps a successful action, failing loudly with the engine's own message. */
function ok(result: ReturnType<typeof onAction>): LastCardState {
  if (!result.ok) throw new Error('expected success, got: ' + result.error);
  return result.state;
}

function err(result: ReturnType<typeof onAction>): string {
  if (result.ok) throw new Error('expected a refusal, but the move was allowed');
  return result.error;
}

// ---------------------------------------------------------------- setup

describe('setup', () => {
  it('deals seven to everyone', () => {
    const state = setup(players(4), LAST_CARD_DEFAULTS, ctx());
    for (const seat of state.seats) expect(seat.hand).toHaveLength(7);
  });

  it('starts on a number card', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const state = setup(players(4), LAST_CARD_DEFAULTS, ctx(0, seed));
      expect(topCard(state).value).toMatch(/^[0-9]$/);
    }
  });

  it('uses one deck up to eight players and two beyond', () => {
    const small = setup(players(8), LAST_CARD_DEFAULTS, ctx());
    const big = setup(players(9), LAST_CARD_DEFAULTS, ctx());
    expect(small.drawPile.length + 8 * 7 + 1).toBe(108);
    expect(big.drawPile.length + 9 * 7 + 1).toBe(216);
  });

  it('never deals the same card twice', () => {
    const state = setup(players(15), LAST_CARD_DEFAULTS, ctx());
    const ids = [
      ...state.seats.flatMap((s) => s.hand.map((c) => c.id)),
      ...state.drawPile.map((c) => c.id),
      ...state.discardPile.map((c) => c.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(216);
  });

  it('starts with the player after the host', () => {
    const state = setup(players(4), LAST_CARD_DEFAULTS, ctx());
    expect(state.seats[state.turnIndex]?.id).toBe('p1');
    expect(state.direction).toBe(1);
  });

  it('is reproducible for a seed', () => {
    const a = setup(players(5), LAST_CARD_DEFAULTS, ctx(0, 42));
    const b = setup(players(5), LAST_CARD_DEFAULTS, ctx(0, 42));
    expect(a.seats.map((s) => s.hand.map((c) => c.id))).toEqual(
      b.seats.map((s) => s.hand.map((c) => c.id)),
    );
  });
});

// ---------------------------------------------------------------- turns

describe('taking a turn', () => {
  it('refuses a move out of turn', () => {
    const state = table({ hands: [[card('red', '1')], [card('red', '2')]] });
    expect(err(onAction(state, 'p1', { type: 'play', cardId: 'red-2' }, ctx()))).toBe(
      'Wait for your turn.',
    );
  });

  it('refuses malformed actions instead of throwing', () => {
    // These arrive straight off a socket, so a bad shape must not crash anything.
    const state = table({ hands: [[card('red', '1')], []] });
    for (const junk of [null, undefined, 42, 'draw', [], {}, { type: 7 }, { nope: true }]) {
      const result = onAction(state, 'p0', junk as never, ctx());
      expect(result.ok).toBe(false);
    }
  });

  it('refuses a card that is not in your hand', () => {
    const state = table({ hands: [[card('red', '1')], []] });
    expect(err(onAction(state, 'p0', { type: 'play', cardId: 'nope' }, ctx()))).toBe(
      'That card is not in your hand.',
    );
  });

  it('refuses a card matching neither colour nor value', () => {
    const state = table({ hands: [[card('blue', '9')], []], top: card('red', '5') });
    expect(err(onAction(state, 'p0', { type: 'play', cardId: 'blue-9' }, ctx()))).toBe(
      'That card does not match.',
    );
  });

  it('accepts a colour match and a value match', () => {
    const base = table({ hands: [[card('red', '9'), card('blue', '5')], []] });
    expect(ok(onAction(base, 'p0', { type: 'play', cardId: 'red-9' }, ctx())).seats[0]?.hand).toHaveLength(1);
    expect(ok(onAction(base, 'p0', { type: 'play', cardId: 'blue-5' }, ctx())).seats[0]?.hand).toHaveLength(1);
  });

  it('does not mutate the state it was given', () => {
    const state = table({ hands: [[card('red', '9')], []] });
    const before = JSON.stringify(state);
    onAction(state, 'p0', { type: 'play', cardId: 'red-9' }, ctx());
    expect(JSON.stringify(state)).toBe(before);
  });

  it('passes the turn on', () => {
    const state = table({ hands: [[card('red', '9'), card('yellow', '6', 'spare')], [], []] });
    expect(ok(onAction(state, 'p0', { type: 'play', cardId: 'red-9' }, ctx())).turnIndex).toBe(1);
  });
});

// ---------------------------------------------------------------- effects

describe('card effects', () => {
  it('skip jumps the next player', () => {
    const state = table({ hands: [[card('red', 'skip'), card('yellow', '6', 'spare')], [], []] });
    expect(ok(onAction(state, 'p0', { type: 'play', cardId: 'red-skip' }, ctx())).turnIndex).toBe(2);
  });

  it('reverse flips direction', () => {
    const state = table({ hands: [[card('red', 'reverse'), card('yellow', '6', 'spare')], [], []] });
    const next = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-reverse' }, ctx()));
    expect(next.direction).toBe(-1);
    expect(next.turnIndex).toBe(2);
  });

  it('reverse acts as a skip with two players', () => {
    const state = table({ hands: [[card('red', 'reverse'), card('red', '1')], [card('red', '2')]] });
    const next = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-reverse' }, ctx()));
    expect(next.turnIndex).toBe(0);
  });

  it('draw2 without stacking makes the next player draw and lose the turn', () => {
    const state = table({
      hands: [[card('red', 'draw2'), card('yellow', '6', 'spare')], [], []],
      settings: { stackDraw: false },
    });
    const next = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-draw2' }, ctx()));
    expect(next.seats[1]?.hand).toHaveLength(2);
    expect(next.turnIndex).toBe(2);
    expect(next.pendingDraw).toBe(0);
  });

  it('wild needs a colour, and then sets it', () => {
    const state = table({ hands: [[card('wild', 'wild')], []] });
    expect(err(onAction(state, 'p0', { type: 'play', cardId: 'wild-wild' }, ctx()))).toBe(
      'Pick a colour for your wild.',
    );
    const next = ok(
      onAction(state, 'p0', { type: 'play', cardId: 'wild-wild', chosenColor: 'green' }, ctx()),
    );
    expect(next.currentColor).toBe('green');
  });

  it('refuses a colour that is not a colour', () => {
    const state = table({ hands: [[card('wild', 'wild')], []] });
    const bad = { type: 'play', cardId: 'wild-wild', chosenColor: 'purple' } as never;
    expect(err(onAction(state, 'p0', bad, ctx()))).toBe('Pick a colour for your wild.');
  });

  it('follows the chosen colour afterwards, not the wild', () => {
    const state = table({
      hands: [[card('wild', 'wild'), card('yellow', '6', 'spare')], [card('green', '2'), card('red', '2')]],
    });
    const next = ok(
      onAction(state, 'p0', { type: 'play', cardId: 'wild-wild', chosenColor: 'green' }, ctx()),
    );
    const view = getPlayerView(next, 'p1');
    expect(view.me.playableIds).toContain('green-2');
    expect(view.me.playableIds).not.toContain('red-2');
  });
});

// ---------------------------------------------------------------- stacking

describe('stacking draw cards', () => {
  it('builds up a running total', () => {
    let state = table({
      hands: [[card('red', 'draw2'), card('yellow', '6', 'spare')], [card('blue', 'draw2'), card('yellow', '6', 'spare')], []],
    });
    state = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-draw2' }, ctx()));
    expect(state.pendingDraw).toBe(2);
    expect(state.turnIndex).toBe(1);

    state = ok(onAction(state, 'p1', { type: 'play', cardId: 'blue-draw2' }, ctx()));
    expect(state.pendingDraw).toBe(4);
    expect(state.turnIndex).toBe(2);
  });

  it('will not mix a +2 with a +4', () => {
    let state = table({
      hands: [[card('red', 'draw2'), card('yellow', '6', 'spare')], [card('wild', 'wild4')], []],
    });
    state = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-draw2' }, ctx()));
    expect(
      err(onAction(state, 'p1', { type: 'play', cardId: 'wild-wild4', chosenColor: 'red' }, ctx())),
    ).toBe('You can only answer that with a +2, or draw.');
  });

  it('will not let an ordinary card answer a stack', () => {
    let state = table({ hands: [[card('red', 'draw2'), card('yellow', '6', 'spare')], [card('red', '5')], []] });
    state = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-draw2' }, ctx()));
    expect(err(onAction(state, 'p1', { type: 'play', cardId: 'red-5' }, ctx()))).toContain(
      'You can only answer that with a +2',
    );
  });

  it('makes whoever gives in take the lot and lose their turn', () => {
    let state = table({
      hands: [[card('red', 'draw2'), card('yellow', '6', 'spare')], [card('blue', 'draw2'), card('yellow', '6', 'spare')], [card('red', '1')]],
      drawPile: Array.from({ length: 10 }, (_, i) => card('green', '4', 'pile' + i)),
    });
    state = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-draw2' }, ctx()));
    state = ok(onAction(state, 'p1', { type: 'play', cardId: 'blue-draw2' }, ctx()));
    state = ok(onAction(state, 'p2', { type: 'draw' }, ctx()));

    expect(state.seats[2]?.hand).toHaveLength(1 + 4);
    expect(state.pendingDraw).toBe(0);
    expect(state.pendingDrawType).toBeNull();
    expect(state.turnIndex).toBe(0);
  });

  it('draws what is left when the stack outruns the cards', () => {
    let state = table({
      hands: [[card('red', 'draw2'), card('yellow', '6', 'spare')], [card('blue', 'draw2'), card('yellow', '6', 'spare')], [card('red', '1')]],
      drawPile: [card('green', '4', 'only')],
    });
    state = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-draw2' }, ctx()));
    state = ok(onAction(state, 'p1', { type: 'play', cardId: 'blue-draw2' }, ctx()));
    state = ok(onAction(state, 'p2', { type: 'draw' }, ctx()));

    // one from the pile, two more once the discard is recycled, then nothing
    expect(state.seats[2]?.hand.length).toBeGreaterThan(1);
    expect(state.pendingDraw).toBe(0);
    expect(state.finished).toBe(false);
  });
});

// ---------------------------------------------------------------- 7 and 0

describe('7 swaps and 0 rotates', () => {
  const on = { sevenZero: true };

  it('swaps hands with the chosen player', () => {
    const state = table({
      hands: [[card('red', '7'), card('red', '1')], [card('blue', '8')], [card('green', '9')]],
      settings: on,
    });
    const next = ok(
      onAction(state, 'p0', { type: 'play', cardId: 'red-7', swapWith: 'p2' }, ctx()),
    );
    expect(next.seats[0]?.hand.map((c) => c.id)).toEqual(['green-9']);
    expect(next.seats[2]?.hand.map((c) => c.id)).toEqual(['red-1']);
  });

  it('needs a target, and refuses yourself', () => {
    const state = table({ hands: [[card('red', '7')], [card('blue', '8')]], settings: on });
    expect(err(onAction(state, 'p0', { type: 'play', cardId: 'red-7' }, ctx()))).toBe(
      'Choose who to swap hands with.',
    );
    expect(
      err(onAction(state, 'p0', { type: 'play', cardId: 'red-7', swapWith: 'p0' }, ctx())),
    ).toBe('You cannot swap with yourself.');
  });

  it('refuses a target who is not at the table', () => {
    const state = table({ hands: [[card('red', '7')], [card('blue', '8')]], settings: on });
    expect(
      err(onAction(state, 'p0', { type: 'play', cardId: 'red-7', swapWith: 'ghost' }, ctx())),
    ).toBe('That player is not at the table.');
  });

  it('passes every hand one seat along', () => {
    const state = table({
      hands: [
        [card('red', '0'), card('red', 'a' as never)],
        [card('blue', '8')],
        [card('green', '9'), card('green', '2')],
      ],
      settings: on,
    });
    const next = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-0' }, ctx()));
    // clockwise: p0 gets p2's hand, p1 gets p0's, p2 gets p1's
    expect(next.seats[1]?.hand.map((c) => c.id)).toEqual(['red-a']);
    expect(next.seats[2]?.hand.map((c) => c.id)).toEqual(['blue-8']);
  });

  it('treats 7 and 0 as plain numbers when the rule is off', () => {
    const state = table({
      hands: [[card('red', '7'), card('yellow', '6', 'spare')], [card('blue', '8')]],
      settings: { sevenZero: false },
    });
    const next = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-7' }, ctx()));
    expect(next.seats[1]?.hand.map((c) => c.id)).toEqual(['blue-8']);
    expect(next.turnIndex).toBe(1);
  });
});

// ---------------------------------------------------------------- drawing

describe('drawing', () => {
  it('draws one and lets you pass', () => {
    const state = table({
      hands: [[card('blue', '9')], []],
      top: card('red', '5'),
      drawPile: [card('red', '2', 'playable')],
    });
    const drawn = ok(onAction(state, 'p0', { type: 'draw' }, ctx()));
    expect(drawn.seats[0]?.hand).toHaveLength(2);
    expect(drawn.hasDrawn).toBe(true);
    expect(getPlayerView(drawn, 'p0').me.canPass).toBe(true);

    const passed = ok(onAction(drawn, 'p0', { type: 'pass' }, ctx()));
    expect(passed.turnIndex).toBe(1);
  });

  it('refuses a second draw, and a pass before drawing', () => {
    const state = table({
      hands: [[card('blue', '9')], []],
      drawPile: [card('red', '2', 'playable')],
    });
    const drawn = ok(onAction(state, 'p0', { type: 'draw' }, ctx()));
    expect(err(onAction(drawn, 'p0', { type: 'draw' }, ctx()))).toBe(
      'You already drew. Play it or pass.',
    );
    expect(err(onAction(state, 'p0', { type: 'pass' }, ctx()))).toBe(
      'Draw a card before you pass.',
    );
  });

  it('ends the turn when the drawn card is unplayable', () => {
    const state = table({
      hands: [[card('blue', '9')], []],
      top: card('red', '5'),
      drawPile: [card('green', '2', 'g2')],
    });
    expect(ok(onAction(state, 'p0', { type: 'draw' }, ctx())).turnIndex).toBe(1);
  });

  it('keeps drawing until playable when that rule is on', () => {
    const state = table({
      hands: [[card('blue', '9')], []],
      top: card('red', '5'),
      settings: { drawUntilPlayable: true },
      drawPile: [card('red', '3', 'hit'), card('green', '8', 'miss2'), card('blue', '2', 'miss1')],
    });
    const next = ok(onAction(state, 'p0', { type: 'draw' }, ctx()));
    expect(next.seats[0]?.hand.map((c) => c.id)).toContain('hit');
    expect(next.seats[0]?.hand).toHaveLength(4);
    expect(next.turnIndex).toBe(0);
  });

  it('recycles the discard pile when the draw pile runs dry', () => {
    const state: LastCardState = {
      ...table({ hands: [[card('blue', '9')], []], drawPile: [] }),
      discardPile: [card('red', '1', 'buried'), card('red', '2', 'alsoburied'), card('red', '5', 'top')],
    };
    const next = ok(onAction(state, 'p0', { type: 'draw' }, ctx()));
    expect(next.seats[0]?.hand).toHaveLength(2);
    expect(topCard(next).id).toBe('top');
  });

  it('survives both piles being empty', () => {
    const state: LastCardState = {
      ...table({ hands: [[card('blue', '9')], []], drawPile: [] }),
      discardPile: [card('red', '5', 'top')],
    };
    const next = ok(onAction(state, 'p0', { type: 'draw' }, ctx()));
    expect(next.seats[0]?.hand).toHaveLength(1);
    expect(next.finished).toBe(false);
    expect(next.turnIndex).toBe(1);
  });
});

// ---------------------------------------------------------------- shout

describe('last card shout and catch', () => {
  it('lets you shout on your turn holding two', () => {
    const state = table({ hands: [[card('red', '1'), card('red', '2')], []] });
    expect(ok(onAction(state, 'p0', { type: 'shout' }, ctx())).seats[0]?.shouted).toBe(true);
  });

  it('refuses a second shout', () => {
    let state = table({ hands: [[card('red', '1'), card('red', '2')], []] });
    state = ok(onAction(state, 'p0', { type: 'shout' }, ctx()));
    expect(err(onAction(state, 'p0', { type: 'shout' }, ctx()))).toBe('You already shouted.');
  });

  it('does nothing at three cards, and does not punish you', () => {
    const state = table({
      hands: [[card('red', '1'), card('red', '2'), card('red', '3')], []],
    });
    const result = onAction(state, 'p0', { type: 'shout' }, ctx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.seats[0]?.shouted).toBe(false);
      expect(result.state.seats[0]?.hand).toHaveLength(3);
    }
  });

  it('exposes a player who plays down to one without shouting', () => {
    const state = table({ hands: [[card('red', '1'), card('red', '2')], [], []] });
    const next = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-1' }, ctx()));
    expect(next.catchableId).toBe('p0');
    expect(getSpectatorView(next).seats[0]?.catchable).toBe(true);
  });

  it('keeps a pre-emptive shout, so playing down to one is safe', () => {
    let state = table({ hands: [[card('red', '1'), card('red', '2')], [], []] });
    state = ok(onAction(state, 'p0', { type: 'shout' }, ctx()));
    state = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-1' }, ctx()));
    expect(state.catchableId).toBeNull();
  });

  it('makes a caught player draw two', () => {
    let state = table({ hands: [[card('red', '1'), card('red', '2')], [], []] });
    state = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-1' }, ctx()));
    state = ok(onAction(state, 'p1', { type: 'catch', targetId: 'p0' }, ctx()));
    expect(state.seats[0]?.hand).toHaveLength(3);
    expect(state.catchableId).toBeNull();
  });

  it('refuses catching yourself, a safe player, or nobody', () => {
    let state = table({ hands: [[card('red', '1'), card('red', '2')], [], []] });
    expect(err(onAction(state, 'p1', { type: 'catch', targetId: 'p0' }, ctx()))).toBe(
      'Nobody to catch right now.',
    );
    state = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-1' }, ctx()));
    expect(err(onAction(state, 'p0', { type: 'catch', targetId: 'p0' }, ctx()))).toBe(
      'You cannot catch yourself.',
    );
    expect(err(onAction(state, 'p1', { type: 'catch', targetId: 'p2' }, ctx()))).toBe('They are safe.');
  });

  it('closes the window once the next player acts', () => {
    let state = table({
      // p1 keeps two cards after playing, so no new window opens on them
      hands: [
        [card('red', '1'), card('red', '2')],
        [card('red', '8'), card('yellow', '6', 'spare'), card('yellow', '7', 'spare2')],
        [],
      ],
    });
    state = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-1' }, ctx()));
    expect(state.catchableId).toBe('p0');
    state = ok(onAction(state, 'p1', { type: 'play', cardId: 'red-8' }, ctx()));
    expect(state.catchableId).toBeNull();
    expect(err(onAction(state, 'p2', { type: 'catch', targetId: 'p0' }, ctx()))).toBe(
      'Nobody to catch right now.',
    );
  });

  it('honours the shout penalty being switched off', () => {
    let state = table({
      hands: [[card('red', '1'), card('red', '2')], [], []],
      settings: { shoutPenalty: false },
    });
    state = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-1' }, ctx()));
    expect(err(onAction(state, 'p1', { type: 'catch', targetId: 'p0' }, ctx()))).toBe(
      'Catching is turned off.',
    );
  });

  it('clears a stale shout once the hand grows back', () => {
    let state = table({
      hands: [[card('red', '1'), card('red', '2')], []],
      drawPile: [card('green', '4', 'g1'), card('green', '5', 'g2')],
    });
    state = ok(onAction(state, 'p0', { type: 'shout' }, ctx()));
    expect(state.seats[0]?.shouted).toBe(true);
    state = ok(onAction(state, 'p0', { type: 'draw' }, ctx()));
    expect(state.seats[0]?.hand.length).toBeGreaterThanOrEqual(3);
    expect(state.seats[0]?.shouted).toBe(false);
  });
});

// ---------------------------------------------------------------- ending

describe('ending a round', () => {
  it('ends when a player plays their last card', () => {
    const state = table({ hands: [[card('red', '1')], [card('blue', '8')]] });
    const next = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-1' }, ctx()));
    expect(next.finished).toBe(true);
    expect(next.winnerId).toBe('p0');
  });

  it('still applies the final card effect', () => {
    const state = table({
      hands: [[card('red', 'draw2')], [card('blue', '8')], []],
      settings: { stackDraw: false },
    });
    const next = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-draw2' }, ctx()));
    expect(next.finished).toBe(true);
    expect(next.seats[1]?.hand).toHaveLength(3);
  });

  it('refuses any move once finished', () => {
    const state = table({ hands: [[card('red', '1')], [card('blue', '8')]] });
    const done = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-1' }, ctx()));
    expect(err(onAction(done, 'p1', { type: 'draw' }, ctx()))).toBe('The round is over.');
  });

  it('gives the winner everyone else and the rest nothing', () => {
    const state = table({
      hands: [
        [card('red', '1')],
        [card('blue', '9'), card('red', 'skip')],
        [card('wild', 'wild4')],
      ],
    });
    const done = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-1' }, ctx()));
    const result = getResult(done);

    expect(result?.winnerId).toBe('p0');
    // 9 + 20 from p1, 50 from p2
    expect(result?.scores.find((s) => s.playerId === 'p0')?.points).toBe(79);
    expect(result?.scores.find((s) => s.playerId === 'p1')?.points).toBe(0);
    expect(result?.scores.find((s) => s.playerId === 'p2')?.points).toBe(0);
    expect(result?.scores.find((s) => s.playerId === 'p1')?.cardsLeft).toBe(2);
  });

  it('has no result while play continues', () => {
    expect(getResult(table({ hands: [[card('red', '1')], [card('red', '2')]] }))).toBeNull();
  });
});

// ---------------------------------------------------------------- views

describe('views', () => {
  it('never reveals another hand', () => {
    const state = setup(players(4), LAST_CARD_DEFAULTS, ctx());
    const view = getPlayerView(state, 'p0');
    const mine = new Set(view.me.hand.map((c) => c.id));

    expect(mine.size).toBe(7);
    for (const seat of view.seats) {
      expect(seat).not.toHaveProperty('hand');
      expect(typeof seat.cardCount).toBe('number');
    }
    // nothing in the payload matches another player's cards
    const others = state.seats.filter((s) => s.id !== 'p0').flatMap((s) => s.hand.map((c) => c.id));
    const json = JSON.stringify(view);
    for (const id of others) expect(json).not.toContain('"' + id + '"');
  });

  it('shows no hand at all to a spectator', () => {
    const state = setup(players(3), LAST_CARD_DEFAULTS, ctx());
    const view = getSpectatorView(state);
    expect(view.me.hand).toHaveLength(0);
    expect(view.seats).toHaveLength(3);
    const everyCard = state.seats.flatMap((s) => s.hand.map((c) => c.id));
    const json = JSON.stringify(view);
    for (const id of everyCard) expect(json).not.toContain('"' + id + '"');
  });

  it('only lights up playable cards on your own turn', () => {
    const state = table({ hands: [[card('red', '9')], [card('red', '8')]] });
    expect(getPlayerView(state, 'p0').me.playableIds).toEqual(['red-9']);
    expect(getPlayerView(state, 'p1').me.playableIds).toEqual([]);
  });

  it('reports the stack total and pile size', () => {
    const state = table({
      hands: [[card('red', '1')], []],
      pendingDraw: 6,
      pendingDrawType: 'draw2',
      drawPile: [card('red', '2', 'a'), card('red', '3', 'b')],
    });
    const view = getPlayerView(state, 'p0');
    expect(view.pendingDraw).toBe(6);
    expect(view.drawPileCount).toBe(2);
  });

  it('gives a deadline only when the timer is on', () => {
    const timed = table({ hands: [[card('red', '1')], []], settings: { turnTimer: 20 } });
    expect(getPlayerView(timed, 'p0').turnEndsAt).toBe(20_000);
    const untimed = table({ hands: [[card('red', '1')], []], settings: { turnTimer: 0 } });
    expect(getPlayerView(untimed, 'p0').turnEndsAt).toBeNull();
  });
});

// ---------------------------------------------------------------- timer

describe('the turn timer', () => {
  it('does nothing before the deadline, or when switched off', () => {
    const timed = table({ hands: [[card('red', '1')], []], settings: { turnTimer: 20 } });
    expect(onTick(timed, ctx(19_999))).toBeNull();
    const off = table({ hands: [[card('red', '1')], []], settings: { turnTimer: 0 } });
    expect(onTick(off, ctx(10_000_000))).toBeNull();
  });

  it('draws one and moves on at the deadline', () => {
    const state = table({
      hands: [[card('blue', '9')], []],
      settings: { turnTimer: 20 },
      drawPile: [card('green', '2', 'g2')],
    });
    const ticked = onTick(state, ctx(20_000));
    expect(ticked?.state.seats[0]?.hand).toHaveLength(2);
    expect(ticked?.state.turnIndex).toBe(1);
  });

  it('takes a pending stack on timeout', () => {
    const state = table({
      hands: [[card('blue', '9')], []],
      settings: { turnTimer: 20 },
      pendingDraw: 4,
      pendingDrawType: 'draw2',
      drawPile: Array.from({ length: 6 }, (_, i) => card('green', '4', 'p' + i)),
    });
    const ticked = onTick(state, ctx(20_000));
    expect(ticked?.state.seats[0]?.hand).toHaveLength(5);
    expect(ticked?.state.pendingDraw).toBe(0);
  });

  it('stops once the round is over', () => {
    const state = { ...table({ hands: [[], []] }), finished: true, winnerId: 'p0' };
    expect(onTick(state, ctx(999_999))).toBeNull();
  });
});

// ---------------------------------------------------------------- leaving

describe('players leaving', () => {
  it('puts their cards under the draw pile', () => {
    const state = table({
      hands: [[card('red', '1')], [card('blue', '8'), card('blue', '9')], [card('green', '2')]],
      drawPile: [card('red', '4', 'keep')],
    });
    const next = onPlayerLeft(state, 'p1');
    expect(next.seats).toHaveLength(2);
    expect(next.drawPile).toHaveLength(3);
    // under means they are drawn last
    expect(next.drawPile[next.drawPile.length - 1]?.id).toBe('keep');
  });

  it('ends the round when only one player is left', () => {
    const state = table({ hands: [[card('red', '1')], [card('blue', '8')]] });
    const next = onPlayerLeft(state, 'p1');
    expect(next.finished).toBe(true);
    expect(next.winnerId).toBe('p0');
  });

  it('keeps the turn on the same player', () => {
    const state = table({
      hands: [[card('red', '1')], [card('blue', '8')], [card('green', '2')]],
      turnIndex: 2,
    });
    const next = onPlayerLeft(state, 'p0');
    expect(next.seats[next.turnIndex]?.id).toBe('p2');
  });

  it('shrugs off someone who was never there', () => {
    const state = table({ hands: [[card('red', '1')], [card('blue', '8')]] });
    expect(onPlayerLeft(state, 'ghost').seats).toHaveLength(2);
  });

  it('clears a catch window left by the player who left', () => {
    let state = table({ hands: [[card('red', '1'), card('red', '2')], [], []] });
    state = ok(onAction(state, 'p0', { type: 'play', cardId: 'red-1' }, ctx()));
    expect(state.catchableId).toBe('p0');
    expect(onPlayerLeft(state, 'p0').catchableId).toBeNull();
  });
});
