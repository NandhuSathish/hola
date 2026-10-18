import type { Card, CardValue, Color } from './types.js';

export const COLORS: readonly Color[] = ['red', 'yellow', 'green', 'blue'];

/** Two decks past eight players, so nobody runs dry (REFERENCE.md section 4). */
export const TWO_DECK_THRESHOLD = 8;
export const HAND_SIZE = 7;

export function isNumberCard(card: Card): boolean {
  return /^[0-9]$/.test(card.value);
}

export function isWild(card: Card): boolean {
  return card.value === 'wild' || card.value === 'wild4';
}

/** Scoring values: numbers at face, actions 20, wilds 50. */
export function cardValue(card: Card): number {
  if (isNumberCard(card)) return Number(card.value);
  return isWild(card) ? 50 : 20;
}

export function handValue(hand: readonly Card[]): number {
  return hand.reduce((total, card) => total + cardValue(card), 0);
}

/**
 * One deck is 108: per colour a single 0, two each of 1-9, and two each of
 * skip, reverse and draw2 (25 a colour), plus four wilds and four wild4s.
 */
export function buildDeck(decks = 1): Card[] {
  const cards: Card[] = [];
  let n = 0;
  const push = (color: Color | 'wild', value: CardValue) => {
    cards.push({ id: 'c' + n++, color, value });
  };

  for (let d = 0; d < decks; d++) {
    for (const color of COLORS) {
      push(color, '0');
      for (let v = 1; v <= 9; v++) {
        push(color, String(v) as CardValue);
        push(color, String(v) as CardValue);
      }
      for (const action of ['skip', 'reverse', 'draw2'] as const) {
        push(color, action);
        push(color, action);
      }
    }
    for (let i = 0; i < 4; i++) {
      push('wild', 'wild');
      push('wild', 'wild4');
    }
  }

  return cards;
}

export function decksFor(playerCount: number): number {
  return playerCount > TWO_DECK_THRESHOLD ? 2 : 1;
}

/** Fisher-Yates with an injected rng, so a seed always gives the same deal. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

/** Can this card go on a pile showing top, with currentColor in force? */
export function canPlayOn(card: Card, top: Card, currentColor: Color): boolean {
  if (isWild(card)) return true;
  if (card.color === currentColor) return true;
  return card.value === top.value;
}
