import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvent, MoveStep, PublicPlayer, SnakesView } from '@holla/shared';
import { DEFAULT_LOOK, LAST_TILE } from '@holla/shared';
import { SnakesBoard } from './Board';
import { SnakesPrompt } from './Prompt';
import { DiceTray } from './Dice';
import { CardReveal, Stamp, type StampCue } from './Reveal';
import { LOG_ART } from './icons';
import { Head } from '../../components/Fighter';
import { teamColour } from '../../art/fighter';
import { usePrefersReducedMotion } from '../../lib/motion';
import { play as sound } from '../../lib/sound';
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

export function SnakesTable({ view, me, players, send, events, eventSeq }: TableProps) {
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Someone';
  // Seat order is the jersey order, so the race list and the board agree.
  const seatIndexOf = (id: string) => Math.max(0, view.seats.findIndex((s) => s.playerId === id));
  const lookOf = (id: string) => players.find((p) => p.id === id)?.look ?? DEFAULT_LOOK;

  const progress = useTurnCountdown(view.turnPlayerId, view.turnEndsAt);
  const myTurn = view.turnPlayerId === me;
  const reduced = usePrefersReducedMotion();

  const [shaking, setShaking] = useState(false);
  // Read inside pointer handlers: pointerup lands in the same tick as
  // pointerdown's state update, so the rendered `shaking` is still stale.
  const shakingRef = useRef(false);
  const hold = useCallback((on: boolean) => {
    shakingRef.current = on;
    setShaking(on);
  }, []);
  const [card, setCard] = useState<string | null>(null);
  const [stamp, setStamp] = useState<StampCue | null>(null);

  const roll = useCallback(() => {
    hold(false);
    if (!view.me.canRoll) return;
    sound('roll');
    send({ type: 'roll' });
  }, [hold, send, view.me.canRoll]);

  // Hold to shake, let go to roll — Space does the same, as in the mock. The
  // prompt takes Space when one is open, so this only binds when none is.
  useEffect(() => {
    if (!view.me.canRoll || view.prompt) return;
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      hold(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTyping(e.target)) return;
      e.preventDefault();
      roll();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [view.me.canRoll, view.prompt, roll, hold]);

  // Your turn came round again, so drop any dice still held from last time.
  useEffect(() => {
    if (!view.me.canRoll) hold(false);
  }, [view.me.canRoll, hold]);

  const onCue = useCallback(
    (step: MoveStep, playerId: string) => {
      if (step.kind === 'card') {
        setCard(step.card);
        return;
      }
      const cue = stampFor(step, playerId === me);
      if (cue) {
        setStamp({ ...cue, at: performance.now() });
        // A ladder is good news whoever climbs it; a snake is bad news.
        sound(step.kind === 'ladder' || step.kind === 'charmed' ? 'good' : 'bad');
      }
    },
    [me],
  );

  const banner = view.prompt
    ? view.awaitingMe
      ? 'Your call…'
      : 'Waiting on the room…'
    : myTurn
      ? view.me.rollsLeft < 3
        ? 'Six! Roll again'
        : 'Your turn'
      : 'Rolling…';

  return (
    <div className="sl-screen">
      <div className="sl-layout">
        <div className="sl-board-wrap">
          <SnakesBoard
            view={view}
            me={me}
            seatIndexOf={seatIndexOf}
            lookOf={lookOf}
            onCue={onCue}
          />
          <Stamp cue={stamp} />
          {card && (
            <CardReveal
              card={card}
              who={nameOf(view.lastTurn?.playerId ?? me)}
              look={lookOf(view.lastTurn?.playerId ?? me)}
              seat={seatIndexOf(view.lastTurn?.playerId ?? me)}
              mine={view.lastTurn?.playerId === me}
              reduced={reduced}
              onClose={() => setCard(null)}
            />
          )}
          {view.prompt && (
            <SnakesPrompt prompt={view.prompt} me={me} players={players} send={send} />
          )}
        </div>

        <aside className="sl-side">
          {/* The "now" bar: whose turn it is, in their colour, with the tray. */}
          <div className="sticker sl-turn">
            <div
              className="sl-turn-head"
              style={{ ['--c' as string]: teamColour(seatIndexOf(view.turnPlayerId)) }}
            >
              <span className="sl-turn-av">
                <Head
                  look={lookOf(view.turnPlayerId)}
                  seat={seatIndexOf(view.turnPlayerId)}
                  size={52}
                />
              </span>
              <div className="sl-turn-who">
                <small>{banner}</small>
                <b>{myTurn ? 'You' : nameOf(view.turnPlayerId)}</b>
              </div>
              <span className="sl-round">Round {view.round}</span>
            </div>

            <div className="sl-tray">
              <DiceTray
                values={view.lastTurn?.dice ?? []}
                seq={view.turnSeq}
                shaking={shaking}
                count={view.me.double && myTurn ? 2 : 1}
              />
            </div>

            <button
              type="button"
              className={`btn btn-pink sl-roll${shaking ? ' holding' : ''}`}
              disabled={!view.me.canRoll}
              onPointerDown={(e) => {
                if (!view.me.canRoll) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                hold(true);
              }}
              onPointerUp={() => shakingRef.current && roll()}
              onPointerCancel={() => hold(false)}
            >
              {!view.me.canRoll ? 'Waiting…' : shaking ? 'Shaking…' : 'Hold to shake'}
            </button>

            {/* The turn clock, draining. Stays full when the timer is off. */}
            <div className="sl-auto" aria-hidden="true">
              <i style={{ width: `${myTurn ? progress : 0}%` }} />
            </div>
            <p className="sl-hint">
              {view.me.canRoll
                ? 'Let go to roll. Space works too.'
                : myTurn
                  ? 'Hold on…'
                  : `${nameOf(view.turnPlayerId)} is rolling.`}
            </p>
          </div>

          <div className="sticker sl-race">
            <h3>The race</h3>
            <ol>
              {[...view.seats]
                .sort((a, b) => b.pos - a.pos)
                .map((seat) => (
                  <li
                    key={seat.playerId}
                    data-player={seat.playerId}
                    className={[
                      seat.playerId === view.turnPlayerId ? 'now' : '',
                      seat.connected ? '' : 'away',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="sl-av">
                      <Head
                        look={lookOf(seat.playerId)}
                        seat={seatIndexOf(seat.playerId)}
                        size={30}
                      />
                    </span>
                    <div className="sl-nm">
                      <b>
                        {nameOf(seat.playerId)}
                        {seat.playerId === me && <em> (you)</em>}
                      </b>
                      <div
                        className="sl-prog"
                        style={{ ['--c' as string]: teamColour(seatIndexOf(seat.playerId)) }}
                      >
                        <i style={{ width: `${seat.pos}%` }} />
                      </div>
                      {(seat.shield || seat.frozen) && (
                        <div className="sl-badges">
                          {seat.shield && <span style={{ ['--c' as string]: 'var(--sky)' }}>Shield</span>}
                          {seat.frozen && <span style={{ ['--c' as string]: 'var(--teal)' }}>Frozen</span>}
                        </div>
                      )}
                    </div>
                    <span className="sl-tile">{seat.pos}</span>
                  </li>
                ))}
            </ol>
            <p className="sl-goal">First to {LAST_TILE} wins</p>
          </div>

          <div className="sticker sl-logbox">
            <h3>What happened</h3>
            <ul aria-live="polite">
              {events.slice(0, 12).map((e, i) => {
                const Icon = LOG_ART[e.kind];
                return (
                  <li key={`${eventSeq}-${i}`}>
                    {e.playerId ? (
                      <span className="sl-log-av">
                        <Head look={lookOf(e.playerId)} seat={seatIndexOf(e.playerId)} size={26} />
                      </span>
                    ) : Icon ? (
                      <Icon className="sl-log-ico" />
                    ) : (
                      <span className="sl-log-dot" />
                    )}
                    <span>
                      {e.playerId ? <b>{nameOf(e.playerId)}</b> : null} {e.text}
                    </span>
                  </li>
                );
              })}
              {events.length === 0 && <li className="sl-log-empty">Nothing yet. Roll!</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Don't steal Space from a text field. */
const isTyping = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
};

/** The big word that slams over the board for a given leg. */
function stampFor(step: MoveStep, mine: boolean): Omit<StampCue, 'at'> | null {
  switch (step.kind) {
    case 'ladder':
      return { text: 'Ladder!', colour: 'var(--mint)' };
    case 'snake':
      return { text: mine ? 'Gulp…' : 'Snake!', colour: 'var(--red)' };
    case 'bonk':
      return { text: 'Bonk!', colour: 'var(--sky)' };
    case 'charmed':
      return { text: 'Escaped!', colour: 'var(--mint)' };
    case 'swap':
      return { text: 'Swap!', colour: 'var(--purple)' };
    case 'jump':
      return step.to > step.from
        ? { text: 'Rocket!', colour: 'var(--sky)' }
        : { text: 'Slip!', colour: 'var(--sun)' };
    default:
      return null;
  }
}

