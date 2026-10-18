import type { CardId } from './cards.js';
import type { SnakesSettings } from './settings.js';

export type SnakesAction = { type: 'roll' };

/**
 * One leg of a move, in the order it happened. The server resolves a whole
 * turn at once, but the client needs the journey rather than the destination:
 * hops first, then a ladder climb or a snake swallowing you.
 */
export type MoveStep =
  /** Tile by tile, including any bounce back off 100. */
  | { kind: 'walk'; path: number[] }
  | { kind: 'ladder'; from: number; to: number }
  | { kind: 'snake'; from: number; to: number }
  /** A shield took the hit, so the snake was bonked instead of swallowing. */
  | { kind: 'bonk'; tile: number }
  /** Opened a mystery box; the card's own effect follows as further steps. */
  | { kind: 'card'; card: CardId }
  /** Rocket boots or a banana peel: a glide rather than a walk. */
  | { kind: 'jump'; from: number; to: number }
  /** Traded places with someone. */
  | { kind: 'swap'; withPlayerId: string; from: number; to: number };

/** Everything the renderer needs to replay the last roll. */
export type LastTurn = {
  playerId: string;
  dice: number[];
  steps: MoveStep[];
  /** True when the roll could not be used at all under exact-finish. */
  overshot: boolean;
};

/** A snake lives in state now: it can be charmed to sleep, and Noodle moves. */
export type LiveSnake = {
  head: number;
  tail: number;
  /** Rounds left asleep. A sleeping snake lets you walk over its head. */
  sleep: number;
  /** Noodle, the one that wanders. */
  boss: boolean;
};

export type SnakesSeat = {
  id: string;
  pos: number;
  present: boolean;
  /** Bonks the next snake instead of being swallowed. */
  shield: boolean;
  /** Rolls two dice on the next turn. */
  double: boolean;
  /** Misses the next turn. */
  frozen: boolean;
  stats: {
    ladders: number;
    bites: number;
    boxes: number;
    /** Biggest single-turn gain, for the results screen. */
    best: number;
  };
};

export type SnakesState = {
  seats: SnakesSeat[];
  /** Mutable, because snakes sleep and Noodle relocates. */
  snakes: LiveSnake[];
  turnIndex: number;
  /** Rolls taken this turn; a six lets you go again, up to MAX_ROLLS. */
  rollsThisTurn: number;
  turnStartedAt: number;
  round: number;
  finished: boolean;
  winnerId: string | null;
  lastTurn: LastTurn | null;
  /** Bumped per resolved roll, so the client knows an animation is new. */
  turnSeq: number;
  settings: SnakesSettings;
};

export type SnakesView = {
  me: {
    canRoll: boolean;
    /** Still your turn after a six. */
    rollsLeft: number;
    shield: boolean;
    double: boolean;
  };
  /** Sent because they move; the client cannot use the static board data. */
  snakes: LiveSnake[];
  seats: {
    playerId: string;
    pos: number;
    connected: boolean;
    ladders: number;
    bites: number;
    shield: boolean;
    frozen: boolean;
  }[];
  turnPlayerId: string;
  turnEndsAt: number | null;
  round: number;
  lastTurn: LastTurn | null;
  turnSeq: number;
  finished: boolean;
};
