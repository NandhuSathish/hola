import { useEffect, useState } from 'react';
import type { HandCricketView, Look } from '@holla/shared';
import { useCanvas } from '../../lib/canvas';
import { TEAM_COL, armTo, drawBody, shoulders } from './people';

type Props = {
  view: HandCricketView;
  me: string;
  nameOf: (id: string) => string;
  lookOf: (playerId: string) => Look;
  send: (action: unknown) => void;
};

/** How long the coin is in the air. Matches the mock's keyframes. */
const FLIP_MS = 1550;

/**
 * The toss, from the mock: two captains either side, a coin that goes up and
 * comes down on a face, and only then the news.
 *
 * The server decided the moment it was called — the flip is the telling of
 * it, which is why the result is held back until the coin has landed.
 */
export function Toss({ view, me, nameOf, lookOf, send }: Props) {
  const { toss } = view;
  const landed = toss.landed;
  const winner = toss.winner;
  const captain = winner !== null ? view.teams[winner][0] : null;

  // Held until the coin stops, so nobody reads the result off the page while
  // it is still spinning.
  const [settled, setSettled] = useState(landed !== null);
  useEffect(() => {
    if (landed === null) {
      setSettled(false);
      return;
    }
    const timer = window.setTimeout(() => setSettled(true), FLIP_MS);
    return () => window.clearTimeout(timer);
  }, [landed]);

  // 1800 degrees either way, plus a half turn to come down on tails.
  const spin = 1800 + (landed === 'tails' ? 180 : 0);
  const myTeam = view.me.team;

  return (
    <main className="hc-toss">
      <h1 className="hc-toss-title">Toss time</h1>
      <p className="hc-toss-sub">
        {view.me.canCall ? (
          <>
            You are captain of <b>Team {(myTeam ?? 0) + 1}</b>, so you call it.
          </>
        ) : (
          <>
            <b>{nameOf(toss.callerId)}</b> is calling it for Team{' '}
            {(view.teams[0].includes(toss.callerId) ? 0 : 1) + 1}.
          </>
        )}
      </p>

      <div className="hc-coin-stage">
        <Captains view={view} lookOf={lookOf} nameOf={nameOf} settled={settled} />

        <div className="hc-coin-wrap">
          <div
            className={`hc-coin${landed ? ' flip' : ''}`}
            style={
              {
                ['--spin']: `${spin}deg`,
                ['--spin-half']: `${spin / 2}deg`,
              } as React.CSSProperties
            }
            aria-hidden="true"
          >
            <div className="hc-face heads">
              <div>
                h!<small>Heads</small>
              </div>
            </div>
            <div className="hc-face tails">
              <div>
                <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
                  <g transform="rotate(35 32 32)">
                    <rect x="28" y="4" width="8" height="16" rx="3" fill="var(--line)" />
                    <rect
                      x="22"
                      y="18"
                      width="20"
                      height="40"
                      rx="7"
                      fill="var(--paper)"
                      stroke="var(--line)"
                      strokeWidth="4"
                    />
                  </g>
                  <circle cx="50" cy="48" r="7" fill="var(--red)" stroke="var(--line)" strokeWidth="3" />
                </svg>
                <small>Tails</small>
              </div>
            </div>
          </div>
        </div>
        <div className="hc-coin-shadow" />
      </div>

      {landed === null && view.me.canCall && (
        <div className="hc-callrow">
          <button
            type="button"
            className="btn btn-sun"
            onClick={() => send({ type: 'call', side: 'heads' })}
          >
            Heads
          </button>
          <button
            type="button"
            className="btn btn-mint"
            onClick={() => send({ type: 'call', side: 'tails' })}
          >
            Tails
          </button>
        </div>
      )}

      <div className="hc-toss-result" aria-live="polite">
        {landed !== null && !settled && <p className="hc-toss-wait">In the air…</p>}

        {settled && landed !== null && (
          <>
            <h2>
              {landed === 'heads' ? 'Heads' : 'Tails'}
              {view.me.canChoose
                ? '! You won the toss'
                : ` — Team ${(winner ?? 0) + 1} won the toss`}
            </h2>
            <p>
              {view.me.canChoose
                ? 'Bat first and set a target, or bowl first and chase?'
                : toss.settled
                  ? 'Getting ready…'
                  : `${nameOf(captain ?? '')} is deciding.`}
            </p>
            {view.me.canChoose && (
              <div className="hc-callrow">
                <button
                  type="button"
                  className="btn btn-sky"
                  onClick={() => send({ type: 'choose', bat: true })}
                >
                  Bat first
                </button>
                <button
                  type="button"
                  className="btn btn-pink"
                  onClick={() => send({ type: 'choose', bat: false })}
                >
                  Bowl first
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/**
 * The two captains, waiting on it. Once it has landed one of them is jumping
 * and the other is not, which is the fastest way to read a toss.
 */
function Captains({
  view,
  lookOf,
  nameOf,
  settled,
}: {
  view: HandCricketView;
  lookOf: (id: string) => Look;
  nameOf: (id: string) => string;
  settled: boolean;
}) {
  const winner = settled ? view.toss.winner : null;

  const ref = useCanvas(({ ctx, width, height, time }) => {
    const S = Math.min(1.5, width / 360);
    const y = height - 12;

    ([0, 1] as const).forEach((team) => {
      const captainId = view.teams[team][0];
      if (!captainId) return;
      const x = width * (team === 0 ? 0.13 : 0.87);
      const dir = team === 0 ? 1 : -1;
      const [sb, sf] = shoulders(0);

      const pose =
        winner === team
          ? {
              team,
              legs: 'tuck' as const,
              lift: Math.abs(Math.sin(time * 9)) * 12 + 3,
              back: armTo(sb, Math.PI - 0.8, 30),
              front: armTo(sf, Math.PI + 0.8, 30),
              t: time,
            }
          : winner !== null
            ? {
                team,
                legs: 'stand' as const,
                back: armTo(sb, 1.1, 24),
                front: armTo(sf, -1.1 + Math.PI * 2, 24),
                mood: 'hurt' as const,
                t: time,
              }
            : {
                team,
                legs: 'stand' as const,
                back: [-8, -30] as [number, number],
                front: [16, -50 + Math.sin(time * 3) * 3] as [number, number],
                t: time,
                blink: ((time * 1000 + team * 900) % 3300) < 130,
              };

      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * S, 5 * S, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(14,10,46,.35)';
      ctx.fill();
      ctx.scale(S * dir, S);
      drawBody(ctx, lookOf(captainId), pose);
      ctx.restore();

      // a name pill over their head
      const name = nameOf(captainId);
      ctx.font = '900 13px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = ctx.measureText(name).width + 14;
      const py = y - 112 * S - 22;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, py - 9, w, 18, 9);
      ctx.fillStyle = TEAM_COL[team];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0E0A2E';
      ctx.stroke();
      ctx.fillStyle = '#0E0A2E';
      ctx.fillText(name, x, py + 0.5);
    });
  });

  return <canvas ref={ref} className="hc-toss-cv" aria-hidden="true" />;
}
