import type { LastCardSettings } from './settings.js';

export type Color = 'red' | 'yellow' | 'green' | 'blue';

export type CardValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2'
  | 'wild' | 'wild4';

export type Card = {
  id: string;
  color: Color | 'wild';
  value: CardValue;
};

export type LastCardAction =
  | { type: 'play'; cardId: string; chosenColor?: Color; swapWith?: string }
  | { type: 'draw' }
  /** Only after drawing. */
  | { type: 'pass' }
  | { type: 'shout' }
  | { type: 'catch'; targetId: string };

export type SeatState = {
  id: string;
  hand: Card[];
  /** Cleared once the hand grows back to three, so a pre-emptive shout sticks. */
  shouted: boolean;
  /** False while they are disconnected; the runner keeps this current. */
  present: boolean;
};

export type LastCardState = {
  seats: SeatState[];
  drawPile: Card[];
  /** Top card is the last element. */
  discardPile: Card[];
  currentColor: Color;
  direction: 1 | -1;
  turnIndex: number;
  /** Running stack total; 0 when nothing is pending. */
  pendingDraw: number;
  /** +2s and +4s never mix, so the stack remembers which kind it is. */
  pendingDrawType: 'draw2' | 'wild4' | null;
  /** They have drawn this turn and may now play that card or pass. */
  hasDrawn: boolean;
  /** Who is sitting on one card unshouted, until the next player acts. */
  catchableId: string | null;
  turnStartedAt: number;
  finished: boolean;
  winnerId: string | null;
  settings: LastCardSettings;
};

export type LastCardView = {
  me: {
    hand: Card[];
    playableIds: string[];
    mustChooseColor: boolean;
    canPass: boolean;
    shouted: boolean;
  };
  seats: {
    playerId: string;
    cardCount: number;
    shouted: boolean;
    catchable: boolean;
    connected: boolean;
  }[];
  topCard: Card;
  currentColor: Color;
  direction: 1 | -1;
  turnPlayerId: string;
  turnEndsAt: number | null;
  /** Stacking total, 0 if none. */
  pendingDraw: number;
  drawPileCount: number;
};
