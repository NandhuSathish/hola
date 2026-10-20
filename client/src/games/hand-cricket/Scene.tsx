import { useEffect, useRef, useState } from 'react';
import type { HandCricketView, Look, Outcome } from '@holla/shared';
import { useCanvas } from '../../lib/canvas';
import { drawScene, sceneDuration, stampAt, type SceneCast } from './stadium';

type Props = {
  view: HandCricketView;
  lookOf: (playerId: string) => Look;
  /** The ball being told, with the moment it started. */
  replay: { outcome: Outcome; at: number } | null;
  reduced: boolean;
  onReplayDone: () => void;
  stamp: { text: string; colour: string } | null;
  /** Who is on the ground: the people in the ball being told, not the next. */
  batterId: string;
  bowlerId: string;
  batName: string;
  bowlName: string;
  batTile: string;
  bowlTile: string;
  /** Set once the match is won, and only after the last ball has been told. */
  winners: { looks: Look[]; team: number; since: number } | null;
};

/**
 * The stadium. Everything here is a telling of something the server already
 * decided, so the replay runs on this client's own clock and nothing waits
 * for it — a slow tab sees a shorter version of the same ball, not a
 * different one.
 */
export function Scene({
  view,
  lookOf,
  replay,
  reduced,
  onReplayDone,
  stamp,
  batterId,
  bowlerId,
  batName,
  bowlName,
  batTile,
  bowlTile,
  winners,
}: Props) {
  const doneRef = useRef(onReplayDone);
  doneRef.current = onReplayDone;

  /**
   * The word lands when the thing happens, not when the ball is handed over:
   * "Out!" belongs to the stumps breaking, "Four!" to the ball reaching the
   * rope. Announcing it up front would give away a ball nobody has watched.
   */
  const [stamped, setStamped] = useState(false);

  // Under reduced motion there is no flight to watch, so the ball is simply
  // over and the stamp carries the news.
  useEffect(() => {
    setStamped(false);
    if (!replay) return;
    // Reduced motion has no flight to watch, so the word is the whole telling.
    const stampMs = reduced ? 0 : stampAt(replay.outcome) * 1000;
    const endMs = reduced ? 1100 : (sceneDuration(replay.outcome) + 0.5) * 1000;
    const atStamp = window.setTimeout(() => setStamped(true), stampMs);
    const atEnd = window.setTimeout(() => doneRef.current(), endMs);
    return () => {
      window.clearTimeout(atStamp);
      window.clearTimeout(atEnd);
    };
  }, [replay, reduced]);

  const innings = view.innings[view.current];
  const batting = innings?.battingTeam ?? 0;
  const bowling = batting === 0 ? 1 : 0;

  // Whoever on the bowling side is not bowling is in the field.
  const others = view.teams[bowling].filter((id) => id !== bowlerId);
  const cast: SceneCast = {
    batter: lookOf(batterId),
    bowler: lookOf(bowlerId),
    keeper: others[0] ? lookOf(others[0]) : null,
    fielders: others.slice(1).map(lookOf),
    batTeam: batting,
    bowlTeam: bowling,
  };

  const ref = useCanvas(({ ctx, width, height, time }) => {
    let T: number | null = null;
    if (replay && !reduced) {
      const elapsed = (performance.now() - replay.at) / 1000;
      T = Math.min(elapsed, sceneDuration(replay.outcome));
    }
    drawScene({
      ctx,
      width,
      height,
      time,
      T,
      outcome: replay && !reduced ? replay.outcome : null,
      cast,
      celebration: winners
        ? {
            looks: winners.looks,
            team: winners.team,
            t: (performance.now() - winners.since) / 1000,
          }
        : null,
    });
  });

  return (
    <div className="hc-scene">
      <canvas
        ref={ref}
        className="hc-scene-cv"
        role="img"
        aria-label="A cricket ground, with a bowler, a batter, a keeper and an umpire"
      />

      {!winners && <div className="sticker hc-chip hc-chip-bowl">
        <div className="hc-who">
          <small>Bowling</small>
          <b>{bowlName}</b>
        </div>
        <div className={`hc-tile${bowlTile === 'in' ? ' locked' : ''}`}>
          {bowlTile === 'in' ? 'in' : bowlTile}
        </div>
      </div>}

      {!winners && <div className="sticker hc-chip hc-chip-bat">
        <div className={`hc-tile${batTile === 'in' ? ' locked' : ''}`}>
          {batTile === 'in' ? 'in' : batTile}
        </div>
        <div className="hc-who">
          <small>Batting</small>
          <b>{batName}</b>
        </div>
      </div>}

      {stamp && stamped && (
        <div className="hc-stamp" key={replay?.at} aria-hidden="true">
          <span style={{ ['--c' as string]: stamp.colour }}>{stamp.text}</span>
        </div>
      )}
    </div>
  );
}
