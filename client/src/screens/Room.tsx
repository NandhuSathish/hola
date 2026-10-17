import { useState } from 'react';
import { MAX_PLAYERS } from '@holla/shared';
import type { useRoom } from '../lib/useRoom';
import './Room.css';

type Props = { room: ReturnType<typeof useRoom>; code: string };

export function Room({ room, code }: Props) {
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
      <main className="room-screen">
        <section className="sticker panel narrow">
          <h1 className="room-title">Room {code}</h1>
          <p className="form-note">
            {room.error ? room.error : 'Looking for your seat…'}
          </p>
          <button type="button" className="btn" onClick={() => room.leaveRoom()}>
            Back to home
          </button>
        </section>
      </main>
    );
  }

  const seated = view.players.length;

  return (
    <main className="room-screen">
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

      {room.connection !== 'connected' && (
        <p className="reconnect-banner" role="status">Reconnecting…</p>
      )}

      <div className="players-title">
        <h2>Who&apos;s here</h2>
        <span>{seated} of {MAX_PLAYERS} seats</span>
      </div>

      <ul className="plist">
        {view.players.map((p) => (
          <li
            key={p.id}
            className={`sticker pslot${p.connected ? '' : ' away'}`}
          >
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
        {Array.from({ length: Math.max(0, Math.min(3, MAX_PLAYERS - seated)) }).map((_, i) => (
          <li key={`empty-${i}`} className="pslot empty">Open seat</li>
        ))}
      </ul>

      <div className="room-actions">
        <button type="button" className="btn" onClick={() => room.leaveRoom()}>
          Leave room
        </button>
        <span className="phase-note">
          Phase 1a — the styled lobby and game picker land in 1b.
        </span>
      </div>
    </main>
  );
}
