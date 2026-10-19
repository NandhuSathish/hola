import { useState } from 'react';
import { MAX_PLAYERS, getGameInfo } from '@holla/shared';
import type { useRoom } from '../lib/useRoom';
import { Head } from '../components/Fighter';
import { LookPicker } from '../components/LookPicker';
import { CheckIcon, CopyIcon, LeaveIcon, LinkIcon } from '../components/icons';
import { useCopy } from '../lib/useCopy';
import { loadProfile, saveProfile } from '../lib/session';
import { gamesPath, navigate } from '../lib/route';
import { getGameUI } from '../games';
import './Lobby.css';

type Props = { room: ReturnType<typeof useRoom>; code: string };

export function Lobby({ room, code }: Props) {
  const [restyling, setRestyling] = useState(false);
  // Two independent copies, so tapping one does not make the other claim it
  // copied something it did not.
  const codeCopy = useCopy();
  const linkCopy = useCopy();
  const view = room.room;

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
  const mySeat = Math.max(0, view.players.findIndex((p) => p.id === room.me));
  const myLook = view.players[mySeat]?.look ?? loadProfile().look;
  const ui = getGameUI(view.gameId);
  const Settings = ui?.Settings;
  const seated = view.players.length;
  const emptySeats = Math.max(0, MAX_PLAYERS - seated);
  const enoughPlayers = seated >= (game?.minPlayers ?? 2);
  const hostName = view.players.find((p) => p.id === view.hostId)?.name ?? 'the host';

  return (
    <main className="lobby-screen">
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

              <div className="code-actions">
                <button
                  type="button"
                  className={`icon-btn${codeCopy.copied ? ' done' : ''}`}
                  onClick={() => codeCopy.copy(view.code)}
                  title="Copy the room code"
                  aria-label="Copy the room code"
                >
                  {codeCopy.copied ? <CheckIcon /> : <CopyIcon />}
                </button>

                <button
                  type="button"
                  className="btn small with-icon"
                  onClick={() => linkCopy.copy(`${window.location.origin}/r/${code}`)}
                >
                  {linkCopy.copied ? <CheckIcon /> : <LinkIcon />}
                  {linkCopy.copied ? 'Copied!' : 'Copy invite link'}
                </button>

                <button
                  type="button"
                  className="btn small with-icon leave-btn"
                  onClick={() => room.leaveRoom()}
                >
                  <LeaveIcon />
                  Leave room
                </button>
              </div>
            </div>
            {(codeCopy.failed || linkCopy.failed) && (
              <p className="form-note copy-failed" role="alert">
                Could not reach the clipboard — select the code and copy it by hand.
              </p>
            )}
          </div>

          <div className="players-title">
            <h2>Who&apos;s here</h2>
            <span>{seated} of {MAX_PLAYERS} seats</span>
          </div>

          <ul className="pgrid">
            {view.players.map((p, seat) => (
              <li key={p.id} className={`sticker pslot${p.connected ? '' : ' away'}`}>
                {p.id === view.hostId && <span className="crown" title="Host">👑</span>}
                <Head className="pav" look={p.look} seat={seat} size={54} />
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

          <div className="lobby-me">
            <button
              type="button"
              className="btn small"
              aria-expanded={restyling}
              onClick={() => setRestyling((on) => !on)}
            >
              {restyling ? 'Done' : 'Change my fighter'}
            </button>
          </div>

          {restyling && (
            <div className="sticker lobby-restyle">
              <LookPicker
                look={myLook}
                seat={mySeat}
                onChange={(look) => {
                  // Saved locally as well, so it is your fighter next room too.
                  saveProfile({ ...loadProfile(), look });
                  room.setLook(look);
                }}
              />
            </div>
          )}
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

          <button
            type="button"
            className="btn btn-pink start"
            disabled={!isHost || !enoughPlayers}
            onClick={() => room.startGame()}
          >
            Start game
          </button>
          <p className="host-note">
            {!isHost
              ? `You'll see the deal when ${hostName} starts it.`
              : enoughPlayers
                ? `Deal ${game?.name ?? 'the game'} for everyone here.`
                : `${game?.name ?? 'This game'} needs at least ${game?.minPlayers ?? 2} players.`}
          </p>

          {room.error && <p className="form-error" role="alert">{room.error}</p>}
        </aside>
      </div>
    </main>
  );
}
