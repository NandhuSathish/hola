import { useState } from 'react';
import type { Card, Color, LastCardView, PublicPlayer } from '@holla/shared';
import { CardBack, PlayingCard, describeCard } from './Card';
import './Table.css';

const COLORS: { value: Color; label: string }[] = [
  { value: 'red', label: 'Red' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
];

export type TableProps = {
  view: LastCardView;
  me: string;
  players: PublicPlayer[];
  send: (action: unknown) => void;
};

export function LastCardTable({ view, me, players, send }: TableProps) {
  /** Set while a wild waits for its colour, or a 7 waits for a swap target. */
  const [pendingWild, setPendingWild] = useState<Card | null>(null);
  const [pendingSwap, setPendingSwap] = useState<Card | null>(null);

  const myTurn = view.turnPlayerId === me;
  const playable = new Set(view.me.playableIds);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const avatarOf = (id: string) => players.find((p) => p.id === id)?.avatar ?? '🙂';

  const mySeat = view.seats.find((s) => s.playerId === me);
  const others = view.seats.filter((s) => s.playerId !== me);

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
    send({ type: 'play', cardId: card.id });
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

      <div className="arena">
        {/* Everyone else sits around the table; you sit at the bottom, by your hand. */}
        <ul className="seats">
          {others.map((seat, i) => {
            const angle = Math.PI / 2 + ((i + 1) * 2 * Math.PI) / (others.length + 1);
            return (
              <li
                key={seat.playerId}
                className={[
                  'seat',
                  seat.playerId === view.turnPlayerId ? 'turn' : '',
                  seat.connected ? '' : 'away',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  left: `${50 + 46 * Math.cos(angle)}%`,
                  top: `${50 + 45 * Math.sin(angle)}%`,
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
              <circle
                cx="100"
                cy="100"
                r="88"
                fill="none"
                stroke="rgba(255,244,220,.35)"
                strokeWidth="3"
                strokeDasharray="10 9"
              />
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
                <CardBack style={{ position: 'absolute', inset: 0, transform: 'translate(-4px, 4px) rotate(-5deg)', zIndex: -1 }} />
              </button>
              <span className="pile-label">Draw</span>
            </div>

            <div className="pile discard-pile">
              <div className="discard-wrap" style={{ ['--cur' as string]: `var(--${view.currentColor})` }}>
                <PlayingCard card={view.topCard} />
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
        <div className={`me${myTurn ? ' turn' : ''}`}>
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
            // Only dim on your own turn, where "you cannot play this" is real
            // information. On someone else's turn nothing is playable, so
            // greying the whole hand would just make the table look dead.
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
            className="shout"
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
                    send({ type: 'play', cardId: pendingWild.id, chosenColor: c.value });
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
                    send({ type: 'play', cardId: pendingSwap.id, swapWith: seat.playerId });
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
                send({ type: 'play', cardId: pendingSwap.id });
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
