import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card, Color, GameEvent, LastCardView, PublicPlayer } from '@holla/shared';
import { CardBack, PlayingCard, describeCard } from './Card';
import { Confetti, FlyingCard, Stamp, Toast, type FlightPlan } from '../../components/Flourish';
import { useTurnCountdown } from '../../lib/useTurnCountdown';
import './Table.css';

const COLORS: { value: Color; label: string }[] = [
  { value: 'red', label: 'Red' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
];

/** Events worth interrupting someone for. Everything else just joins the log. */
const SHOUTY = new Set(['reverse', 'stack', 'catch', 'swap', 'rotate', 'timeout', 'skip']);

export type TableProps = {
  view: LastCardView;
  me: string;
  players: PublicPlayer[];
  send: (action: unknown) => void;
  events: GameEvent[];
  eventSeq: number;
};

export function LastCardTable({ view, me, players, send, events, eventSeq }: TableProps) {
  const [pendingWild, setPendingWild] = useState<Card | null>(null);
  const [pendingSwap, setPendingSwap] = useState<Card | null>(null);
  const [flight, setFlight] = useState<FlightPlan | null>(null);
  const [stampAt, setStampAt] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const flightId = useRef(0);

  // Stable, so the memoised FlyingCard is not re-rendered by the turn ring.
  const clearFlight = useCallback(() => setFlight(null), []);

  // animationend is the normal path; this is the safety net if the element is
  // unmounted mid-flight or the event is missed.
  useEffect(() => {
    if (!flight) return;
    const timer = setTimeout(() => setFlight(null), 700);
    return () => clearTimeout(timer);
  }, [flight]);

  const myTurn = view.turnPlayerId === me;
  const playable = new Set(view.me.playableIds);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const avatarOf = (id: string) => players.find((p) => p.id === id)?.avatar ?? '🙂';

  const mySeat = view.seats.find((s) => s.playerId === me);
  const others = view.seats.filter((s) => s.playerId !== me);

  const progress = useTurnCountdown(view.turnPlayerId, view.turnEndsAt);

  // The newest event drives the toast, and a shout drives the stamp.
  const newest = events[0];
  useEffect(() => {
    if (!newest || eventSeq === 0) return;
    const who = newest.playerId ? nameOf(newest.playerId) : '';
    if (newest.kind === 'shout') {
      setStampAt(Date.now());
      setToast(null);
      return;
    }
    setToast(SHOUTY.has(newest.kind) ? `${who} ${newest.text}`.trim() : null);
    // nameOf depends on players, which is stable enough for a toast
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSeq]);

  /** Sends a play, and sets the card flying from wherever it currently sits. */
  function sendPlay(card: Card, extra: Record<string, unknown> = {}) {
    // Both rectangles are read now, while the card is still in the hand and
    // the pile is where the player can see it.
    const node = document.querySelector(`[data-card-id="${card.id}"]`);
    const pile = document.querySelector('.discard-wrap');
    if (node && pile) {
      flightId.current += 1;
      setFlight({
        from: node.getBoundingClientRect(),
        to: pile.getBoundingClientRect(),
        node: <PlayingCard card={card} />,
        id: flightId.current,
      });
    }
    send({ type: 'play', cardId: card.id, ...extra });
  }

  function play(card: Card) {
    if (!playable.has(card.id)) return;
    if (card.color === 'wild') {
      setPendingWild(card);
      return;
    }
    if (card.value === '7' && others.length > 0) {
      setPendingSwap(card);
      return;
    }
    sendPlay(card);
  }

  const banner = (() => {
    if (view.pendingDraw > 0 && myTurn) return `Answer the +${view.pendingDraw} or take it`;
    if (myTurn) return view.me.playableIds.length > 0 ? 'Your turn' : 'No match — take a card';
    return `${nameOf(view.turnPlayerId)} is thinking…`;
  })();

  return (
    <div className="table-screen">
      <div className="table-top">
        <div className={`sticker banner${myTurn ? '' : ' waiting'}`}>
          <span className="banner-dot" style={{ background: `var(--${view.currentColor})` }} />
          <span>{banner}</span>
        </div>
        <div className="table-meta">
          <span>{view.drawPileCount} in the deck</span>
          {view.pendingDraw > 0 && <span className="hot">+{view.pendingDraw} pending</span>}
        </div>
      </div>

      <ul className="log" aria-live="polite" aria-label="Recent moves">
        {events.slice(0, 5).map((e, i) => (
          <li key={`${eventSeq}-${i}`}>
            {e.playerId ? `${nameOf(e.playerId)} ` : ''}
            {e.text}
          </li>
        ))}
      </ul>

      <div className="arena">
        <ul className="seats">
          {others.map((seat, i) => {
            const angle = Math.PI / 2 + ((i + 1) * 2 * Math.PI) / (others.length + 1);
            const theirTurn = seat.playerId === view.turnPlayerId;
            return (
              <li
                key={seat.playerId}
                className={['seat', theirTurn ? 'turn' : '', seat.connected ? '' : 'away']
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  left: `${50 + 46 * Math.cos(angle)}%`,
                  top: `${50 + 45 * Math.sin(angle)}%`,
                  ...(theirTurn ? ({ ['--t']: String(progress) } as React.CSSProperties) : {}),
                }}
              >
                <div className="seat-avatar">
                  <span className="av">{avatarOf(seat.playerId)}</span>
                  <span className="cnt" aria-label={`${seat.cardCount} cards`}>
                    {seat.cardCount}
                  </span>
                </div>
                <span className="name">{nameOf(seat.playerId)}</span>
                {seat.shouted && <span className="tag shouted">Last card!</span>}
                {seat.catchable && (
                  <button
                    type="button"
                    className="tag catch"
                    onClick={() => send({ type: 'catch', targetId: seat.playerId })}
                  >
                    Catch!
                  </button>
                )}
                {!seat.connected && <span className="tag">Away</span>}
              </li>
            );
          })}
        </ul>

        <div className="rug">
          <svg
            className={`dir${view.direction === -1 ? ' ccw' : ''}`}
            viewBox="0 0 200 200"
            aria-hidden="true"
          >
            <g>
              <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,244,220,.35)" strokeWidth="3" strokeDasharray="10 9" />
              <polygon points="93,4 109,12 93,20" fill="var(--paper)" stroke="var(--line)" strokeWidth="2" />
              <polygon points="107,180 91,188 107,196" fill="var(--paper)" stroke="var(--line)" strokeWidth="2" />
            </g>
          </svg>

          <div className="center">
            <div className="pile">
              <button
                type="button"
                className="draw-btn"
                disabled={!myTurn}
                onClick={() => send({ type: 'draw' })}
                aria-label="Draw a card"
              >
                <CardBack />
              </button>
              <span className="pile-label">Draw</span>
            </div>

            <div className="pile discard-pile">
              <div className="discard-wrap" style={{ ['--cur' as string]: `var(--${view.currentColor})` }}>
                {/* keyed on the card, so a new top card replays the pop */}
                <PlayingCard key={view.topCard.id} card={view.topCard} />
              </div>
              <span className="color-pill">
                <i style={{ background: `var(--${view.currentColor})` }} />
                {view.currentColor}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="hand-area">
        <div
          className={`me${myTurn ? ' turn' : ''}`}
          style={myTurn ? ({ ['--t']: String(progress) } as React.CSSProperties) : undefined}
        >
          <div className="seat-avatar">
            <span className="av">{avatarOf(me)}</span>
            {mySeat && (
              <span className="cnt" aria-label={`${mySeat.cardCount} cards`}>
                {mySeat.cardCount}
              </span>
            )}
          </div>
          <span className="name">You</span>
        </div>

        <div className="hand" aria-label="Your cards">
          {view.me.hand.map((card, i) => {
            const can = myTurn && playable.has(card.id);
            return (
              <PlayingCard
                key={card.id}
                card={card}
                playable={can}
                dimmed={myTurn && !can}
                onClick={() => play(card)}
                style={{
                  ['--i' as string]: String(i - (view.me.hand.length - 1) / 2),
                  zIndex: i,
                }}
              />
            );
          })}
          {view.me.hand.length === 0 && <p className="watching">You are watching this round.</p>}
        </div>

        <div className="hand-actions">
          <button
            type="button"
            className={`shout${!view.me.shouted && view.me.hand.length <= 2 ? ' ready' : ''}`}
            disabled={view.me.shouted || view.me.hand.length > 2}
            onClick={() => send({ type: 'shout' })}
          >
            {view.me.shouted ? 'Shouted!' : 'Last card!'}
          </button>
          <button
            type="button"
            className="btn small"
            disabled={!view.me.canPass}
            onClick={() => send({ type: 'pass' })}
          >
            Pass
          </button>
        </div>
      </div>

      <FlyingCard plan={flight} onDone={clearFlight} />
      <Toast message={toast} />
      <Stamp text="Last card!" at={stampAt} />

      {pendingWild && (
        <div className="chooser" role="dialog" aria-label="Pick a colour">
          <div className="sticker chooser-card">
            <h2>Pick a colour</h2>
            <p>Everyone has to match it next.</p>
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  style={{ background: `var(--${c.value})` }}
                  onClick={() => {
                    sendPlay(pendingWild, { chosenColor: c.value });
                    setPendingWild(null);
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button type="button" className="btn small" onClick={() => setPendingWild(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {pendingSwap && (
        <div className="chooser" role="dialog" aria-label="Swap hands with">
          <div className="sticker chooser-card">
            <h2>Swap hands with</h2>
            <p>You played {describeCard(pendingSwap)}.</p>
            <div className="swap-list">
              {others.map((seat) => (
                <button
                  key={seat.playerId}
                  type="button"
                  className="btn"
                  onClick={() => {
                    sendPlay(pendingSwap, { swapWith: seat.playerId });
                    setPendingSwap(null);
                  }}
                >
                  {avatarOf(seat.playerId)} {nameOf(seat.playerId)} · {seat.cardCount}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                // 7-0 may simply be switched off, in which case it is a plain 7.
                sendPlay(pendingSwap);
                setPendingSwap(null);
              }}
            >
              Play it as a plain 7
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { Confetti };
