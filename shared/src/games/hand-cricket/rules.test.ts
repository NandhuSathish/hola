import { describe, expect, it } from 'vitest';
import { handCricket } from './index.js';
import { HAND_CRICKET_DEFAULTS, type HandCricketSettings } from './settings.js';
import { CELEBRATION_MS } from './rules.js';
import {
  getPlayerView,
  onAction,
  onPlayerLeft,
  onTick,
  setup,
  splitTeams,
  wicketsAvailable,
} from './rules.js';
import type { HandCricketAction, HandCricketState, Pick } from './types.js';
import type { PlayerRef } from '../types.js';

// ---------------------------------------------------------------- harness

const players = (n: number): PlayerRef[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    look: { style: i % 8, skin: 1, hair: i % 6 },
  }));

/** A deterministic rng, so a seed replays a match exactly (rule 3). */
const seeded = (seed = 1) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

/** Hands back the given numbers in order, then zeroes. */
const rngSeq = (...values: number[]) => {
  let i = 0;
  return () => values[i++] ?? 0;
};

const ctx = (now = 0, rng = seeded()) => ({ now, rng });

const ok = (res: ReturnType<typeof onAction>): HandCricketState => {
  if (!res.ok) throw new Error(`expected ok, got: ${res.error}`);
  return res.state;
};
const err = (res: ReturnType<typeof onAction>): string => {
  if (res.ok) throw new Error('expected a refusal');
  return res.error;
};

const act = (
  state: HandCricketState,
  playerId: string,
  action: HandCricketAction,
  now = 0,
  rng = seeded(),
) => onAction(state, playerId, action, { now, rng });

/** Past the toss and into the first over, with `first` batting. */
function playing(
  count = 4,
  first: 0 | 1 = 0,
  settings: Partial<HandCricketSettings> = {},
): HandCricketState {
  const merged = { ...HAND_CRICKET_DEFAULTS, ...settings };
  let state = setup(players(count), merged, ctx());
  // 'heads' with an rng under 0.5 lands heads, so the caller (team 2) wins.
  state = ok(act(state, state.toss.callerId, { type: 'call', side: 'heads' }, 0, rngSeq(0.1)));
  const winner = state.toss.winner!;
  const captain = state.teams[winner][0]!;
  const wantsToBat = winner === first;
  return ok(act(state, captain, { type: 'choose', bat: wantsToBat }));
}

/**
 * Bowl one ball with both numbers given, then skip the gap the server leaves
 * for the client to tell it. Tests do not watch animations.
 */
function bowl(state: HandCricketState, bat: Pick, bowlNum: Pick, now = 0): HandCricketState {
  const ball = state.ball!;
  let next = ok(act(state, ball.batterId, { type: 'pick', ballId: ball.id, value: bat }, now));
  // one-a-side resolves on the single pick, so only ask for the second if the
  // same ball is still open
  if (next.ball && next.ball.id === ball.id) {
    next = ok(act(next, ball.bowlerId, { type: 'pick', ballId: ball.id, value: bowlNum }, now));
  }
  return skipGap(next);
}

/** Wind the clock past the celebration so the scorecard is handed back. */
function settle(state: HandCricketState): HandCricketState {
  if (!state.finished || state.settled || state.celebrateUntil === null) return state;
  const ticked = onTick(state, ctx(state.celebrateUntil, seeded()));
  return ticked ? ticked.state : state;
}

/** Wind the clock past the between-balls gap and put the next ball live. */
function skipGap(state: HandCricketState): HandCricketState {
  if (state.ball || state.finished || state.nextBallAt === null) return state;
  const ticked = onTick(state, ctx(state.nextBallAt, seeded()));
  return ticked ? ticked.state : state;
}

// ---------------------------------------------------------------- teams

describe('teams', () => {
  it('alternates down the seat order so friends are split up', () => {
    expect(splitTeams(['a', 'b', 'c', 'd', 'e'])).toEqual([
      ['a', 'c', 'e'],
      ['b', 'd'],
    ]);
  });

  it('gives every batter a wicket of their own', () => {
    expect(wicketsAvailable(1)).toBe(1);
    expect(wicketsAvailable(2)).toBe(2);
    expect(wicketsAvailable(4)).toBe(4);
  });

  it('seats everyone in the room', () => {
    const state = setup(players(7), HAND_CRICKET_DEFAULTS, ctx());
    expect([...state.teams[0], ...state.teams[1]].sort()).toEqual(
      players(7).map((p) => p.id).sort(),
    );
  });
});

// ---------------------------------------------------------------- the toss

describe('the toss', () => {
  it('lets only the nominated caller call it', () => {
    const state = setup(players(4), HAND_CRICKET_DEFAULTS, ctx());
    const other = state.teams[0][0]!;
    expect(err(act(state, other, { type: 'call', side: 'heads' }))).toBe(
      'That call is not yours to make.',
    );
    expect(act(state, state.toss.callerId, { type: 'call', side: 'heads' }).ok).toBe(true);
  });

  it('gives the call to the caller when the coin matches', () => {
    const state = setup(players(4), HAND_CRICKET_DEFAULTS, ctx());
    const heads = ok(
      act(state, state.toss.callerId, { type: 'call', side: 'heads' }, 0, rngSeq(0.1)),
    );
    expect(heads.toss.landed).toBe('heads');
    expect(heads.toss.winner).toBe(1);

    const tails = ok(
      act(state, state.toss.callerId, { type: 'call', side: 'heads' }, 0, rngSeq(0.9)),
    );
    expect(tails.toss.landed).toBe('tails');
    expect(tails.toss.winner).toBe(0);
  });

  it('only lets the winning captain choose, and only once', () => {
    let state = setup(players(4), HAND_CRICKET_DEFAULTS, ctx());
    state = ok(act(state, state.toss.callerId, { type: 'call', side: 'heads' }, 0, rngSeq(0.1)));
    const captain = state.teams[state.toss.winner!][0]!;
    const notCaptain = state.teams[state.toss.winner === 0 ? 1 : 0][0]!;

    expect(err(act(state, notCaptain, { type: 'choose', bat: true }))).toBe(
      'Only the winner of the toss decides.',
    );
    const after = ok(act(state, captain, { type: 'choose', bat: true }));
    expect(after.phase).toBe('play');
    expect(err(act(after, captain, { type: 'choose', bat: false }))).toBe(
      'The toss has been done.',
    );
  });

  it('starts the innings with the side that chose to bat', () => {
    const state = playing(4, 0);
    expect(state.innings[0]!.battingTeam).toBe(0);
    expect(playing(4, 1).innings[0]!.battingTeam).toBe(1);
  });

  it('opens a ball as soon as the toss is settled', () => {
    const state = playing();
    expect(state.ball).not.toBeNull();
    expect(state.ball!.batterId).toBe(state.teams[0][0]);
    expect(state.ball!.bowlerId).toBe(state.teams[1][0]);
  });
});

// ---------------------------------------------------------------- a ball

describe('a ball', () => {
  it('scores the batter their number when the two differ', () => {
    const state = bowl(playing(), 4, 2);
    const innings = state.innings[0]!;
    expect(innings.runs).toBe(4);
    expect(innings.wickets).toBe(0);
    expect(innings.balls).toBe(1);
    expect(innings.batters[0]!.runs).toBe(4);
    expect(state.lastBall?.outcome).toBe(4);
  });

  it('takes the wicket when both throw the same number', () => {
    const state = bowl(playing(), 3, 3);
    const innings = state.innings[0]!;
    expect(innings.wickets).toBe(1);
    expect(innings.runs).toBe(0);
    expect(innings.batters[0]!.out).toBe(true);
    expect(innings.batters[0]!.outTo).toBe(state.teams[1][0]);
    expect(state.lastBall?.outcome).toBe('W');
  });

  it('credits the bowler with the runs and the wicket', () => {
    let state = bowl(playing(), 6, 1);
    state = bowl(state, 2, 2);
    const figures = state.innings[0]!.bowling[0]!;
    expect(figures.balls).toBe(2);
    expect(figures.runs).toBe(6);
    expect(figures.wickets).toBe(1);
  });

  it('waits for both before it resolves anything', () => {
    const start = playing();
    const ball = start.ball!;
    const half = ok(act(start, ball.batterId, { type: 'pick', ballId: ball.id, value: 4 }));
    expect(half.ball).not.toBeNull();
    expect(half.innings[0]!.balls).toBe(0);
    expect(half.seq).toBe(0);
  });

  it('refuses a second throw, a stale ball, a junk number and a bystander', () => {
    const state = playing();
    const ball = state.ball!;
    const after = ok(act(state, ball.batterId, { type: 'pick', ballId: ball.id, value: 1 }));

    expect(err(act(after, ball.batterId, { type: 'pick', ballId: ball.id, value: 2 }))).toBe(
      'You have thrown already.',
    );
    expect(err(act(state, ball.batterId, { type: 'pick', ballId: 'nope', value: 1 }))).toBe(
      'That ball has gone.',
    );
    expect(
      err(act(state, ball.batterId, { type: 'pick', ballId: ball.id, value: 5 as Pick })),
    ).toBe('Pick one of the six.');

    const bystander = state.teams[0][1]!;
    expect(err(act(state, bystander, { type: 'pick', ballId: ball.id, value: 1 }))).toBe(
      'This ball is not yours to throw.',
    );
  });

  it('leaves a gap before the next ball, so the clock does not run under the telling', () => {
    const start = playing();
    const ball = start.ball!;
    let state = ok(act(start, ball.batterId, { type: 'pick', ballId: ball.id, value: 2 }));
    state = ok(act(state, ball.bowlerId, { type: 'pick', ballId: ball.id, value: 1 }));

    expect(state.ball).toBeNull();
    expect(state.nextBallAt).toBeGreaterThan(0);
    expect(state.seq).toBe(1);

    // nothing happens until the gap is up
    expect(onTick(state, ctx(state.nextBallAt! - 1))).toBeNull();

    const live = onTick(state, ctx(state.nextBallAt!))!;
    expect(live.state.ball).not.toBeNull();
    expect(live.state.nextBallAt).toBeNull();
    // and the fresh window gets its full length
    expect(live.state.ball!.endsAt - live.state.ball!.startedAt).toBe(
      HAND_CRICKET_DEFAULTS.pickSeconds * 1000,
    );
  });

  it('gives the side coming in time to settle at the innings change', () => {
    let state = playing(4, 0, { overs: 1 });
    for (let i = 0; i < 5; i++) state = bowl(state, 2, 4);
    const ball = state.ball!;
    state = ok(act(state, ball.batterId, { type: 'pick', ballId: ball.id, value: 2 }));
    state = ok(act(state, ball.bowlerId, { type: 'pick', ballId: ball.id, value: 4 }));

    expect(state.innings).toHaveLength(2);
    expect(state.ball).toBeNull();
    expect(state.nextBallAt).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------- rotation

describe('the strike and the bowler', () => {
  it('crosses the batters on odd runs', () => {
    const start = playing(4);
    const first = start.innings[0]!.striker;
    const state = bowl(start, 3, 1);
    expect(state.innings[0]!.striker).not.toBe(first);
    expect(state.lastBall?.strikeSwapped).toBe(true);
  });

  it('leaves them where they are on even runs', () => {
    const start = playing(4);
    const first = start.innings[0]!.striker;
    const state = bowl(start, 4, 1);
    expect(state.innings[0]!.striker).toBe(first);
    expect(state.lastBall?.strikeSwapped).toBe(false);
  });

  it('never crosses them when the rule is off', () => {
    const start = playing(4, 0, { rotateOnOdds: false });
    const first = start.innings[0]!.striker;
    expect(bowl(start, 1, 2).innings[0]!.striker).toBe(first);
  });

  it('changes the bowler at the end of every over', () => {
    let state = playing(4);
    const opener = state.ball!.bowlerId;
    for (let i = 0; i < 6; i++) state = bowl(state, 2, 4);
    expect(state.innings[0]!.balls).toBe(6);
    expect(state.lastBall?.overComplete).toBe(true);
    expect(state.ball!.bowlerId).not.toBe(opener);
    expect(state.ball!.bowlerId).toBe(state.teams[1][1]);
  });

  it('turns the strike over with the ends at the end of an over', () => {
    let state = playing(4);
    // six even balls, so only the over change can move the strike
    for (let i = 0; i < 5; i++) state = bowl(state, 2, 4);
    const before = state.innings[0]!.striker;
    state = bowl(state, 2, 4);
    expect(state.innings[0]!.striker).not.toBe(before);
  });

  it('comes back round to the first bowler once the side has all bowled', () => {
    // Three bowlers and four overs, so the rotation has to wrap while the
    // innings is still live.
    let state = playing(6, 0, { overs: 4 });
    const bowlers = state.teams[1];
    expect(bowlers).toHaveLength(3);
    for (let over = 0; over < bowlers.length; over++) {
      for (let i = 0; i < 6; i++) state = bowl(state, 2, 4);
    }
    expect(state.innings).toHaveLength(1);
    expect(state.ball!.bowlerId).toBe(bowlers[0]);
  });

  it('brings in the next batter on a wicket', () => {
    const state = bowl(playing(6), 3, 3);
    const innings = state.innings[0]!;
    // p0 and p2 opened; p4 walks in
    expect(innings.batters[2]!.yetToBat).toBe(false);
    expect(innings.striker).toBe(2);
    expect(state.lastBall?.newBatterId).toBe(state.teams[0][2]);
  });
});

// ---------------------------------------------------------------- the clock

describe('the pick window', () => {
  it('stays open until the deadline', () => {
    const state = playing();
    expect(onTick(state, ctx(state.ball!.endsAt - 1))).toBeNull();
  });

  it('throws for whoever did not, and says so', () => {
    const state = playing();
    const ticked = onTick(state, ctx(state.ball!.endsAt, rngSeq(0.9, 0.1)));
    expect(ticked).not.toBeNull();
    expect(ticked!.state.innings[0]!.balls).toBe(1);
    expect(ticked!.state.lastBall?.autoBat).toBe(true);
    expect(ticked!.state.lastBall?.autoBowl).toBe(true);
    expect(ticked!.events.some((e) => e.kind === 'timeout')).toBe(true);
  });

  it('keeps the number someone did throw', () => {
    const start = playing();
    const ball = start.ball!;
    const half = ok(act(start, ball.batterId, { type: 'pick', ballId: ball.id, value: 6 }));
    const ticked = onTick(half, ctx(ball.endsAt, rngSeq(0.1)));
    expect(ticked!.state.lastBall?.bat).toBe(6);
    expect(ticked!.state.lastBall?.autoBat).toBe(false);
    expect(ticked!.state.lastBall?.autoBowl).toBe(true);
  });

  it('keeps the winners on the field, then lets the scorecard through', () => {
    let state = playing(2, 0, { overs: 1 });
    for (let i = 0; i < 24 && !state.finished; i++) state = bowl(state, 2, 4);
    expect(state.finished).toBe(true);
    expect(state.settled).toBe(false);
    expect(state.celebrateUntil).toBeGreaterThan(0);

    // the room stays on the table while they celebrate
    expect(handCricket.getResult(state)).toBeNull();
    expect(onTick(state, ctx(state.celebrateUntil! - 1))).toBeNull();

    const over = onTick(state, ctx(state.celebrateUntil!))!;
    expect(over.state.settled).toBe(true);
    expect(handCricket.getResult(over.state)).not.toBeNull();

    // and nothing happens after that
    expect(onTick(over.state, ctx(1e12))).toBeNull();
  });

  it('leaves time for the ball that won it, not just the party', () => {
    let state = playing(2, 0, { overs: 1 });
    for (let i = 0; i < 24 && !state.finished; i++) state = bowl(state, 2, 4);
    const lastBallAt = state.celebrateUntil! - CELEBRATION_MS;
    // the telling of the final ball sits in front of the ten seconds
    expect(lastBallAt).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------- innings

describe('the innings and the chase', () => {
  it('ends on the last ball of the last over and sets a target', () => {
    let state = playing(4, 0, { overs: 1 });
    for (let i = 0; i < 6; i++) state = bowl(state, 2, 4);
    expect(state.innings).toHaveLength(2);
    expect(state.innings[0]!.done).toBe(true);
    expect(state.target).toBe(13);
    expect(state.innings[1]!.battingTeam).toBe(1);
  });

  it('ends when the side is all out', () => {
    let state = playing(4, 0, { overs: 6 });
    // two a side, so it takes two wickets
    state = bowl(state, 3, 3);
    expect(state.innings).toHaveLength(1);
    state = bowl(state, 4, 1); // the survivor carries on
    state = bowl(state, 2, 2);
    expect(state.innings).toHaveLength(2);
    expect(state.target).toBe(5);
  });

  it('leaves the last batter in alone when nobody is left to walk in', () => {
    let state = playing(4, 0, { overs: 6 });
    const opener = state.innings[0]!.batters[state.innings[0]!.striker]!.playerId;
    state = bowl(state, 3, 3);

    const innings = state.innings[0]!;
    expect(innings.wickets).toBe(1);
    // the one at the other end takes strike, and there is no other end now
    expect(innings.nonStriker).toBeNull();
    expect(innings.batters[innings.striker]!.playerId).not.toBe(opener);
    expect(innings.batters[innings.striker]!.out).toBe(false);
    expect(state.lastBall?.newBatterId).toBeNull();
  });

  it('stops the chase the moment the target is passed', () => {
    let state = playing(4, 0, { overs: 1 });
    for (let i = 0; i < 6; i++) state = bowl(state, 1, 2); // 6 runs, target 7
    expect(state.target).toBe(7);
    for (let i = 0; i < 6 && !state.finished; i++) state = bowl(state, 6, 1);
    expect(state.finished).toBe(true);
    expect(state.winnerTeam).toBe(1);
    expect(state.innings[1]!.runs).toBeGreaterThanOrEqual(7);
    expect(state.summary).toContain('win by');
  });

  it('gives it to the side that set the target when the chase falls short', () => {
    let state = playing(4, 0, { overs: 1 });
    for (let i = 0; i < 6; i++) state = bowl(state, 6, 1); // 36, target 37
    for (let i = 0; i < 6; i++) state = bowl(state, 0, 1); // 0
    expect(state.finished).toBe(true);
    expect(state.winnerTeam).toBe(0);
    expect(state.summary).toContain('36 runs');
  });

  it('calls it a tie when the scores finish level', () => {
    let state = playing(4, 0, { overs: 1 });
    for (let i = 0; i < 6; i++) state = bowl(state, 2, 4); // 12, target 13
    for (let i = 0; i < 6; i++) state = bowl(state, 2, 4); // 12
    expect(state.finished).toBe(true);
    expect(state.winnerTeam).toBeNull();
    expect(state.summary).toContain('tie');
  });

  it('keeps an over strip and ball-by-ball commentary', () => {
    let state = playing(4, 0, { overs: 2 });
    state = bowl(state, 6, 1);
    state = bowl(state, 3, 3);
    const innings = state.innings[0]!;
    expect(innings.over).toEqual([6, 'W']);
    expect(innings.commentary[0]!.text).toContain('Out!');
    expect(innings.commentary[0]!.over).toBe('0.2');
    expect(innings.commentary[1]!.text).toContain('Six!');
  });
});

// ---------------------------------------------------------------- rule 2

describe('what each player is allowed to see', () => {
  it('never shows one player the other one’s number while the ball is open', () => {
    const start = playing();
    const ball = start.ball!;
    const state = ok(act(start, ball.batterId, { type: 'pick', ballId: ball.id, value: 6 }));

    const bowlerSees = getPlayerView(state, ball.bowlerId);
    expect(bowlerSees.me.myPick).toBeNull();
    expect(JSON.stringify(bowlerSees)).not.toContain('"myPick":6');
    // and nothing anywhere in the payload carries the batter's number
    expect(JSON.stringify(bowlerSees.ball)).not.toContain('6');

    const batterSees = getPlayerView(state, ball.batterId);
    expect(batterSees.me.myPick).toBe(6);
  });

  it('says who it is still waiting on without saying what they threw', () => {
    const start = playing();
    const ball = start.ball!;
    const state = ok(act(start, ball.batterId, { type: 'pick', ballId: ball.id, value: 4 }));
    const view = getPlayerView(state, ball.bowlerId);
    expect(view.ball!.waitingOn).toEqual([ball.bowlerId]);
  });

  it('shows both numbers once the ball has closed', () => {
    const state = bowl(playing(), 6, 2);
    const view = getPlayerView(state, state.teams[1][0]!);
    expect(view.lastBall?.bat).toBe(6);
    expect(view.lastBall?.bowl).toBe(2);
  });

  it('tells each player what they are doing on this ball', () => {
    const state = playing(4);
    const ball = state.ball!;
    expect(getPlayerView(state, ball.batterId).me.role).toBe('bat');
    expect(getPlayerView(state, ball.bowlerId).me.role).toBe('bowl');
    expect(getPlayerView(state, state.teams[0][1]!).me.role).toBe('watch');
    expect(getPlayerView(state, ball.batterId).me.canPick).toBe(true);
    expect(getPlayerView(state, state.teams[0][1]!).me.canPick).toBe(false);
  });

  it('gives someone who walked in mid-match no side and no pick', () => {
    const state = playing();
    const view = handCricket.getSpectatorView(state);
    expect(view.me.team).toBeNull();
    expect(view.me.canPick).toBe(false);
    expect(view.me.myPick).toBeNull();
  });
});

// ---------------------------------------------------------------- leaving

describe('leaving mid-match', () => {
  it('retires a batter who walks out and brings in the next', () => {
    const state = onPlayerLeft(playing(6), 'p0');
    const innings = state.innings[0]!;
    expect(innings.batters[0]!.out).toBe(true);
    expect(innings.striker).not.toBe(0);
    expect(state.teams[0]).not.toContain('p0');
  });

  it('drops a ball that was waiting on someone who has gone', () => {
    const start = playing();
    expect(start.ball).not.toBeNull();
    expect(onPlayerLeft(start, start.ball!.bowlerId).ball).toBeNull();
  });

  it('awards it to the other side when a whole team walks off', () => {
    const state = onPlayerLeft(playing(2), 'p1');
    expect(state.finished).toBe(true);
    expect(state.winnerTeam).toBe(0);
    expect(state.summary).toContain('walked off');
  });

  it('hands the call on when the caller leaves before the toss', () => {
    const start = setup(players(4), HAND_CRICKET_DEFAULTS, ctx());
    const state = onPlayerLeft(start, start.toss.callerId);
    expect(state.toss.callerId).not.toBe(start.toss.callerId);
    expect(state.toss.callerId).not.toBe('');
  });
});

// ---------------------------------------------------------------- result

describe('the result', () => {
  it('stays null until the match is done', () => {
    expect(handCricket.getResult(playing())).toBeNull();
  });

  it('pays the winning side and nobody else', () => {
    let state = playing(4, 0, { overs: 1 });
    for (let i = 0; i < 6; i++) state = bowl(state, 6, 1);
    for (let i = 0; i < 6; i++) state = bowl(state, 0, 1);
    state = settle(state);
    const result = handCricket.getResult(state)!;

    expect(result.winnerId).toBe(state.teams[0][0]);
    const paid = result.scores.filter((s) => s.points > 0).map((s) => s.playerId);
    expect(paid.sort()).toEqual([...state.teams[0]].sort());
    expect(result.scores).toHaveLength(4);
  });

  it('says the column is runs, and that more of them is better', () => {
    let state = playing(4, 0, { overs: 1 });
    for (let i = 0; i < 6; i++) state = bowl(state, 6, 1);
    for (let i = 0; i < 6; i++) state = bowl(state, 0, 1);
    const result = handCricket.getResult(settle(state))!;
    // The results table is shared with games where a small number is the
    // good one, so it has to be told which way this one reads.
    expect(result.scoreLabel).toBe('Runs');
    expect(result.higherIsBetter).toBe(true);
  });

  it('pays nobody on a tie', () => {
    let state = playing(4, 0, { overs: 1 });
    for (let i = 0; i < 6; i++) state = bowl(state, 2, 4);
    for (let i = 0; i < 6; i++) state = bowl(state, 2, 4);
    const result = handCricket.getResult(settle(state))!;
    expect(result.scores.every((s) => s.points === 0)).toBe(true);
  });

  it('reports each player’s runs across the match', () => {
    let state = playing(4, 0, { overs: 1 });
    for (let i = 0; i < 6; i++) state = bowl(state, 2, 4);
    for (let i = 0; i < 6; i++) state = bowl(state, 0, 1);
    const result = handCricket.getResult(settle(state))!;
    const total = result.scores.reduce((sum, s) => sum + s.score, 0);
    expect(total).toBe(12);
  });
});

// ---------------------------------------------------------------- purity

describe('the engine is pure', () => {
  it('never mutates the state it was handed', () => {
    const before = playing();
    const snapshot = JSON.stringify(before);
    bowl(before, 4, 2);
    onTick(before, ctx(before.ball!.endsAt));
    onPlayerLeft(before, 'p0');
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('replays the same match from the same seed', () => {
    const run = () => {
      let state = setup(players(4), { ...HAND_CRICKET_DEFAULTS, overs: 1 }, ctx(0, seeded(7)));
      state = ok(act(state, state.toss.callerId, { type: 'call', side: 'heads' }, 0, seeded(7)));
      const captain = state.teams[state.toss.winner!][0]!;
      state = ok(act(state, captain, { type: 'choose', bat: true }, 0, seeded(7)));
      for (let i = 0; i < 60 && !state.finished; i++) {
        const at = state.ball ? state.ball.endsAt : state.nextBallAt;
        if (at === null) break;
        const ticked = onTick(state, { now: at, rng: seeded(i + 7) });
        if (!ticked) break;
        state = ticked.state;
      }
      return state;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it('refuses junk actions rather than throwing', () => {
    const state = playing();
    for (const bad of [null, undefined, 0, 'pick', { type: 'nope' }]) {
      const res = onAction(state, 'p0', bad as never, ctx());
      expect(res.ok).toBe(false);
    }
  });
});
