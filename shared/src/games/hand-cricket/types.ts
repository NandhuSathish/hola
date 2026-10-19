import type { HandCricketSettings } from './settings.js';

/** What you can throw. No five — that is hand cricket, not cricket. */
export const NUMBERS = [0, 1, 2, 3, 4, 6] as const;
export type Pick = (typeof NUMBERS)[number];

export const isPick = (value: unknown): value is Pick =>
  (NUMBERS as readonly unknown[]).includes(value);

/** What a ball came to. 'W' is a wicket; anything else is the runs scored. */
export type Outcome = Pick | 'W';

export type Side = 'heads' | 'tails';

export type HandCricketAction =
  /** The away captain calls the coin. */
  | { type: 'call'; side: Side }
  /** The toss winner takes bat or ball. */
  | { type: 'choose'; bat: boolean }
  /** Your number for this ball. */
  | { type: 'pick'; ballId: string; value: Pick };

export type Batter = {
  playerId: string;
  runs: number;
  balls: number;
  out: boolean;
  /** Who got them, for the scorecard. */
  outTo: string | null;
  /** Has not been to the crease yet. */
  yetToBat: boolean;
};

export type BowlerFigures = {
  playerId: string;
  balls: number;
  runs: number;
  wickets: number;
};

export type Innings = {
  /** 0 or 1 — which team is batting. */
  battingTeam: 0 | 1;
  runs: number;
  wickets: number;
  /** Legal balls bowled. Overs are balls / 6. */
  balls: number;
  batters: Batter[];
  /** Indices into `batters`. With a team of one there is no non-striker. */
  striker: number;
  nonStriker: number | null;
  bowling: BowlerFigures[];
  /** Index into the bowling team, rotating every over. */
  bowlerIndex: number;
  /** This over's outcomes, for the strip under the score. */
  over: Outcome[];
  /** The over before this one, kept so the strip has something to show. */
  lastOver: Outcome[];
  /** Newest first. */
  commentary: { over: string; text: string }[];
  done: boolean;
};

/**
 * A ball in flight: both sides pick at once and neither sees the other until
 * it closes. This is the whole point of the game, and the reason the view has
 * to do real work (rule 2).
 */
export type BallWindow = {
  /** So a late pick cannot be applied to the next ball. */
  id: string;
  startedAt: number;
  endsAt: number;
  batterId: string;
  bowlerId: string;
  /** playerId -> their number. Never leaves the server whole. */
  picks: Record<string, Pick>;
};

/** Everything the client needs to replay the ball that just happened. */
export type ResolvedBall = {
  batterId: string;
  bowlerId: string;
  bat: Pick;
  bowl: Pick;
  outcome: Outcome;
  /** "1.3" — the over and ball it was. */
  at: string;
  /** The batter's number was odd, so the two of them crossed. */
  strikeSwapped: boolean;
  /** This ball completed an over. */
  overComplete: boolean;
  /** A wicket brought someone new in. */
  newBatterId: string | null;
  /** Picked for them because the clock ran out. */
  autoBat: boolean;
  autoBowl: boolean;
};

export type Toss = {
  /** Team 1's first seat calls it. */
  callerId: string;
  call: Side | null;
  landed: Side | null;
  /** Who won the toss, once it has landed. */
  winner: 0 | 1 | null;
  /** The winner has said bat or bowl. */
  settled: boolean;
};

export type HandCricketState = {
  /** playerIds, split from the room's seat order. */
  teams: [string[], string[]];
  phase: 'toss' | 'play' | 'done';
  toss: Toss;
  /** One entry once the first innings starts, two after the change. */
  innings: Innings[];
  /** Runs the side batting second needs. Null during the first innings. */
  target: number | null;
  ball: BallWindow | null;
  /** Bumped per resolved ball, so the client knows an animation is new. */
  seq: number;
  lastBall: ResolvedBall | null;
  settings: HandCricketSettings;
  finished: boolean;
  /** Null with the scores level. */
  winnerTeam: 0 | 1 | null;
  /** Filled in when the match ends, for the result screen. */
  summary: string | null;
};

/** A batting card row as the client draws it. */
export type BatterView = Batter & { name?: never };

export type InningsView = {
  battingTeam: 0 | 1;
  runs: number;
  wickets: number;
  balls: number;
  batters: Batter[];
  striker: number;
  nonStriker: number | null;
  bowling: BowlerFigures[];
  bowlerIndex: number;
  over: Outcome[];
  lastOver: Outcome[];
  commentary: { over: string; text: string }[];
  done: boolean;
};

export type HandCricketView = {
  phase: 'toss' | 'play' | 'done';
  teams: [string[], string[]];
  toss: Toss;
  me: {
    /** Null if you are watching — a spectator who joined mid-match. */
    team: 0 | 1 | null;
    /** What you are doing on this ball. */
    role: 'bat' | 'bowl' | 'watch';
    /** You are one of the two and have not picked yet. */
    canPick: boolean;
    /** Your own number, which nobody else can see until the reveal. */
    myPick: Pick | null;
    /** The toss is yours to call, or yours to decide. */
    canCall: boolean;
    canChoose: boolean;
  };
  innings: InningsView[];
  /** Which innings is live. */
  current: number;
  target: number | null;
  /** Just the parts of the open ball everyone may know. */
  ball: {
    id: string;
    startedAt: number;
    endsAt: number;
    batterId: string;
    bowlerId: string;
    /** Who has not picked yet — a count of who we are waiting on, by id. */
    waitingOn: string[];
  } | null;
  lastBall: ResolvedBall | null;
  seq: number;
  finished: boolean;
  winnerTeam: 0 | 1 | null;
  summary: string | null;
};
