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
  | { kind: 'snake'; from: number; to: number };

/** Everything the renderer needs to replay the last roll. */
export type LastTurn = {
  playerId: string;
  dice: number[];
  steps: MoveStep[];
  /** True when the roll could not be used at all under exact-finish. */
  overshot: boolean;
};

export type SnakesSeat = {
  id: string;
  pos: number;
  present: boolean;
  stats: {
    ladders: number;
    bites: number;
    /** Biggest single-turn gain, for the results screen. */
    best: number;
  };
};

export type SnakesState = {
  seats: SnakesSeat[];
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
  };
  seats: {
    playerId: string;
    pos: number;
    connected: boolean;
    ladders: number;
    bites: number;
  }[];
  turnPlayerId: string;
  turnEndsAt: number | null;
  round: number;
  lastTurn: LastTurn | null;
  turnSeq: number;
  finished: boolean;
};
