import type { SettingsSpec } from '../types.js';

export type SnakesTurnTimer = 0 | 20 | 40;

/**
 * Every rule twist from the mock. Shake-to-roll is an input style rather than
 * a rule, so it does not live here.
 */
export type SnakesSettings = {
  /** Land on 100 exactly, bouncing back off it otherwise. */
  exactFinish: boolean;
  /** A six lets you roll again, up to three rolls in a turn. */
  rollAgainOnSix: boolean;
  /** Gift tiles hand out surprise cards. */
  mysteryBoxes: boolean;
  /** Noodle, the boss snake, relocates every few rounds. */
  noodle: boolean;
  /** One chance to charm a snake before it swallows you. */
  standoff: boolean;
  /** Megaphone tiles put your fate to a vote by everyone else. */
  crowdVote: boolean;
  /** Seconds. 0 means off; on timeout the server rolls for you. */
  turnTimer: SnakesTurnTimer;
};

export const SNAKES_DEFAULTS: SnakesSettings = {
  exactFinish: true,
  rollAgainOnSix: true,
  mysteryBoxes: true,
  noodle: true,
  standoff: true,
  crowdVote: true,
  turnTimer: 20,
};

/** Most rolls a single turn can have, however many sixes you throw. */
export const MAX_ROLLS_PER_TURN = 3;

const TIMERS: readonly SnakesTurnTimer[] = [0, 20, 40];

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Anything can arrive over a socket, so a bad value keeps the current one. */
export const snakesSettings: SettingsSpec<SnakesSettings> = {
  defaults: SNAKES_DEFAULTS,
  apply(current, patch) {
    const base = { ...SNAKES_DEFAULTS, ...(current as Partial<SnakesSettings> | null) };
    if (typeof patch !== 'object' || patch === null) return base;
    const p = patch as Partial<Record<keyof SnakesSettings, unknown>>;

    const timer = TIMERS.find((t) => t === p.turnTimer);

    return {
      exactFinish: bool(p.exactFinish, base.exactFinish),
      rollAgainOnSix: bool(p.rollAgainOnSix, base.rollAgainOnSix),
      mysteryBoxes: bool(p.mysteryBoxes, base.mysteryBoxes),
      noodle: bool(p.noodle, base.noodle),
      standoff: bool(p.standoff, base.standoff),
      crowdVote: bool(p.crowdVote, base.crowdVote),
      turnTimer: timer ?? base.turnTimer,
    };
  },
};
