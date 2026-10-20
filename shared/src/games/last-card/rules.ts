import type { GameEvent, PlayerRef, RoundResult } from '../types.js';
import type { LastCardSettings } from './settings.js';
import {
  HAND_SIZE,
  buildDeck,
  canPlayOn,
  decksFor,
  handValue,
  isNumberCard,
  isWild,
  shuffle,
} from './deck.js';
import type { Card, Color, LastCardAction, LastCardState, LastCardView, SeatState } from './types.js';

export type Ctx = { now: number; rng: () => number };

export type ActionResult =
  | { ok: true; state: LastCardState; events: GameEvent[] }
  | { ok: false; error: string };

const COLOR_SET: readonly Color[] = ['red', 'yellow', 'green', 'blue'];
const isColor = (v: unknown): v is Color => COLOR_SET.includes(v as Color);

/**
 * Structural copy of everything the engine mutates. Cards are only ever moved
 * between piles, never edited in place, so they can be shared by reference —
 * which keeps this cheap even with a 216-card deck. Avoids structuredClone so
 * shared stays free of any runtime-specific globals.
 */
function clone(state: LastCardState): LastCardState {
  return {
    ...state,
    seats: state.seats.map((s) => ({ ...s, hand: [...s.hand] })),
    drawPile: [...state.drawPile],
    discardPile: [...state.discardPile],
    settings: { ...state.settings },
  };
}

function seatOf(state: LastCardState, playerId: string): SeatState | undefined {
  return state.seats.find((s) => s.id === playerId);
}

function indexOf(state: LastCardState, playerId: string): number {
  return state.seats.findIndex((s) => s.id === playerId);
}

function currentSeat(state: LastCardState): SeatState | undefined {
  return state.seats[state.turnIndex];
}

export function topCard(state: LastCardState): Card {
  const top = state.discardPile[state.discardPile.length - 1];
  if (!top) throw new Error('discard pile is empty, which setup should prevent');
  return top;
}

/** A pre-emptive shout at two cards sticks; getting back to three clears it. */
function syncShout(seat: SeatState): void {
  if (seat.hand.length >= 3) seat.shouted = false;
}

function step(state: LastCardState, from: number, steps: number): number {
  const n = state.seats.length;
  if (n === 0) return 0;
  return (((from + state.direction * steps) % n) + n) % n;
}

/**
 * Draws up to `count`. If the pile runs out the discard is reshuffled back in,
 * all but its top card. If both are empty the player simply draws fewer and
 * the round carries on (REFERENCE.md section 4, draw pile edge cases).
 */
function drawInto(state: LastCardState, seat: SeatState, count: number, rng: () => number): Card[] {
  const drawn: Card[] = [];

  for (let i = 0; i < count; i++) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length <= 1) break;
      const top = state.discardPile.pop();
      if (!top) break;
      state.drawPile = shuffle(state.discardPile, rng);
      state.discardPile = [top];
    }
    const card = state.drawPile.pop();
    if (!card) break;
    drawn.push(card);
  }

  seat.hand.push(...drawn);
  syncShout(seat);
  return drawn;
}

/** Which of a seat's cards are legal right now. */
export function playableIds(state: LastCardState, seat: SeatState): string[] {
  const top = topCard(state);

  // A live stack can only be answered with the same kind of draw card.
  if (state.pendingDraw > 0 && state.settings.stackDraw) {
    const needed = state.pendingDrawType;
    return seat.hand.filter((c) => c.value === needed).map((c) => c.id);
  }

  return seat.hand.filter((c) => canPlayOn(c, top, state.currentColor)).map((c) => c.id);
}

function beginTurn(state: LastCardState, index: number, now: number): void {
  state.turnIndex = index;
  state.hasDrawn = false;
  state.turnStartedAt = now;
}

export function setup(players: PlayerRef[], settings: LastCardSettings, ctx: Ctx): LastCardState {
  const deck = shuffle(buildDeck(decksFor(players.length)), ctx.rng);

  const seats: SeatState[] = players.map((p) => ({
    id: p.id,
    hand: deck.splice(0, HAND_SIZE),
    shouted: false,
    present: true,
  }));

  // Flip until a number card shows; anything else goes back at a random spot,
  // so the deal stays reproducible for a given seed.
  let start = deck.pop();
  while (start && !isNumberCard(start)) {
    const at = Math.floor(ctx.rng() * (deck.length + 1));
    deck.splice(at, 0, start);
    start = deck.pop();
  }
  if (!start) throw new Error('deck ran out before a start card turned up');

  return {
    seats,
    drawPile: deck,
    discardPile: [start],
    currentColor: start.color === 'wild' ? 'red' : start.color,
    direction: 1,
    // The player after the host leads, and the host is always seat 0.
    turnIndex: seats.length > 1 ? 1 : 0,
    pendingDraw: 0,
    pendingDrawType: null,
    hasDrawn: false,
    catchableId: null,
    turnStartedAt: ctx.now,
    finished: false,
    winnerId: null,
    settings,
  };
}

function describe(card: Card): string {
  const names: Partial<Record<Card['value'], string>> = {
    skip: 'skip',
    reverse: 'reverse',
    draw2: '+2',
    wild: 'wild',
    wild4: 'wild +4',
  };
  const named = names[card.value];
  if (named) return card.color === 'wild' ? 'a ' + named : 'a ' + card.color + ' ' + named;
  return card.color + ' ' + card.value;
}

function finish(state: LastCardState, winnerId: string, events: GameEvent[]): void {
  state.finished = true;
  state.winnerId = winnerId;
  state.catchableId = null;
  events.push({ kind: 'win', text: 'went out', playerId: winnerId });
}

/** Exposed if they are down to one card and never shouted. */
function refreshCatchable(state: LastCardState, seat: SeatState): void {
  state.catchableId = seat.hand.length === 1 && !seat.shouted ? seat.id : null;
}

function playCard(
  state: LastCardState,
  seat: SeatState,
  action: Extract<LastCardAction, { type: 'play' }>,
  ctx: Ctx,
): ActionResult {
  const cardIndex = seat.hand.findIndex((c) => c.id === action.cardId);
  const card = seat.hand[cardIndex];
  if (!card) return { ok: false, error: 'That card is not in your hand.' };

  if (!playableIds(state, seat).includes(card.id)) {
    if (state.pendingDraw > 0) {
      const kind = state.pendingDrawType === 'wild4' ? '+4' : '+2';
      return { ok: false, error: `You can only answer that with a ${kind}, or draw.` };
    }
    return { ok: false, error: 'That card does not match.' };
  }

  if (isWild(card) && !isColor(action.chosenColor)) {
    return { ok: false, error: 'Pick a colour for your wild.' };
  }

  const sevenZero = state.settings.sevenZero;
  const isSeven = sevenZero && card.value === '7';
  const isZero = sevenZero && card.value === '0';

  let swapTarget: SeatState | undefined;
  if (isSeven) {
    if (!action.swapWith) return { ok: false, error: 'Choose who to swap hands with.' };
    if (action.swapWith === seat.id) return { ok: false, error: 'You cannot swap with yourself.' };
    swapTarget = seatOf(state, action.swapWith);
    if (!swapTarget) return { ok: false, error: 'That player is not at the table.' };
  }

  const events: GameEvent[] = [];
  const seatIndex = indexOf(state, seat.id);
  const n = state.seats.length;

  seat.hand.splice(cardIndex, 1);
  state.discardPile.push(card);
  state.currentColor =
    isWild(card) && action.chosenColor ? action.chosenColor : (card.color as Color);
  events.push({ kind: 'play', text: 'played ' + describe(card), playerId: seat.id });

  refreshCatchable(state, seat);

  let advance = 1;

  switch (card.value) {
    case 'skip':
      advance = 2;
      events.push({ kind: 'skip', text: 'skipped the next player', playerId: seat.id });
      break;

    case 'reverse':
      state.direction = state.direction === 1 ? -1 : 1;
      // Heads-up, a reverse bounces the turn straight back.
      advance = n === 2 ? 2 : 1;
      events.push({ kind: 'reverse', text: 'reversed the direction', playerId: seat.id });
      break;

    case 'draw2':
    case 'wild4': {
      const amount = card.value === 'draw2' ? 2 : 4;
      if (state.settings.stackDraw) {
        state.pendingDraw += amount;
        state.pendingDrawType = card.value;
        events.push({
          kind: 'stack',
          text: 'stacked it to +' + state.pendingDraw,
          playerId: seat.id,
        });
      } else {
        const victim = state.seats[step(state, seatIndex, 1)];
        if (victim) {
          const taken = drawInto(state, victim, amount, ctx.rng);
          events.push({ kind: 'draw', text: 'drew ' + taken.length, playerId: victim.id });
        }
        advance = 2;
      }
      break;
    }

    case '7':
      if (swapTarget) {
        const mine = seat.hand;
        seat.hand = swapTarget.hand;
        swapTarget.hand = mine;
        syncShout(seat);
        syncShout(swapTarget);
        events.push({ kind: 'swap', text: 'swapped hands', playerId: seat.id });
        // A swap can hand someone their last card, so recheck who is exposed.
        refreshCatchable(state, seat);
      }
      break;

    case '0':
      if (isZero && n > 1) {
        const hands = state.seats.map((s) => s.hand);
        for (let i = 0; i < n; i++) {
          const from = (((i - state.direction) % n) + n) % n;
          const incoming = hands[from];
          const target = state.seats[i];
          if (target && incoming) target.hand = incoming;
        }
        for (const s of state.seats) syncShout(s);
        events.push({ kind: 'rotate', text: 'passed every hand along', playerId: seat.id });
        refreshCatchable(state, seat);
      }
      break;

    default:
      break;
  }

  if (seat.hand.length === 0) {
    finish(state, seat.id, events);
    return { ok: true, state, events };
  }

  beginTurn(state, step(state, seatIndex, advance), ctx.now);
  return { ok: true, state, events };
}

export function onAction(
  input: LastCardState,
  playerId: string,
  action: LastCardAction,
  ctx: Ctx,
): ActionResult {
  if (input.finished) return { ok: false, error: 'The round is over.' };

  // Actions arrive straight off a socket, so nothing about the shape can be
  // taken on trust. An illegal move is an error, never a throw.
  if (typeof action !== 'object' || action === null || typeof action.type !== 'string') {
    return { ok: false, error: 'That move makes no sense here.' };
  }

  const state = clone(input);
  const seat = seatOf(state, playerId);
  if (!seat) return { ok: false, error: 'You are not in this round.' };

  // Catching happens out of turn, so it is handled before the turn guard.
  if (action.type === 'catch') {
    if (!state.settings.shoutPenalty) return { ok: false, error: 'Catching is turned off.' };
    if (!state.catchableId) return { ok: false, error: 'Nobody to catch right now.' };
    if (action.targetId === playerId) return { ok: false, error: 'You cannot catch yourself.' };
    if (action.targetId !== state.catchableId) return { ok: false, error: 'They are safe.' };

    const target = seatOf(state, action.targetId);
    if (!target) return { ok: false, error: 'That player is not at the table.' };

    drawInto(state, target, 2, ctx.rng);
    state.catchableId = null;
    return {
      ok: true,
      state,
      events: [{ kind: 'catch', text: 'was caught and drew 2', playerId: target.id }],
    };
  }

  if (action.type === 'shout') {
    if (seat.shouted) return { ok: false, error: 'You already shouted.' };
    const size = seat.hand.length;
    const onTurn = currentSeat(state)?.id === playerId;

    // Two cards only counts on your own turn, before you play.
    if (size === 1 || (size === 2 && onTurn)) {
      seat.shouted = true;
      if (state.catchableId === playerId) state.catchableId = null;
      return { ok: true, state, events: [{ kind: 'shout', text: 'shouted last card', playerId }] };
    }

    // Three or more does nothing at all, and costs nothing either.
    return { ok: true, state, events: [] };
  }

  if (currentSeat(state)?.id !== playerId) {
    return { ok: false, error: 'Wait for your turn.' };
  }

  // Taking your turn closes the window on whoever was exposed before you.
  if (state.catchableId && state.catchableId !== playerId) state.catchableId = null;

  const seatIndex = indexOf(state, playerId);

  switch (action.type) {
    case 'play':
      return playCard(state, seat, action, ctx);

    case 'draw': {
      if (state.hasDrawn) return { ok: false, error: 'You already drew. Play it or pass.' };
      const events: GameEvent[] = [];

      if (state.pendingDraw > 0) {
        const taken = drawInto(state, seat, state.pendingDraw, ctx.rng);
        events.push({
          kind: 'draw',
          text: 'took the +' + state.pendingDraw + ' (' + taken.length + ' cards)',
          playerId,
        });
        state.pendingDraw = 0;
        state.pendingDrawType = null;
        beginTurn(state, step(state, seatIndex, 1), ctx.now);
        return { ok: true, state, events };
      }

      if (state.settings.drawUntilPlayable) {
        let taken = 0;
        while (playableIds(state, seat).length === 0) {
          if (drawInto(state, seat, 1, ctx.rng).length === 0) break;
          taken++;
        }
        events.push({
          kind: 'draw',
          text: taken === 1 ? 'drew a card' : 'drew ' + taken + ' cards',
          playerId,
        });
      } else {
        const got = drawInto(state, seat, 1, ctx.rng);
        events.push({
          kind: 'draw',
          text: got.length ? 'drew a card' : 'had nothing left to draw',
          playerId,
        });
      }

      state.hasDrawn = true;
      // Nothing playable even after drawing, so the turn simply ends.
      if (playableIds(state, seat).length === 0) {
        beginTurn(state, step(state, seatIndex, 1), ctx.now);
      }
      return { ok: true, state, events };
    }

    case 'pass': {
      if (!state.hasDrawn) return { ok: false, error: 'Draw a card before you pass.' };
      beginTurn(state, step(state, seatIndex, 1), ctx.now);
      return { ok: true, state, events: [{ kind: 'pass', text: 'passed', playerId }] };
    }

    default:
      return { ok: false, error: 'That move makes no sense here.' };
  }
}

/** Turn timeout: take the pending draw, or draw one, then move on. */
export function onTick(
  input: LastCardState,
  ctx: Ctx,
): { state: LastCardState; events: GameEvent[] } | null {
  if (input.finished || input.settings.turnTimer === 0) return null;

  const deadline = input.turnStartedAt + input.settings.turnTimer * 1000;
  if (ctx.now < deadline) return null;

  const state = clone(input);
  const seat = currentSeat(state);
  if (!seat) return null;

  const events: GameEvent[] = [];
  const seatIndex = state.turnIndex;

  if (state.pendingDraw > 0) {
    const taken = drawInto(state, seat, state.pendingDraw, ctx.rng);
    events.push({
      kind: 'timeout',
      text: 'ran out of time and took ' + taken.length,
      playerId: seat.id,
    });
    state.pendingDraw = 0;
    state.pendingDrawType = null;
  } else if (!state.hasDrawn) {
    drawInto(state, seat, 1, ctx.rng);
    events.push({ kind: 'timeout', text: 'ran out of time and drew', playerId: seat.id });
  } else {
    events.push({ kind: 'timeout', text: 'ran out of time', playerId: seat.id });
  }

  if (state.catchableId && state.catchableId !== seat.id) state.catchableId = null;
  beginTurn(state, step(state, seatIndex, 1), ctx.now);
  return { state, events };
}

function turnEndsAt(state: LastCardState): number | null {
  return state.settings.turnTimer === 0
    ? null
    : state.turnStartedAt + state.settings.turnTimer * 1000;
}

function publicSeats(state: LastCardState): LastCardView['seats'] {
  return state.seats.map((s) => ({
    playerId: s.id,
    cardCount: s.hand.length,
    shouted: s.shouted,
    catchable: state.catchableId === s.id,
    connected: s.present,
  }));
}

export function getPlayerView(state: LastCardState, playerId: string): LastCardView {
  const seat = seatOf(state, playerId);
  const mine = currentSeat(state)?.id === playerId;

  return {
    me: {
      hand: seat ? seat.hand : [],
      // Only ever populated on your own turn, so the UI cannot light up cards
      // you are not allowed to play yet.
      playableIds: seat && mine ? playableIds(state, seat) : [],
      // The colour rides along with the play action, so there is never a
      // half-finished wild sitting in state.
      mustChooseColor: false,
      canPass: mine && state.hasDrawn,
      shouted: seat?.shouted ?? false,
    },
    seats: publicSeats(state),
    topCard: topCard(state),
    currentColor: state.currentColor,
    direction: state.direction,
    turnPlayerId: currentSeat(state)?.id ?? '',
    turnEndsAt: turnEndsAt(state),
    pendingDraw: state.pendingDraw,
    drawPileCount: state.drawPile.length,
  };
}

/** Nobody's hand — for spectators and anyone who left mid-round. */
export function getSpectatorView(state: LastCardState): LastCardView {
  return {
    me: { hand: [], playableIds: [], mustChooseColor: false, canPass: false, shouted: false },
    seats: publicSeats(state),
    topCard: topCard(state),
    currentColor: state.currentColor,
    direction: state.direction,
    turnPlayerId: currentSeat(state)?.id ?? '',
    turnEndsAt: turnEndsAt(state),
    pendingDraw: state.pendingDraw,
    drawPileCount: state.drawPile.length,
  };
}

/** Winner takes all: they score everyone else's leftovers, the rest score 0. */
export function getResult(state: LastCardState): RoundResult | null {
  if (!state.finished || !state.winnerId) return null;
  const winnerId = state.winnerId;

  const pot = state.seats
    .filter((s) => s.id !== winnerId)
    .reduce((total, s) => total + handValue(s.hand), 0);

  return {
    winnerId,
    scoreLabel: 'Cards left',
    higherIsBetter: false,
    scores: state.seats.map((s) => ({
      playerId: s.id,
      score: s.hand.length,
      points: s.id === winnerId ? pot : 0,
    })),
  };
}

/** Gone for good: their cards go under the draw pile. */
export function onPlayerLeft(input: LastCardState, playerId: string): LastCardState {
  const state = clone(input);
  const index = indexOf(state, playerId);
  if (index < 0) return state;

  const [gone] = state.seats.splice(index, 1);
  if (gone) state.drawPile.unshift(...gone.hand);
  if (state.catchableId === playerId) state.catchableId = null;

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

  // Keep the turn pointing at whoever it was already on.
  if (index < state.turnIndex) state.turnIndex--;
  const n = state.seats.length;
  state.turnIndex = ((state.turnIndex % n) + n) % n;
  return state;
}
