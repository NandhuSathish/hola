import { describe, expect, it } from 'vitest';
import {
  COLORS,
  buildDeck,
  canPlayOn,
  cardValue,
  decksFor,
  handValue,
  isNumberCard,
  isWild,
  shuffle,
} from './deck.js';
import type { Card } from './types.js';

const card = (color: Card['color'], value: Card['value'], id = 'x'): Card => ({ id, color, value });

describe('deck building', () => {
  it('is 108 cards', () => {
    expect(buildDeck()).toHaveLength(108);
  });

  it('has 25 of each colour', () => {
    const deck = buildDeck();
    for (const colour of COLORS) {
      expect(deck.filter((c) => c.color === colour)).toHaveLength(25);
    }
  });

  it('has one 0 and two of each 1-9 per colour', () => {
    const red = buildDeck().filter((c) => c.color === 'red');
    expect(red.filter((c) => c.value === '0')).toHaveLength(1);
    for (let v = 1; v <= 9; v++) {
      expect(red.filter((c) => c.value === String(v))).toHaveLength(2);
    }
  });

  it('has two of each action per colour', () => {
    const red = buildDeck().filter((c) => c.color === 'red');
    for (const action of ['skip', 'reverse', 'draw2']) {
      expect(red.filter((c) => c.value === action)).toHaveLength(2);
    }
  });

  it('has four wilds and four wild4s', () => {
    const deck = buildDeck();
    expect(deck.filter((c) => c.value === 'wild')).toHaveLength(4);
    expect(deck.filter((c) => c.value === 'wild4')).toHaveLength(4);
  });

  it('gives every card a unique id, even across two decks', () => {
    const deck = buildDeck(2);
    expect(deck).toHaveLength(216);
    expect(new Set(deck.map((c) => c.id)).size).toBe(216);
  });

  it('switches to two decks past eight players', () => {
    expect(decksFor(2)).toBe(1);
    expect(decksFor(8)).toBe(1);
    expect(decksFor(9)).toBe(2);
    expect(decksFor(15)).toBe(2);
  });

  it('leaves plenty of cards after dealing a full table', () => {
    const deck = buildDeck(decksFor(15));
    expect(deck.length - 15 * 7).toBeGreaterThan(100);
  });
});

describe('card values', () => {
  it('scores numbers at face value', () => {
    expect(cardValue(card('red', '0'))).toBe(0);
    expect(cardValue(card('red', '7'))).toBe(7);
    expect(cardValue(card('red', '9'))).toBe(9);
  });

  it('scores actions at 20 and wilds at 50', () => {
    expect(cardValue(card('red', 'skip'))).toBe(20);
    expect(cardValue(card('red', 'reverse'))).toBe(20);
    expect(cardValue(card('red', 'draw2'))).toBe(20);
    expect(cardValue(card('wild', 'wild'))).toBe(50);
    expect(cardValue(card('wild', 'wild4'))).toBe(50);
  });

  it('sums a hand', () => {
    expect(handValue([card('red', '5'), card('blue', 'skip'), card('wild', 'wild4')])).toBe(75);
  });

  it('tells numbers and wilds apart', () => {
    expect(isNumberCard(card('red', '3'))).toBe(true);
    expect(isNumberCard(card('red', 'skip'))).toBe(false);
    expect(isWild(card('wild', 'wild4'))).toBe(true);
    expect(isWild(card('red', 'draw2'))).toBe(false);
  });
});

describe('shuffle', () => {
  const seeded = () => {
    let i = 0;
    return () => ((i++ * 9301 + 49297) % 233280) / 233280;
  };

  it('keeps every card', () => {
    const deck = buildDeck();
    const shuffled = shuffle(deck, seeded());
    expect(shuffled).toHaveLength(deck.length);
    expect(new Set(shuffled.map((c) => c.id))).toEqual(new Set(deck.map((c) => c.id)));
  });

  it('is deterministic for a given rng', () => {
    expect(shuffle(buildDeck(), seeded()).map((c) => c.id)).toEqual(
      shuffle(buildDeck(), seeded()).map((c) => c.id),
    );
  });

  it('actually reorders', () => {
    const deck = buildDeck();
    const shuffled = shuffle(deck, seeded());
    expect(shuffled.map((c) => c.id)).not.toEqual(deck.map((c) => c.id));
  });

  it('does not mutate the input', () => {
    const deck = buildDeck();
    const before = deck.map((c) => c.id);
    shuffle(deck, seeded());
    expect(deck.map((c) => c.id)).toEqual(before);
  });
});

describe('what can be played', () => {
  const top = card('red', '5');

  it('matches on colour', () => {
    expect(canPlayOn(card('red', '9'), top, 'red')).toBe(true);
  });

  it('matches on value even across colours', () => {
    expect(canPlayOn(card('blue', '5'), top, 'red')).toBe(true);
  });

  it('refuses a card matching neither', () => {
    expect(canPlayOn(card('blue', '9'), top, 'red')).toBe(false);
  });

  it('lets a wild go on anything', () => {
    expect(canPlayOn(card('wild', 'wild'), top, 'red')).toBe(true);
    expect(canPlayOn(card('wild', 'wild4'), top, 'red')).toBe(true);
  });

  it('follows the chosen colour, not the wild underneath', () => {
    const wildTop = card('wild', 'wild');
    expect(canPlayOn(card('green', '2'), wildTop, 'green')).toBe(true);
    expect(canPlayOn(card('red', '2'), wildTop, 'green')).toBe(false);
  });

  it('matches actions by symbol across colours', () => {
    expect(canPlayOn(card('blue', 'skip'), card('red', 'skip'), 'red')).toBe(true);
  });
});
