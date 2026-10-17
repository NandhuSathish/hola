import type { SettingsSpec } from '../types.js';

export type TurnTimer = 0 | 20 | 40;

/** The lobby's house rules (REFERENCE.md section 4). */
export type LastCardSettings = {
  stackDraw: boolean;
  sevenZero: boolean;
  drawUntilPlayable: boolean;
  shoutPenalty: boolean;
  /** Seconds. 0 means off. */
  turnTimer: TurnTimer;
};

export const LAST_CARD_DEFAULTS: LastCardSettings = {
  stackDraw: true,
  sevenZero: false,
  drawUntilPlayable: false,
  shoutPenalty: true,
  turnTimer: 20,
};

const TIMERS: readonly TurnTimer[] = [0, 20, 40];

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Anything can arrive over a socket, so every field is checked and a bad value
 * simply keeps the current one.
 */
export const lastCardSettings: SettingsSpec<LastCardSettings> = {
  defaults: LAST_CARD_DEFAULTS,
  apply(current, patch) {
    const base = { ...LAST_CARD_DEFAULTS, ...(current as Partial<LastCardSettings> | null) };
    if (typeof patch !== 'object' || patch === null) return base;
    const p = patch as Partial<Record<keyof LastCardSettings, unknown>>;

    const timer = TIMERS.find((t) => t === p.turnTimer);

    return {
      stackDraw: bool(p.stackDraw, base.stackDraw),
      sevenZero: bool(p.sevenZero, base.sevenZero),
      drawUntilPlayable: bool(p.drawUntilPlayable, base.drawUntilPlayable),
      shoutPenalty: bool(p.shoutPenalty, base.shoutPenalty),
      turnTimer: timer ?? base.turnTimer,
    };
  },
};
