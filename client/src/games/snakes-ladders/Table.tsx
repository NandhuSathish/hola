import type { GameEvent, PublicPlayer, SnakesView } from '@holla/shared';
import { LAST_TILE } from '@holla/shared';
import { SnakesBoard } from './Board';
import { Toast } from '../../components/Flourish';
import { useTurnCountdown } from '../../lib/useTurnCountdown';
import './Table.css';

export type TableProps = {
  view: SnakesView;
  me: string;
  players: PublicPlayer[];
  send: (action: unknown) => void;
  events: GameEvent[];
  eventSeq: number;
};

/** Token colours, in seat order. */
const SEAT_COLOURS = ['--red', '--sky', '--mint', '--sun', '--pink', '--purple', '--orange', '--teal'];

export function SnakesTable({ view, me, players, send, events, eventSeq }: TableProps) {
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const avatarOf = (id: string) => players.find((p) => p.id === id)?.avatar ?? '🙂';
  const colourOf = (id: string) => {
    const i = view.seats.findIndex((s) => s.playerId === id);
    return `var(${SEAT_COLOURS[(i < 0 ? 0 : i) % SEAT_COLOURS.length]})`;
  };

  const progress = useTurnCountdown(view.turnPlayerId, view.turnEndsAt);
  const myTurn = view.turnPlayerId === me;
  const toast = useToastFromEvents(events, eventSeq, nameOf);

  const banner = myTurn
    ? view.me.rollsLeft < 3
      ? 'Six! Roll again'
      : 'Your turn — roll'
    : `${nameOf(view.turnPlayerId)} is rolling…`;

  return (
    <div className="sl-screen">
      <div className="table-top">
        <div className={`sticker banner${myTurn ? '' : ' waiting'}`}>
          <span className="banner-dot" style={{ background: colourOf(view.turnPlayerId) }} />
          <span>{banner}</span>
        </div>
        <div className="table-meta">
          <span>Round {view.round}</span>
          <span>First to {LAST_TILE}</span>
        </div>
      </div>

      <ul className="log" aria-live="polite" aria-label="Recent moves">
        {events.slice(0, 4).map((e, i) => (
          <li key={`${eventSeq}-${i}`}>
            {e.playerId ? `${nameOf(e.playerId)} ` : ''}
            {e.text}
          </li>
        ))}
      </ul>

      <div className="sl-layout">
        <div className="sl-board-wrap">
          <SnakesBoard view={view} me={me} colourOf={colourOf} labelOf={nameOf} />
        </div>

        <aside className="sl-side">
          <ul className="sl-racers">
            {[...view.seats]
              .sort((a, b) => b.pos - a.pos)
              .map((seat) => (
                <li
                  key={seat.playerId}
                  className={[
                    'sl-racer',
                    seat.playerId === view.turnPlayerId ? 'turn' : '',
                    seat.connected ? '' : 'away',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={
                    seat.playerId === view.turnPlayerId
                      ? ({ ['--t']: String(progress) } as React.CSSProperties)
                      : undefined
                  }
                >
                  <span className="sl-dot" style={{ background: colourOf(seat.playerId) }} />
                  <span className="sl-av">{avatarOf(seat.playerId)}</span>
                  <span className="sl-name">
                    {nameOf(seat.playerId)}
                    {seat.playerId === me && <em> (you)</em>}
                  </span>
                  <span className="sl-pos">{seat.pos}</span>
                </li>
              ))}
          </ul>

          <button
            type="button"
            className="btn btn-pink sl-roll"
            disabled={!view.me.canRoll}
            onClick={() => send({ type: 'roll' })}
          >
            {view.me.canRoll ? 'Roll' : 'Waiting…'}
          </button>

          {view.lastTurn && (
            <p className="sl-dice" aria-live="polite">
              {nameOf(view.lastTurn.playerId)} rolled{' '}
              <b>{view.lastTurn.dice.join(' + ')}</b>
              {view.lastTurn.overshot && ' — bounced off 100'}
            </p>
          )}
        </aside>
      </div>

      <Toast message={toast} />
    </div>
  );
}

/** Loud moments only — the rest just scroll past in the log. */
const LOUD = new Set(['ladder', 'snake', 'bounce', 'again', 'timeout']);

function useToastFromEvents(
  events: GameEvent[],
  eventSeq: number,
  nameOf: (id: string) => string,
): string | null {
  const newest = events[0];
  if (!newest || eventSeq === 0 || !LOUD.has(newest.kind)) return null;
  const who = newest.playerId ? nameOf(newest.playerId) : '';
  return `${who} ${newest.text}`.trim();
}
