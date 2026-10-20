import { useEffect } from 'react';
import { getGameInfo } from '@holla/shared';
import type { useRoom } from '../lib/useRoom';
import { getGameUI } from '../games';
import { gamesPath, navigate } from '../lib/route';
import { Lobby } from './Lobby';
import { Results } from './Results';

type Props = { room: ReturnType<typeof useRoom>; code: string };

/**
 * One URL, three screens. The room's phase decides which, so every client
 * follows the host into the round without any navigation of its own.
 */
export function RoomScreen({ room, code }: Props) {
  const view = room.room;

  /*
   * A room with no game is not a lobby yet, it is a room on its way to the
   * picker. Everyone goes there — the host to choose, everyone else to watch
   * them choose — rather than looking at a lobby with a hole where the game
   * should be.
   */
  const needsGame = view !== null && view.phase === 'lobby' && !view.gameId;
  useEffect(() => {
    if (needsGame) navigate(gamesPath(code));
  }, [needsGame, code]);

  if (!view || view.phase === 'lobby') {
    return needsGame ? null : <Lobby room={room} code={code} />;
  }

  if (view.phase === 'results') {
    return <Results room={room} />;
  }

  const ui = getGameUI(view.gameId);
  const Table = ui?.Table;

  // The deal has happened but this client's own view has not landed yet.
  if (!Table || !room.game) {
    return (
      <main className="lobby-screen">
        <section className="sticker panel narrow">
          <h1 className="room-title">Dealing…</h1>
          <p className="form-note">
            {getGameInfo(view.gameId)?.name ?? view.gameId} is starting.
          </p>
        </section>
      </main>
    );
  }

  return (
    <Table
      view={room.game}
      me={room.me ?? ''}
      players={view.players}
      send={room.sendAction}
      events={room.log}
      eventSeq={room.logSeq}
    />
  );
}
