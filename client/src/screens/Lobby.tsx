import { useState } from 'react';
import { MAX_PLAYERS, getGameInfo } from '@holla/shared';
import type { useRoom } from '../lib/useRoom';
import { gamesPath, navigate } from '../lib/route';
import { getGameUI } from '../games';
import './Lobby.css';

type Props = { room: ReturnType<typeof useRoom>; code: string };

export function Lobby({ room, code }: Props) {
  const [copied, setCopied] = useState(false);
  const view = room.room;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!view) {
    return (
      <main className="lobby-screen">
        <section className="sticker panel narrow">
          <h1 className="room-title">Room {code}</h1>
          <p className="form-note">{room.error ?? 'Looking for your seat…'}</p>
          <button type="button" className="btn" onClick={() => navigate('/')}>
            Back to home
          </button>
        </section>
      </main>
    );
  }

  const isHost = room.me === view.hostId;
  const game = getGameInfo(view.gameId);
  const ui = getGameUI(view.gameId);
  const Settings = ui?.Settings;
  const seated = view.players.length;
  const emptySeats = Math.max(0, MAX_PLAYERS - seated);

  return (
    <main className="lobby-screen">
      {room.connection !== 'connected' && (
        <p className="reconnect-banner" role="status">Reconnecting…</p>
      )}

      <div className="lobby">
        <div>
          <div className="room-head">
            <div>
              <h1 className="room-title">Room code</h1>
              <p className="room-sub">Share it with your friends, or send the link.</p>
            </div>
            <div className="code-row">
              <div className="code" aria-label={`Room code ${view.code}`}>
                {[...view.code].map((char, i) => (
                  <span key={i} data-i={i % 4}>{char}</span>
                ))}
              </div>
              <button type="button" className="btn small" onClick={copyLink}>
                {copied ? 'Copied!' : 'Copy invite link'}
              </button>
            </div>
          </div>

          <div className="players-title">
            <h2>Who&apos;s here</h2>
            <span>{seated} of {MAX_PLAYERS} seats</span>
          </div>

          <ul className="pgrid">
            {view.players.map((p) => (
              <li key={p.id} className={`sticker pslot${p.connected ? '' : ' away'}`}>
                {p.id === view.hostId && <span className="crown" title="Host">👑</span>}
                <span className="pav">{p.avatar}</span>
                <span className="pname">
                  {p.name}
                  {p.id === room.me && <em> (you)</em>}
                </span>
                {!p.connected && <span className="tag">Reconnecting…</span>}
                {p.spectator && <span className="tag">Watching</span>}
              </li>
            ))}
            {Array.from({ length: Math.min(3, emptySeats) }).map((_, i) => (
              <li key={`empty-${i}`} className="pslot empty">Open seat</li>
            ))}
          </ul>

          <button type="button" className="btn leave-btn" onClick={() => room.leaveRoom()}>
            Leave room
          </button>
        </div>

        <aside className="sticker rules">
          <div className="chosen-game">
            <span className="cg-emoji" aria-hidden="true">🃏</span>
            <div>
              <b>{game?.name ?? view.gameId}</b>
              <small>{game ? `${game.minPlayers}–${game.maxPlayers} players · ${game.estimate}` : 'Unknown game'}</small>
            </div>
            {isHost && (
              <button type="button" className="btn small" onClick={() => navigate(gamesPath(code))}>
                Change
              </button>
            )}
          </div>

          <h2>House rules</h2>
          <p className="sub">
            {isHost
              ? `These belong to ${game?.name ?? 'this game'}. Other games bring their own.`
              : `${view.players.find((p) => p.id === view.hostId)?.name ?? 'The host'} sets these.`}
          </p>

          {Settings ? (
            <Settings
              settings={view.settings}
              canEdit={isHost && view.phase === 'lobby'}
              onChange={room.updateSettings}
            />
          ) : (
            <p className="form-note">This game has no settings.</p>
          )}

          <button type="button" className="btn btn-pink start" disabled title="Phase 3">
            Start game
          </button>
          <p className="host-note">
            {isHost
              ? 'Dealing arrives with the Last Card engine in Phase 2.'
              : `You'll see the deal when ${view.players.find((p) => p.id === view.hostId)?.name ?? 'the host'} starts it.`}
          </p>

          {room.error && <p className="form-error" role="alert">{room.error}</p>}
        </aside>
      </div>
    </main>
  );
}
