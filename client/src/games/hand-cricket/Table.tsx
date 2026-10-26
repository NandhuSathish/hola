import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvent, HandCricketView, Outcome, Pick, PublicPlayer } from '@holla/shared';
import { BALLS_PER_OVER, DEFAULT_LOOK, NUMBERS } from '@holla/shared';
import { Head } from '../../components/Fighter';
import { usePrefersReducedMotion } from '../../lib/motion';
import { play as sound } from '../../lib/sound';
import { Scene } from './Scene';
import { Toss } from './Toss';
import { stampFor } from './stadium';
import { TEAM_COL } from './people';
import './Table.css';

export type TableProps = {
  view: HandCricketView;
  me: string;
  players: PublicPlayer[];
  send: (action: unknown) => void;
  events: GameEvent[];
  eventSeq: number;
};

/** Each number gets its own colour, as in the mock. */
const NUM_COL: Record<number, string> = {
  0: 'var(--paper-2)',
  1: 'var(--sky)',
  2: 'var(--mint)',
  3: 'var(--sun)',
  4: 'var(--pink)',
  6: 'var(--red)',
};

const overs = (balls: number): string =>
  `${Math.floor(balls / BALLS_PER_OVER)}.${balls % BALLS_PER_OVER}`;

export function HandCricketTable({ view, me, players, send }: TableProps) {
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const lookOf = (id: string) => players.find((p) => p.id === id)?.look ?? DEFAULT_LOOK;
  const teamOf = (id: string) => (view.teams[0].includes(id) ? 0 : 1);
  const reduced = usePrefersReducedMotion();

  /**
   * The score lags the server by one animation.
   *
   * The server resolves a ball the instant both numbers are in, but telling
   * it takes a few seconds — and a scoreboard that reads "Out!" while the
   * bowler is still running in gives the whole thing away. So the figures,
   * the over strip, the card and the commentary all come from `shown`, which
   * is the view as it was before the ball being replayed, and only catches up
   * when the ball has finished playing out.
   *
   * The picker and its clock deliberately do not lag: the next ball's window
   * is already open on the server, and holding it back would hand the slow
   * half of the room a shorter turn.
   */
  const [shown, setShown] = useState<HandCricketView>(view);
  const [replay, setReplay] = useState<{ outcome: Outcome; at: number; next: HandCricketView } | null>(
    null,
  );
  const playedSeq = useRef(view.seq);

  useEffect(() => {
    if (view.seq !== playedSeq.current && view.lastBall) {
      playedSeq.current = view.seq;
      setReplay({ outcome: view.lastBall.outcome, at: performance.now(), next: view });
      return;
    }
    // Anything that is not a ball — the toss, an innings change, someone
    // leaving — has nothing to animate, so it lands at once.
    if (!replay) setShown(view);
  }, [view, replay]);

  // Pinned when the party starts, so the jumping does not restart on every
  // re-render.
  const [celebrationStart, setCelebrationStart] = useState(() => performance.now());
  useEffect(() => {
    if (view.finished) setCelebrationStart(performance.now());
  }, [view.finished]);

  const endReplay = useCallback(() => {
    setReplay((current) => {
      if (current) setShown(current.next);
      return null;
    });
  }, []);

  const innings = shown.innings[shown.current];
  const batting = innings?.battingTeam ?? 0;

  const pick = useCallback(
    (value: Pick) => {
      if (!view.ball || !view.me.canPick) return;
      sound('tap');
      send({ type: 'pick', ballId: view.ball.id, value });
    },
    [send, view.ball, view.me.canPick],
  );

  if (view.phase === 'toss') {
    return <Toss view={view} me={me} nameOf={nameOf} lookOf={lookOf} send={send} />;
  }

  const striker = innings?.batters[innings.striker];
  // The bowler on the card is the one who bowled the ball being shown; the
  // one in the chip above the ground is whoever is bowling now.
  const bowlerId = shown.ball?.bowlerId ?? shown.lastBall?.bowlerId ?? view.ball?.bowlerId ?? '';
  // Between balls there is no live ball to name, so the chip keeps showing
  // whoever just bowled rather than going blank.
  const liveBowlerId = view.ball?.bowlerId ?? view.lastBall?.bowlerId ?? bowlerId;
  const figures = innings?.bowling.find((b) => b.playerId === bowlerId);
  const need = shown.target !== null && innings ? shown.target - innings.runs : null;

  /*
   * The winners only come out once the ball that won it has been told. The
   * server holds the scorecard back for exactly that long plus the
   * celebration, so the room stays on the table rather than cutting away.
   */
  const won = view.finished && !replay;
  const winners =
    won && view.winnerTeam !== null
      ? {
          looks: view.teams[view.winnerTeam].map(lookOf),
          team: view.winnerTeam,
          since: celebrationStart,
        }
      : null;

  return (
    <div className="hc-screen">
      <div className="sticker hc-scorebar">
        <div className="hc-batting">
          <span className="hc-tdot" style={{ ['--tc' as string]: TEAM_COL[batting] }} />
          <b>Team {batting + 1}</b>
        </div>
        <div className="hc-score">
          {innings?.runs ?? 0}/{innings?.wickets ?? 0}
          <small>{overs(innings?.balls ?? 0)} ov</small>
        </div>
        {need !== null && need > 0 && <div className="hc-need">Need {need}</div>}
        {need !== null && need <= 0 && <div className="hc-need done">Done it</div>}
        <OverDots outcomes={innings?.over ?? []} />
      </div>

      <Scene
        view={view}
        lookOf={lookOf}
        replay={replay}
        reduced={reduced}
        onReplayDone={endReplay}
        stamp={replay ? stampFor(replay.outcome) : null}
        batterId={replay?.next.lastBall?.batterId ?? view.ball?.batterId ?? striker?.playerId ?? ''}
        bowlerId={replay?.next.lastBall?.bowlerId ?? liveBowlerId}
        batName={nameOf(view.ball?.batterId ?? striker?.playerId ?? '')}
        bowlName={nameOf(liveBowlerId)}
        batTile={tileFor(view, 'bat', replay !== null)}
        bowlTile={tileFor(view, 'bowl', replay !== null)}
        winners={winners}
      />

      <div className="hc-grid">
        <aside className="hc-left">
          <div className="sticker hc-panel">
            <h3>Batting</h3>
            <ul className="hc-card">
              {innings?.batters.map((b, i) => (
                <li key={b.playerId} data-player={b.playerId} className={b.out ? 'out' : ''}>
                  <span className="hc-av">
                    <Head look={lookOf(b.playerId)} seat={teamOf(b.playerId)} size={26} />
                  </span>
                  <span className="hc-nm">
                    {nameOf(b.playerId)}
                    {i === innings.striker && !b.out && <em>*</em>}
                    {b.out && b.outTo && <small>b {nameOf(b.outTo)}</small>}
                    {b.yetToBat && <small>yet to bat</small>}
                  </span>
                  <span className="hc-rb">
                    {b.runs}
                    <small>({b.balls})</small>
                  </span>
                </li>
              ))}
            </ul>

            <h3>Bowling</h3>
            <ul className="hc-card">
              {innings?.bowling
                .filter((b) => b.balls > 0 || b.playerId === bowlerId)
                .map((b) => (
                  <li key={b.playerId} className={b.playerId === bowlerId ? 'now' : ''}>
                    <span className="hc-av">
                      <Head look={lookOf(b.playerId)} seat={teamOf(b.playerId)} size={26} />
                    </span>
                    <span className="hc-nm">{nameOf(b.playerId)}</span>
                    <span className="hc-rb">
                      {b.wickets}/{b.runs}
                      <small>({overs(b.balls)})</small>
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        </aside>

        <div className="hc-centre">
          {won ? (
            <div className="sticker hc-wincard">
              <h2>
                {view.winnerTeam === null
                  ? 'A tie!'
                  : `Team ${view.winnerTeam + 1} win`}
              </h2>
              <p>{view.summary}</p>
              <p className="hc-wincard-note">The scorecard is coming…</p>
            </div>
          ) : (
          <div className="sticker hc-picker">
            <div className="hc-picker-head">
              <div>
                <h2>
                  {!view.ball && view.nextBallAt !== null && !view.finished
                    ? 'Get ready…'
                    : view.me.role === 'bat'
                      ? 'Pick your shot'
                      : view.me.role === 'bowl'
                        ? 'Pick your ball'
                        : 'Watching'}
                </h2>
                <p>
                  {!view.ball && view.nextBallAt !== null && !view.finished
                    ? 'Hands behind your back. The next ball is coming.'
                    : view.me.role === 'bat'
                      ? `Throw a different number from ${nameOf(liveBowlerId)} to score it. Same number and you are out.`
                      : view.me.role === 'bowl'
                        ? `Match ${nameOf(view.ball?.batterId ?? '')} to take the wicket.`
                        : `${nameOf(view.ball?.batterId ?? '')} and ${nameOf(liveBowlerId)} are picking.`}
                </p>
              </div>
              {view.ball ? (
                <BallClock endsAt={view.ball.endsAt} startedAt={view.ball.startedAt} />
              ) : view.nextBallAt !== null && !view.finished ? (
                <NextBall at={view.nextBallAt} />
              ) : null}
            </div>

            <div className="hc-nums">
              {NUMBERS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="hc-num"
                  style={{ ['--c' as string]: NUM_COL[n] }}
                  aria-pressed={view.me.myPick === n}
                  aria-label={`Throw ${n}`}
                  disabled={!view.me.canPick}
                  onClick={() => pick(n)}
                >
                  {n}
                </button>
              ))}
            </div>

            <p className="hc-status" aria-live="polite">
              {statusFor(view, nameOf)}
            </p>
          </div>
          )}
        </div>

        <aside className="hc-right">
          <div className="sticker hc-panel">
            <h3>
              This over <small>{figures ? `${nameOf(bowlerId)} bowling` : ''}</small>
            </h3>
            {figures && (
              <div className="hc-bowler-now">
                <Head look={lookOf(bowlerId)} seat={teamOf(bowlerId)} size={34} />
                <div>
                  <b>{nameOf(bowlerId)}</b>
                  <small>
                    {overs(figures.balls)} overs, {figures.runs} run
                    {figures.runs === 1 ? '' : 's'}, {figures.wickets} wicket
                    {figures.wickets === 1 ? '' : 's'}
                  </small>
                </div>
              </div>
            )}
            <div className="hc-bigdots">
              {(innings?.over ?? []).map((o, i) => (
                <span key={i} className={`hc-bd ${dotClass(o)}`}>
                  {o === 'W' ? 'W' : o}
                </span>
              ))}
              {(innings?.over.length ?? 0) === 0 && <span className="hc-none">New over</span>}
            </div>
            {(innings?.lastOver.length ?? 0) > 0 && (
              <p className="hc-lastover">
                Last over: {innings!.lastOver.map((o) => (o === 'W' ? 'W' : o)).join(' · ')}
              </p>
            )}

            <h3>Commentary</h3>
            <ul className="hc-comm">
              {(innings?.commentary ?? []).slice(0, 10).map((c, i) => (
                <li key={`${c.over}-${i}`}>
                  <b>{c.over}</b>
                  {c.text}
                </li>
              ))}
              {(innings?.commentary.length ?? 0) === 0 && <li>No balls bowled yet.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** The two tiles over the scene: your own number, and a `?` for theirs. */
function tileFor(view: HandCricketView, side: 'bat' | 'bowl', revealing: boolean): string {
  if (revealing && view.lastBall) {
    return String(side === 'bat' ? view.lastBall.bat : view.lastBall.bowl);
  }
  const mine = view.me.role === side;
  if (mine && view.me.myPick !== null) return String(view.me.myPick);
  const waiting = view.ball?.waitingOn ?? [];
  const who = side === 'bat' ? view.ball?.batterId : view.ball?.bowlerId;
  // Locked in but not yours to see — the mock shows a filled tile, not a number.
  if (who && !waiting.includes(who)) return 'in';
  return '?';
}

function statusFor(view: HandCricketView, nameOf: (id: string) => string): string {
  if (view.finished) return view.summary ?? 'Match over.';
  if (!view.ball) {
    return view.nextBallAt !== null ? 'The next ball is on its way.' : 'Waiting…';
  }
  const waiting = view.ball.waitingOn;
  if (view.me.canPick) return 'Throw a number before the clock runs out.';
  if (view.me.myPick !== null && waiting.length > 0) {
    return `Locked in. Waiting for ${waiting.map(nameOf).join(' and ')}…`;
  }
  if (waiting.length === 0) return 'Here it comes…';
  return `Waiting for ${waiting.map(nameOf).join(' and ')}…`;
}

const dotClass = (o: Outcome): string =>
  o === 'W' ? 'w' : o === 0 ? 'dot' : o === 4 ? 'four' : o === 6 ? 'six' : 'run';

function OverDots({ outcomes }: { outcomes: Outcome[] }) {
  return (
    <div className="hc-overdots">
      <span className="hc-lbl">This over</span>
      {outcomes.length === 0 && <span className="hc-none">—</span>}
      {outcomes.map((o, i) => (
        <span key={i} className={`hc-bd ${dotClass(o)}`}>
          {o === 'W' ? 'W' : o}
        </span>
      ))}
    </div>
  );
}

/**
 * The beat between balls. The server will not open the next window until the
 * last one has been told, so this is a real wait — showing it counting down
 * is the difference between a pause and a frozen screen.
 */
function NextBall({ at }: { at: number }) {
  const [left, setLeft] = useState(() => Math.max(0, at - Date.now()));
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, at - Date.now()));
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [at]);

  return (
    <div className="hc-nextball" role="status">
      <small>Next ball</small>
      <b>{Math.ceil(left / 1000)}</b>
    </div>
  );
}

/** The ring that drains while the two of them are picking. */
function BallClock({ startedAt, endsAt }: { startedAt: number; endsAt: number }) {
  const [left, setLeft] = useState(1);
  useEffect(() => {
    const total = Math.max(1, endsAt - startedAt);
    const tick = () => setLeft(Math.max(0, Math.min(1, (endsAt - Date.now()) / total)));
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [startedAt, endsAt]);

  const circumference = 2 * Math.PI * 22;
  const seconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));

  return (
    <div className="hc-timer">
      <svg viewBox="0 0 54 54" aria-hidden="true">
        <circle className="bg" cx="27" cy="27" r="22" />
        <circle
          className="fg"
          cx="27"
          cy="27"
          r="22"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - left)}
        />
      </svg>
      <b>{seconds}</b>
    </div>
  );
}
