import type { useRoom } from '../lib/useRoom';
import { Confetti } from '../components/Flourish';
import './Results.css';

type Props = { room: ReturnType<typeof useRoom> };

/** Podium order: second on the left, winner raised in the middle, third right. */
const PODIUM = [
  { place: 2, height: 76, colour: 'var(--sky)' },
  { place: 1, height: 116, colour: 'var(--sun)' },
  { place: 3, height: 56, colour: 'var(--mint)' },
];

export function Results({ room }: Props) {
  const view = room.room;
  const payload = room.result;
  if (!view) return null;

  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? 'Someone';
  const avatarOf = (id: string) => view.players.find((p) => p.id === id)?.avatar ?? '🙂';
  const isHost = room.me === view.hostId;
  const hostName = nameOf(view.hostId);

  const totals = payload?.totals ?? view.totals;
  // Fewest cards left is the better finish; the winner is always first.
  const ranked = payload
    ? [...payload.result.scores].sort((a, b) => a.cardsLeft - b.cardsLeft)
    : [];
  const winnerPoints =
    payload?.result.scores.find((s) => s.playerId === payload.result.winnerId)?.points ?? 0;

  return (
    <main className="results-screen">
      {payload && <Confetti />}

      <div className="results-inner">
        {payload ? (
          <>
            <div className="winner">
              <span className="winner-crown" aria-hidden="true">👑</span>
              <span className="winner-av">{avatarOf(payload.result.winnerId)}</span>
              <h1>{nameOf(payload.result.winnerId)} wins</h1>
              <p className="sub">Took {winnerPoints} points off the table.</p>
            </div>

            {ranked.length >= 3 && (
              <div className="podium">
                {PODIUM.map(({ place, height, colour }) => {
                  const row = ranked[place - 1];
                  if (!row) return null;
                  return (
                    <div className="step" key={place}>
                      <span className="step-av">{avatarOf(row.playerId)}</span>
                      <span className="step-name">{nameOf(row.playerId)}</span>
                      <div className="block" style={{ background: colour, height }}>
                        {place}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="sticker scores">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th className="num">Remaining</th>
                    <th className="num">This round</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row) => (
                    <tr key={row.playerId} className={row.playerId === room.me ? 'mine' : undefined}>
                      <td>
                        <span className="who">
                          <span className="who-av">{avatarOf(row.playerId)}</span>
                          {nameOf(row.playerId)}
                          {row.playerId === room.me && <em> (you)</em>}
                        </span>
                      </td>
                      <td className="num">{row.cardsLeft}</td>
                      <td className="num">{row.points}</td>
                      <td className="num strong">{totals[row.playerId] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="winner">
            <h1>Round over</h1>
            <p className="sub">Nobody went out — the table emptied first.</p>
          </div>
        )}

        <div className="results-actions">
          {isHost ? (
            <>
              <button type="button" className="btn btn-pink deal" onClick={() => room.nextRound('again')}>
                Deal another round
              </button>
              <button type="button" className="btn" onClick={() => room.nextRound('lobby')}>
                Back to lobby
              </button>
              <button type="button" className="btn small" onClick={() => room.nextRound('reset')}>
                Reset scores
              </button>
            </>
          ) : (
            <p className="host-note">Waiting for {hostName} to deal again.</p>
          )}
        </div>

        {room.error && <p className="form-error" role="alert">{room.error}</p>}
      </div>
    </main>
  );
}
