/**
 * Moments where the game stops and waits for people.
 *
 * Two of the mock's twists need this: the snake standoff waits on one player
 * for a timed press, and the crowd vote waits on everyone else. Both are the
 * same shape — a set of players, a deadline, and a payload to render — so they
 * share one concept rather than becoming two bespoke features.
 *
 * Nothing about this needs new socket events. `game:action` already accepts a
 * payload from any player and lets the engine decide, and `onTick` already
 * resolves deadlines.
 */

/** Milliseconds the needle takes to sweep out and back. */
export const STANDOFF_PERIOD_MS = 2200;
/** How long a player has to stop the needle. */
export const STANDOFF_MS = 3600;
/** How long the room has to vote. */
export const CROWD_VOTE_MS = 8000;

export type VoteEffect = {
  /** Tiles forward, or backward when negative. */
  move?: number;
  shield?: boolean;
  freeze?: boolean;
  double?: boolean;
  /** Trade places with whoever is last. */
  swapLast?: boolean;
};

export type VoteOption = {
  label: string;
  /** Matches the icon names the client knows. */
  icon: string;
  effect: VoteEffect;
};

/** The crowd always picks between two, drawn as a pair. */
export const VOTE_PAIRS: readonly (readonly [VoteOption, VoteOption])[] = [
  [
    { label: 'Zoom ahead 6', icon: 'rocket', effect: { move: 6 } },
    { label: 'Slide back 6', icon: 'banana', effect: { move: -6 } },
  ],
  [
    { label: 'Give them a shield', icon: 'shield', effect: { shield: true } },
    { label: 'Freeze their next turn', icon: 'freeze', effect: { freeze: true } },
  ],
  [
    { label: 'Two dice next turn', icon: 'dice', effect: { double: true } },
    { label: 'Swap with last place', icon: 'swap', effect: { swapLast: true } },
  ],
];

export type StandoffPrompt = {
  kind: 'standoff';
  /** The snake being charmed. */
  snakeHead: number;
  /** Safe band, as percentages of the sweep. */
  zoneStart: number;
  zoneWidth: number;
  periodMs: number;
};

export type CrowdPrompt = {
  kind: 'crowd';
  /** Whose fate is being decided. */
  subjectId: string;
  options: readonly [VoteOption, VoteOption];
  /** playerId -> which option, as they come in. */
  votes: Record<string, 0 | 1>;
};

export type Prompt = {
  /** So a late answer cannot be applied to the next prompt. */
  id: string;
  /** Who the game is waiting on. */
  awaiting: string[];
  startedAt: number;
  endsAt: number;
  detail: StandoffPrompt | CrowdPrompt;
};

/**
 * Where the needle sits, 0..100, at a given moment. A triangle wave, so it
 * sweeps out and back. Both sides compute this from the same numbers: the
 * client to draw it, the server to judge it.
 */
export function needleAt(startedAt: number, now: number, periodMs: number): number {
  const t = (now - startedAt) / periodMs;
  return (1 - Math.abs((t % 2) - 1)) * 100;
}

export function inZone(position: number, zoneStart: number, zoneWidth: number): boolean {
  return position >= zoneStart && position <= zoneStart + zoneWidth;
}

/** Majority wins; a tie is broken by the injected rng. */
export function tallyVotes(
  votes: Record<string, 0 | 1>,
  rng: () => number,
): { winner: 0 | 1; counts: [number, number] } {
  let zero = 0;
  let one = 0;
  for (const choice of Object.values(votes)) {
    if (choice === 0) zero++;
    else one++;
  }
  const winner: 0 | 1 = zero === one ? (rng() < 0.5 ? 0 : 1) : zero > one ? 0 : 1;
  return { winner, counts: [zero, one] };
}
