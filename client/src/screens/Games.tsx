import { catalogue } from '@holla/shared';
import type { useRoom } from '../lib/useRoom';
import { navigate, roomPath } from '../lib/route';
import { loadProfile } from '../lib/session';
import { LastCardArt, SnakesArt } from '../components/GameArt';
import './Games.css';

type Props = {
  room: ReturnType<typeof useRoom>;
  /** Set when the host is swapping the game of a room that already exists. */
  code: string | null;
};

const ART: Record<string, () => React.ReactElement> = {
  'last-card': LastCardArt,
  'snakes-ladders': SnakesArt,
};

export function Games({ room, code }: Props) {
  const changing = code !== null;

  function pick(gameId: string) {
    if (changing) room.setGame(gameId);
    else room.createRoom(loadProfile(), gameId);
  }

  return (
    <main className="games-screen">
      <div className="games-head">
        <h1>Pick a game</h1>
        <p>
          Your room, seats and voice chat stay the same whichever one you choose.
          {changing ? ' Changing it resets the house rules.' : ' The host can change it any time before the deal.'}
        </p>
        {changing && (
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
                  className={`btn${soon ? '' : ' btn-pink'}`}
                  disabled={soon || room.busy}
                  onClick={() => pick(game.id)}
                >
                  {soon ? 'Coming soon' : changing ? `Switch to ${game.name}` : `Play ${game.name}`}
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
