import type { SettingsSpec } from '../types.js';

export type Overs = 1 | 2 | 4 | 6;
/** Seconds to pick. Never 0: a ball nobody answers would hang the match. */
export type PickSeconds = 5 | 7 | 10 | 15;

export type HandCricketSettings = {
  /** Overs per innings. Six balls each. */
  overs: Overs;
  /** How long both sides have to throw a number. */
  pickSeconds: PickSeconds;
  /**
   * Odd runs cross the batters, as in cricket. Off makes the striker stay put
   * until they are out, which is how most people play it in a corridor.
   */
  rotateOnOdds: boolean;
};

export const HAND_CRICKET_DEFAULTS: HandCricketSettings = {
  overs: 2,
  pickSeconds: 7,
  rotateOnOdds: true,
};

export const BALLS_PER_OVER = 6;

const OVERS: readonly Overs[] = [1, 2, 4, 6];
const SECONDS: readonly PickSeconds[] = [5, 7, 10, 15];

const one = <T>(allowed: readonly T[], value: unknown, fallback: T): T =>
  (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/** Anything can arrive over a socket, so a bad value keeps the current one. */
export const handCricketSettings: SettingsSpec<HandCricketSettings> = {
  defaults: HAND_CRICKET_DEFAULTS,
  apply(current, patch) {
    const base = { ...HAND_CRICKET_DEFAULTS, ...(current as Partial<HandCricketSettings> | null) };
    if (typeof patch !== 'object' || patch === null) return base;
    const p = patch as Partial<HandCricketSettings>;
    return {
      overs: one(OVERS, p.overs, base.overs),
      pickSeconds: one(SECONDS, p.pickSeconds, base.pickSeconds),
      rotateOnOdds: bool(p.rotateOnOdds, base.rotateOnOdds),
    };
  },
};
