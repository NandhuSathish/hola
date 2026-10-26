/**
 * Hand Cricket.
 *
 * The striker and the bowler each throw a number at the same moment. Same
 * number and the batter is out; otherwise the batter scores theirs. Two teams,
 * two innings, and the side batting second is chasing.
 *
 * Pure (CLAUDE.md rule 3): every number comes from the injected `rng` and the
 * clock arrives as `now`. The simultaneous pick is the reason `getPlayerView`
 * does real work — until a ball closes, your own number is the only one you
 * are allowed to know (rule 2).
 */
import type { GameEvent, PlayerRef, RoundResult } from '../types.js';
import {
  BALLS_PER_OVER,
  HAND_CRICKET_DEFAULTS,
  type HandCricketSettings,
} from './settings.js';
import {
  NUMBERS,
  isPick,
  type BallWindow,
  type Batter,
  type BowlerFigures,
  type HandCricketAction,
  type HandCricketState,
  type HandCricketView,
  type Innings,
  type Outcome,
  type Pick,
  type ResolvedBall,
  type Side,
} from './types.js';

type Ctx = { now: number; rng: () => number };

/**
 * The gap between balls.
 *
 * A ball takes a few seconds to tell — the run-up, the shot, the ball going
 * to the rope — and the next pick window must not open underneath it, or the
 * clock is already half gone by the time you have seen what happened. These
 * are how long the telling takes, and the client's animation is tuned to fit
 * inside them; `BREATHER_MS` is the beat afterwards to read the score and
 * get your hand ready.
 */
const BREATHER_MS = 1300;

const tellingMs = (outcome: Outcome): number =>
  outcome === 'W'
    ? 4100
    : outcome === 6
      ? 4300
      : outcome === 4
        ? 4100
        : outcome === 0
          ? 3500
          : 1950 + 550 * outcome + 1250;

/** How long after a ball before the next one is live. */
export const gapAfter = (outcome: Outcome): number => tellingMs(outcome) + BREATHER_MS;

/** The pause at the innings change, which has more to take in. */
export const INNINGS_BREAK_MS = 5200;

/**
 * How long the winners stay on the field.
 *
 * The match is decided the moment the last ball resolves, but cutting to a
 * scorecard then means nobody sees the ball that won it. The result is
 * withheld for the telling of that ball plus a few seconds of celebration, and
 * only then does the room move on.
 */
export const CELEBRATION_MS = 4500;
type Ok = { ok: true; state: HandCricketState; events: GameEvent[] };
type Err = { ok: false; error: string };

const fail = (error: string): Err => ({ ok: false, error });

/** Written out rather than structuredClone: the shared lib target has none. */
function clone(state: HandCricketState): HandCricketState {
  return {
    ...state,
    teams: [[...state.teams[0]], [...state.teams[1]]],
    toss: { ...state.toss },
    innings: state.innings.map((innings) => ({
      ...innings,
      batters: innings.batters.map((b) => ({ ...b })),
      bowling: innings.bowling.map((b) => ({ ...b })),
      over: [...innings.over],
      lastOver: [...innings.lastOver],
      commentary: innings.commentary.map((c) => ({ ...c })),
    })),
    ball: state.ball ? { ...state.ball, picks: { ...state.ball.picks } } : null,
    lastBall: state.lastBall ? { ...state.lastBall } : null,
    settings: { ...state.settings },
  };
}

/** A number from the deck of six, for whoever ran out of time. */
const randomPick = (rng: () => number): Pick =>
  NUMBERS[Math.min(NUMBERS.length - 1, Math.floor(rng() * NUMBERS.length))] as Pick;

const id = (rng: () => number): string => Math.floor(rng() * 1e9).toString(36);

// ---------------------------------------------------------------- setup

/**
 * Teams alternate down the seat order rather than splitting it in half, so
 * four friends who joined together do not all end up on the same side.
 */
export function splitTeams(playerIds: string[]): [string[], string[]] {
  const a: string[] = [];
  const b: string[] = [];
  playerIds.forEach((pid, i) => (i % 2 === 0 ? a : b).push(pid));
  return [a, b];
}

/**
 * All out after this many: one wicket per batter, as the mock has it.
 *
 * Real cricket stops a side one short, because the last batter has nobody to
 * cross with. That is the wrong trade here — it means a side of two is all
 * out on the first ball anyone matches, and a four-player match is over
 * before it starts. Everybody gets an innings instead.
 */
export const wicketsAvailable = (teamSize: number): number => Math.max(1, teamSize);

export function setup(
  players: PlayerRef[],
  settings: HandCricketSettings,
  ctx: Ctx,
): HandCricketState {
  const teams = splitTeams(players.map((p) => p.id));
  return {
    teams,
    phase: 'toss',
    toss: {
      // Team two calls, so the side that did not get the first seat gets the
      // one thing the toss has to give away.
      callerId: teams[1][0] ?? teams[0][0] ?? '',
      call: null,
      landed: null,
      winner: null,
      settled: false,
    },
    innings: [],
    target: null,
    ball: null,
    nextBallAt: null,
    seq: 0,
    lastBall: null,
    settings: { ...HAND_CRICKET_DEFAULTS, ...settings },
    finished: false,
    celebrateUntil: null,
    settled: false,
    winnerTeam: null,
    summary: null,
  };
}

// ---------------------------------------------------------------- helpers

const teamOf = (state: HandCricketState, playerId: string): 0 | 1 | null =>
  state.teams[0].includes(playerId) ? 0 : state.teams[1].includes(playerId) ? 1 : null;

const live = (state: HandCricketState): Innings | null =>
  state.innings[state.innings.length - 1] ?? null;

const bowlingTeam = (innings: Innings): 0 | 1 => (innings.battingTeam === 0 ? 1 : 0);

/** "1.3" — the over and ball, counting from the ball about to be bowled. */
const ballLabel = (balls: number): string =>
  `${Math.floor(balls / BALLS_PER_OVER)}.${(balls % BALLS_PER_OVER) + 1}`;

function newInnings(state: HandCricketState, battingTeam: 0 | 1): Innings {
  const bats = state.teams[battingTeam];
  const bowls = state.teams[battingTeam === 0 ? 1 : 0];
  const batters: Batter[] = bats.map((playerId, i) => ({
    playerId,
    runs: 0,
    balls: 0,
    out: false,
    outTo: null,
    yetToBat: i > 1,
  }));
  return {
    battingTeam,
    runs: 0,
    wickets: 0,
    balls: 0,
    batters,
    striker: 0,
    nonStriker: batters.length > 1 ? 1 : null,
    bowling: bowls.map((playerId) => ({ playerId, balls: 0, runs: 0, wickets: 0 })),
    bowlerIndex: 0,
    over: [],
    lastOver: [],
    commentary: [],
    done: false,
  };
}

const strikerOf = (innings: Innings): Batter | undefined => innings.batters[innings.striker];

const bowlerIdOf = (state: HandCricketState, innings: Innings): string => {
  const team = state.teams[bowlingTeam(innings)];
  return team[innings.bowlerIndex % Math.max(1, team.length)] ?? team[0] ?? '';
};

function openBall(state: HandCricketState, ctx: Ctx): void {
  const innings = live(state);
  if (!innings || innings.done || state.finished) {
    state.ball = null;
    state.nextBallAt = null;
    return;
  }
  const batter = strikerOf(innings);
  if (!batter) {
    state.ball = null;
    state.nextBallAt = null;
    return;
  }
  state.nextBallAt = null;
  state.ball = {
    id: id(ctx.rng),
    startedAt: ctx.now,
    endsAt: ctx.now + state.settings.pickSeconds * 1000,
    batterId: batter.playerId,
    bowlerId: bowlerIdOf(state, innings),
    picks: {},
  };
}

// ---------------------------------------------------------------- the toss

function resolveToss(state: HandCricketState, ctx: Ctx, events: GameEvent[]): void {
  const landed: Side = ctx.rng() < 0.5 ? 'heads' : 'tails';
  state.toss.landed = landed;
  state.toss.winner = state.toss.call === landed ? 1 : 0;
  events.push({
    kind: 'toss',
    text: `The coin came down ${landed}. Team ${state.toss.winner + 1} won the toss.`,
  });
}

// ---------------------------------------------------------------- a ball

/**
 * Both numbers are in. Score it, move the strike and the bowler, and see
 * whether that was the innings — or the match.
 */
function resolveBall(
  state: HandCricketState,
  bat: Pick,
  bowl: Pick,
  autoBat: boolean,
  autoBowl: boolean,
  ctx: Ctx,
  events: GameEvent[],
): void {
  const innings = live(state);
  const window = state.ball;
  if (!innings || !window) return;

  const batter = strikerOf(innings);
  const figures =
    innings.bowling.find((b) => b.playerId === window.bowlerId) ??
    ({ playerId: window.bowlerId, balls: 0, runs: 0, wickets: 0 } as BowlerFigures);
  if (!innings.bowling.includes(figures)) innings.bowling.push(figures);
  if (!batter) return;

  const out = bat === bowl;
  const outcome: Outcome = out ? 'W' : bat;
  const at = ballLabel(innings.balls);

  innings.balls += 1;
  batter.balls += 1;
  figures.balls += 1;

  let newBatterId: string | null = null;
  let strikeSwapped = false;

  if (out) {
    innings.wickets += 1;
    figures.wickets += 1;
    batter.out = true;
    batter.outTo = window.bowlerId;
    events.push({
      kind: 'wicket',
      text: `is out — both threw ${bat}.`,
      playerId: batter.playerId,
    });
    // The next player in walks to the striker's end.
    const next = innings.batters.findIndex((b) => b.yetToBat);
    if (next >= 0) {
      innings.batters[next]!.yetToBat = false;
      innings.striker = next;
      newBatterId = innings.batters[next]!.playerId;
    } else if (innings.nonStriker !== null) {
      // Nobody left on the bench, but the other end is still occupied: that
      // player carries on alone until they are out too.
      innings.striker = innings.nonStriker;
      innings.nonStriker = null;
    }
  } else {
    innings.runs += bat;
    batter.runs += bat;
    figures.runs += bat;
    const label = bat === 6 ? 'Six!' : bat === 4 ? 'Four!' : bat === 0 ? 'no run' : `${bat}`;
    events.push({
      kind: bat === 6 || bat === 4 ? 'boundary' : 'runs',
      text: `${label} (${bat} against ${bowl}).`,
      playerId: batter.playerId,
    });
    // Odd runs cross them, exactly as they would between the wickets.
    if (state.settings.rotateOnOdds && bat % 2 === 1 && innings.nonStriker !== null) {
      strikeSwapped = true;
      const held = innings.striker;
      innings.striker = innings.nonStriker;
      innings.nonStriker = held;
    }
  }

  innings.over.push(outcome);
  innings.commentary.unshift({ over: at, text: commentaryFor(outcome, bat, bowl) });
  if (innings.commentary.length > 40) innings.commentary.pop();

  const overComplete = innings.balls % BALLS_PER_OVER === 0;
  if (overComplete) {
    innings.lastOver = innings.over;
    innings.over = [];
    innings.bowlerIndex += 1;
    // Ends change at the end of an over, so the strike turns over with them.
    if (innings.nonStriker !== null) {
      const held = innings.striker;
      innings.striker = innings.nonStriker;
      innings.nonStriker = held;
    }
  }

  state.lastBall = {
    batterId: window.batterId,
    bowlerId: window.bowlerId,
    bat,
    bowl,
    outcome,
    at,
    strikeSwapped,
    overComplete,
    newBatterId,
    autoBat,
    autoBowl,
  } satisfies ResolvedBall;
  state.seq += 1;
  state.ball = null;

  closeIfOver(state, innings, ctx, events, tellingMs(outcome));
  // The next one waits for this one to be told.
  if (!state.finished && !innings.done) {
    state.nextBallAt = ctx.now + gapAfter(outcome);
  }
}

function commentaryFor(outcome: Outcome, bat: Pick, bowl: Pick): string {
  if (outcome === 'W') return `Out! Both threw ${bat}.`;
  if (bat === 0) return `No run. ${bat} against ${bowl}.`;
  if (bat === 6) return `Six! ${bat} against ${bowl}.`;
  if (bat === 4) return `Four! ${bat} against ${bowl}.`;
  return `${bat} run${bat > 1 ? 's' : ''}. ${bat} against ${bowl}.`;
}

/** Is this innings done, and if it was the second, is the match? */
function closeIfOver(
  state: HandCricketState,
  innings: Innings,
  ctx: Ctx,
  events: GameEvent[],
  tellMs: number,
): void {
  const maxBalls = state.settings.overs * BALLS_PER_OVER;
  const allOut = innings.wickets >= wicketsAvailable(state.teams[innings.battingTeam].length);
  const chased = state.target !== null && innings.runs >= state.target;
  if (!allOut && innings.balls < maxBalls && !chased) return;

  innings.done = true;
  state.ball = null;

  if (state.innings.length === 1) {
    // The change. The target is everything they made, plus one.
    state.target = innings.runs + 1;
    const next = innings.battingTeam === 0 ? 1 : 0;
    events.push({
      kind: 'innings',
      text: `Innings over — ${innings.runs} for ${innings.wickets}. Team ${next + 1} need ${state.target} to win.`,
    });
    state.innings.push(newInnings(state, next));
    state.ball = null;
    state.nextBallAt = ctx.now + INNINGS_BREAK_MS;
    return;
  }

  finishMatch(state, innings, ctx, events, tellMs);
}

function finishMatch(
  state: HandCricketState,
  second: Innings,
  ctx: Ctx,
  events: GameEvent[],
  /** How long the ball that ended it takes to tell. */
  tellMs: number,
): void {
  const target = state.target ?? 0;
  const chasing = second.battingTeam;
  const setting = chasing === 0 ? 1 : 0;
  const maxBalls = state.settings.overs * BALLS_PER_OVER;

  if (second.runs >= target) {
    const left = wicketsAvailable(state.teams[chasing].length) - second.wickets;
    const spare = maxBalls - second.balls;
    state.winnerTeam = chasing;
    state.summary = `Team ${chasing + 1} win by ${left} wicket${left === 1 ? '' : 's'}, with ${spare} ball${spare === 1 ? '' : 's'} to spare.`;
  } else if (second.runs === target - 1) {
    state.winnerTeam = null;
    state.summary = 'Scores level — it is a tie.';
  } else {
    const by = target - 1 - second.runs;
    state.winnerTeam = setting;
    state.summary = `Team ${setting + 1} win by ${by} run${by === 1 ? '' : 's'}.`;
  }

  state.finished = true;
  state.phase = 'done';
  state.ball = null;
  state.nextBallAt = null;
  state.celebrateUntil = ctx.now + tellMs + CELEBRATION_MS;
  events.push({ kind: 'result', text: state.summary });
}

// ---------------------------------------------------------------- actions

export function onAction(
  input: HandCricketState,
  playerId: string,
  action: HandCricketAction,
  ctx: Ctx,
): Ok | Err {
  if (!action || typeof action !== 'object') return fail('That move made no sense.');
  const state = clone(input);
  const events: GameEvent[] = [];

  if (state.finished) return fail('The match is over.');
  if (teamOf(state, playerId) === null) return fail('You are watching this one.');

  switch (action.type) {
    case 'call': {
      if (state.phase !== 'toss') return fail('The toss has been done.');
      if (state.toss.call !== null) return fail('It has already been called.');
      if (playerId !== state.toss.callerId) return fail('That call is not yours to make.');
      if (action.side !== 'heads' && action.side !== 'tails') return fail('Heads or tails.');

      state.toss.call = action.side;
      resolveToss(state, ctx, events);
      return { ok: true, state, events };
    }

    case 'choose': {
      if (state.phase !== 'toss') return fail('The toss has been done.');
      if (state.toss.winner === null) return fail('The coin has not landed yet.');
      if (state.toss.settled) return fail('That has been decided.');
      const captain = state.teams[state.toss.winner][0];
      if (playerId !== captain) return fail('Only the winner of the toss decides.');
      if (typeof action.bat !== 'boolean') return fail('Bat or bowl.');

      state.toss.settled = true;
      state.phase = 'play';
      const first: 0 | 1 = action.bat
        ? state.toss.winner
        : state.toss.winner === 0
          ? 1
          : 0;
      events.push({
        kind: 'toss',
        text: `Team ${state.toss.winner + 1} chose to ${action.bat ? 'bat' : 'bowl'}.`,
      });
      state.innings.push(newInnings(state, first));
      openBall(state, ctx);
      return { ok: true, state, events };
    }

    case 'pick': {
      if (state.phase !== 'play' || !state.ball) return fail('No ball is live.');
      if (state.ball.id !== action.ballId) return fail('That ball has gone.');
      if (!isPick(action.value)) return fail('Pick one of the six.');
      if (playerId !== state.ball.batterId && playerId !== state.ball.bowlerId) {
        return fail('This ball is not yours to throw.');
      }
      if (state.ball.picks[playerId] !== undefined) return fail('You have thrown already.');

      state.ball.picks[playerId] = action.value;

      const bat = state.ball.picks[state.ball.batterId];
      const bowl = state.ball.picks[state.ball.bowlerId];
      // One player on both ends only happens in a one-a-side game, where a
      // single pick is both throws and the ball resolves at once.
      if (bat !== undefined && bowl !== undefined) {
        resolveBall(state, bat, bowl, false, false, ctx, events);
      }
      return { ok: true, state, events };
    }

    default:
      return fail('That move made no sense.');
  }
}

// ---------------------------------------------------------------- the clock

/**
 * The window closes whether or not both of them answered. Anyone who did not
 * throw gets a number from the rng, which is the only thing that keeps a
 * match moving when somebody wanders off.
 */
export function onTick(
  input: HandCricketState,
  ctx: Ctx,
): { state: HandCricketState; events: GameEvent[] } | null {
  // The winners have had their ten seconds; let the scorecard through.
  if (input.finished) {
    if (input.settled || input.celebrateUntil === null) return null;
    if (ctx.now < input.celebrateUntil) return null;
    const state = clone(input);
    state.settled = true;
    state.celebrateUntil = null;
    return { state, events: [] };
  }

  if (input.phase !== 'play') return null;

  // Between balls: the gap has run out, so put the next one live.
  if (!input.ball) {
    if (input.nextBallAt === null || ctx.now < input.nextBallAt) return null;
    const state = clone(input);
    openBall(state, ctx);
    return state.ball ? { state, events: [] } : null;
  }

  if (ctx.now < input.ball.endsAt) return null;

  const state = clone(input);
  const events: GameEvent[] = [];
  const window = state.ball as BallWindow;

  const autoBat = window.picks[window.batterId] === undefined;
  const autoBowl = window.picks[window.bowlerId] === undefined;
  const bat = window.picks[window.batterId] ?? randomPick(ctx.rng);
  const bowl = window.picks[window.bowlerId] ?? randomPick(ctx.rng);

  if (autoBat || autoBowl) {
    events.push({ kind: 'timeout', text: 'Out of time — a number was thrown for them.' });
  }
  resolveBall(state, bat, bowl, autoBat, autoBowl, ctx, events);
  return { state, events };
}

// ---------------------------------------------------------------- views

const inningsView = (innings: Innings) => ({
  battingTeam: innings.battingTeam,
  runs: innings.runs,
  wickets: innings.wickets,
  balls: innings.balls,
  batters: innings.batters,
  striker: innings.striker,
  nonStriker: innings.nonStriker,
  bowling: innings.bowling,
  bowlerIndex: innings.bowlerIndex,
  over: innings.over,
  lastOver: innings.lastOver,
  commentary: innings.commentary,
  done: innings.done,
});

/**
 * The one place that matters for rule 2. While a ball is open you get your
 * own number back and nobody else's — not even a count that would let you
 * work out what the other one threw.
 */
export function getPlayerView(state: HandCricketState, playerId: string): HandCricketView {
  const team = teamOf(state, playerId);
  const ball = state.ball;
  const isBatter = ball?.batterId === playerId;
  const isBowler = ball?.bowlerId === playerId;
  const myPick = ball ? (ball.picks[playerId] ?? null) : null;

  return {
    phase: state.phase,
    teams: state.teams,
    toss: state.toss,
    me: {
      team,
      role: isBatter ? 'bat' : isBowler ? 'bowl' : 'watch',
      canPick: (isBatter || isBowler) && myPick === null && !state.finished,
      myPick,
      canCall: state.phase === 'toss' && state.toss.call === null && state.toss.callerId === playerId,
      canChoose:
        state.phase === 'toss' &&
        state.toss.winner !== null &&
        !state.toss.settled &&
        state.teams[state.toss.winner][0] === playerId,
    },
    innings: state.innings.map(inningsView),
    current: Math.max(0, state.innings.length - 1),
    target: state.target,
    ball: ball
      ? {
          id: ball.id,
          startedAt: ball.startedAt,
          endsAt: ball.endsAt,
          batterId: ball.batterId,
          bowlerId: ball.bowlerId,
          // Who we are still waiting on is public — it is a fact about the
          // room, not about anybody's number.
          waitingOn: [ball.batterId, ball.bowlerId].filter(
            (pid) => ball.picks[pid] === undefined,
          ),
        }
      : null,
    lastBall: state.lastBall,
    nextBallAt: state.nextBallAt,
    celebrateUntil: state.celebrateUntil,
    seq: state.seq,
    finished: state.finished,
    winnerTeam: state.winnerTeam,
    summary: state.summary,
  };
}

/** Someone who walked in mid-match. Same view, on nobody's side. */
export function getSpectatorView(state: HandCricketState): HandCricketView {
  return getPlayerView(state, '');
}

// ---------------------------------------------------------------- result

export function getResult(state: HandCricketState): RoundResult | null {
  // Finished is not the same as over: the room stays on the field while the
  // winners celebrate, and only a settled match hands back a scorecard.
  if (!state.finished || !state.settled) return null;

  const everyone = [...state.teams[0], ...state.teams[1]];
  const runsOf = (playerId: string): number =>
    state.innings.reduce(
      (sum, innings) =>
        sum + (innings.batters.find((b) => b.playerId === playerId)?.runs ?? 0),
      0,
    );

  // Winner takes all (REFERENCE.md section 6): the winning side splits the
  // points, and a tie pays nobody.
  const winners = state.winnerTeam === null ? [] : state.teams[state.winnerTeam];
  const points = winners.length > 0 ? Math.round(100 / winners.length) : 0;

  return {
    winnerId: winners[0] ?? '',
    scoreLabel: 'Runs',
    higherIsBetter: true,
    scores: everyone.map((playerId) => ({
      playerId,
      score: runsOf(playerId),
      points: winners.includes(playerId) ? points : 0,
    })),
  };
}

// ---------------------------------------------------------------- leaving

/**
 * Somebody walked out. Their side plays on a man short rather than the match
 * being abandoned, which is what a friend group actually wants.
 */
export function onPlayerLeft(input: HandCricketState, playerId: string): HandCricketState {
  const state = clone(input);
  const team = teamOf(state, playerId);
  if (team === null) return state;

  state.teams[team] = state.teams[team].filter((pid) => pid !== playerId);

  // Nobody left on a side: the other one takes it.
  if (state.teams[team].length === 0) {
    state.finished = true;
    state.phase = 'done';
    state.settled = true;
    state.celebrateUntil = null;
    state.winnerTeam = team === 0 ? 1 : 0;
    state.summary = `Team ${(team === 0 ? 1 : 0) + 1} win — the other side walked off.`;
    state.ball = null;
    return state;
  }

  if (state.phase === 'toss') {
    if (state.toss.callerId === playerId) {
      state.toss.callerId = state.teams[1][0] ?? state.teams[0][0] ?? '';
    }
    return state;
  }

  const innings = live(state);
  if (!innings) return state;

  // Retire them hurt, and bring in whoever is left if they were on strike.
  const seat = innings.batters.findIndex((b) => b.playerId === playerId);
  if (seat >= 0) {
    const batter = innings.batters[seat]!;
    if (!batter.out) {
      batter.out = true;
      batter.outTo = null;
      if (innings.striker === seat) {
        const next = innings.batters.findIndex((b) => b.yetToBat);
        if (next >= 0) {
          innings.batters[next]!.yetToBat = false;
          innings.striker = next;
        } else if (innings.nonStriker !== null) {
          innings.striker = innings.nonStriker;
          innings.nonStriker = null;
        }
      } else if (innings.nonStriker === seat) {
        innings.nonStriker = null;
      }
    }
  }

  innings.bowling = innings.bowling.filter((b) => b.playerId !== playerId);

  // A ball waiting on someone who has gone can never close on its own.
  if (state.ball && (state.ball.batterId === playerId || state.ball.bowlerId === playerId)) {
    state.ball = null;
    // Something has to put a ball back up, and only the clock can.
    state.nextBallAt = 0;
  }
  return state;
}
