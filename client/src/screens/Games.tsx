import { catalogue } from '@holla/shared';
import type { useRoom } from '../lib/useRoom';
import { navigate, roomPath } from '../lib/route';
import { loadProfile } from '../lib/session';
import { HandCricketArt, LastCardArt, SnakesArt } from '../components/GameArt';
import './Games.css';

type Props = {
  room: ReturnType<typeof useRoom>;
  /** Set when the host is swapping the game of a room that already exists. */
  code: string | null;
};

const ART: Record<string, () => React.ReactElement> = {
  'last-card': LastCardArt,
  'snakes-ladders': SnakesArt,
  'hand-cricket': HandCricketArt,
};

export function Games({ room, code }: Props) {
  const inRoom = code !== null;
  const view = room.room;
  // Outside a room you are about to be the host of one, so you may pick.
  const isHost = !inRoom || !view || view.hostId === room.me;
  // A room that has not chosen yet has no lobby to go back to.
  const chosen = Boolean(view?.gameId);
  const hostName = view?.players.find((p) => p.id === view.hostId)?.name ?? 'The host';

  function pick(gameId: string) {
    if (!isHost) return;
    if (inRoom) room.setGame(gameId);
    else room.createRoom(loadProfile(), gameId);
  }

  return (
    <main className="games-screen">
      <div className="games-head">
        <h1>{isHost ? 'Pick a game' : 'Choosing a game'}</h1>
        <p>
          {isHost
            ? 'Your room and seats stay the same whichever one you choose.'
            : `${hostName} is picking. Everyone lands in it together.`}
          {isHost && chosen && ' Changing it resets the house rules.'}
        </p>
        {inRoom && chosen && (
          <button type="button" className="btn small" onClick={() => navigate(roomPath(code))}>
            Back to the lobby
          </button>
        )}
      </div>

      {room.error && <p className="form-error" role="alert">{room.error}</p>}

      <div className="ggrid">
        {catalogue.map((game) => {
          const Art = ART[game.id];
          const soon = game.status === 'soon';
          return (
            <article className={`sticker gcard${soon ? ' soon' : ''}`} key={game.id}>
              <div className="gart">
                <span className={`gbadge ${soon ? 'soon' : 'ready'}`}>
                  {soon ? 'Coming soon' : 'Ready'}
                </span>
                {Art && <Art />}
              </div>
              <div className="gbody">
                <h3>{game.name}</h3>
                <p>{game.tagline}</p>
                <div className="gmeta">
                  <span>{game.minPlayers}–{game.maxPlayers} players</span>
                  <span>{game.estimate}</span>
                </div>
                <button
                  type="button"
                  className={`btn${soon || !isHost ? '' : ' btn-pink'}`}
                  disabled={soon || !isHost || room.busy}
                  onClick={() => pick(game.id)}
                >
                  {soon
                    ? 'Coming soon'
                    : !isHost
                      ? `${hostName} decides`
                      : chosen
                        ? `Switch to ${game.name}`
                        : `Play ${game.name}`}
                </button>
              </div>
            </article>
          );
        })}

        <div className="gnext">
          <div>
            <div className="plus">+</div>
            <b>More games on the way</b>
            <span>Each one drops in as its own module, so seats, reconnects and voice never get rebuilt.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
