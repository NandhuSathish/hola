import { useState } from 'react';
import { MAX_PLAYERS, NAME_MAX_LENGTH, getGameInfo } from '@holla/shared';
import type { useRoom } from '../lib/useRoom';
import { Head } from '../components/Fighter';
import { LookPicker, LookRows, LookStage } from '../components/LookPicker';
import { CheckIcon, CopyIcon, LinkIcon } from '../components/icons';
import { useCopy } from '../lib/useCopy';
import { loadProfile, loadSeat, saveProfile } from '../lib/session';
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

  // No seat saved for this code means this is the friend who was sent the
  // link, not somebody coming back to a room they are already in — so the
  // door is a join form rather than a wait.
  if (!view) {
    return loadSeat(code) ? (
      <main className="lobby-screen">
        <section className="sticker panel narrow">
          <h1 className="room-title">Room {code}</h1>
          <p className="form-note">{room.error ?? 'Looking for your seat…'}</p>
          <button type="button" className="btn" onClick={() => navigate('/')}>
            Back to home
          </button>
        </section>
      </main>
    ) : (
      <JoinCard room={room} code={code} />
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
  // A fresh room has no game until the table picks one.
  const chosen = Boolean(view.gameId) && Boolean(game);
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
              <li
                key={p.id}
                className={`sticker pslot${p.connected ? '' : ' away'}`}
                data-player={p.id}
              >
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
          <div className={`chosen-game${chosen ? '' : ' none'}`}>
            <span className="cg-emoji" aria-hidden="true">{chosen ? '🃏' : '❓'}</span>
            <div>
              <b>{chosen ? game!.name : 'No game yet'}</b>
              <small>
                {chosen
                  ? `${game!.minPlayers}–${game!.maxPlayers} players · ${game!.estimate}`
                  : isHost
                    ? 'Pick one and everyone follows you to it.'
                    : `${hostName} is choosing.`}
              </small>
            </div>
            {isHost && (
              <button
                type="button"
                className={`btn small${chosen ? '' : ' btn-sun'}`}
                onClick={() => navigate(gamesPath(code))}
              >
                {chosen ? 'Change' : 'Pick a game'}
              </button>
            )}
          </div>

          {chosen && <h2>House rules</h2>}
          {chosen && (
            <p className="sub">
              {isHost
                ? `These belong to ${game!.name}. Other games bring their own.`
                : `${hostName} sets these.`}
            </p>
          )}

          {!chosen ? null : Settings ? (
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
            disabled={!isHost || !chosen || !enoughPlayers}
            onClick={() => room.startGame()}
          >
            Start game
          </button>
          <p className="host-note">
            {!isHost
              ? `You'll see the deal when ${hostName} starts it.`
              : !chosen
                ? 'Pick a game to get going.'
                : enoughPlayers
                  ? `Deal ${game!.name} for everyone here.`
                  : `${game!.name} needs at least ${game!.minPlayers} players.`}
          </p>

          {room.error && <p className="form-error" role="alert">{room.error}</p>}
        </aside>
      </div>
    </main>
  );
}

/**
 * The invite link's front door.
 *
 * Someone who taps `/r/CODE` in a group chat has no name, no fighter and no
 * seat, so sending them to the home page to type a code they already handed
 * us would be the wrong way round. Same two fields as home, minus the code.
 */
function JoinCard({ room, code }: Props) {
  const [profile, setProfile] = useState(loadProfile);
  const nameOk = profile.name.trim().length > 0;

  function update(next: Partial<typeof profile>) {
    const merged = { ...profile, ...next };
    setProfile(merged);
    saveProfile(merged);
  }

  return (
    <main className="lobby-screen">
      <section className="sticker panel join-panel">
        <div className="join-stage">
          <LookStage look={profile.look} height={220} />
        </div>

        <form
          className="join-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameOk) room.joinRoom(code, profile);
          }}
        >
          <h1 className="room-title">Join room {code}</h1>

          <label className="field-title" htmlFor="join-name">Your name</label>
          <input
            id="join-name"
            className="input"
            value={profile.name}
            maxLength={NAME_MAX_LENGTH}
            placeholder="What should we call you?"
            autoFocus
            onChange={(e) => update({ name: e.target.value })}
          />

          <span className="field-title">Build your fighter</span>
          <LookRows look={profile.look} onChange={(look) => update({ look })} />

          <button
            type="submit"
            className="btn btn-pink big"
            disabled={!nameOk || room.busy || room.connection !== 'connected'}
          >
            Take a seat
          </button>

          {room.error && <p className="form-error" role="alert">{room.error}</p>}
          {room.connection !== 'connected' && (
            <p className="form-note">
              {room.connection === 'connecting'
                ? 'Connecting to the server…'
                : 'Lost the server. Retrying…'}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
