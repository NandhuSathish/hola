import type { useRoom } from '../lib/useRoom';
import './Results.css';

type Props = { room: ReturnType<typeof useRoom> };

/**
 * Phase 3a keeps this plain: who won, what everyone held, and where to go
 * next. The podium, confetti and animation land in 3b.
 */
export function Results({ room }: Props) {
  const view = room.room;
  const payload = room.result;
  if (!view) return null;

  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? 'Someone';
  const avatarOf = (id: string) => view.players.find((p) => p.id === id)?.avatar ?? '🙂';
  const isHost = room.me === view.hostId;

  const rows = payload
    ? [...payload.result.scores].sort((a, b) => a.cardsLeft - b.cardsLeft)
    : [];
  const totals = payload?.totals ?? view.totals;

  return (
    <main className="results-screen">
      <div className="results-inner">
        {payload ? (
          <>
            <div className="winner">
              <span className="winner-av">{avatarOf(payload.result.winnerId)}</span>
              <h1>{nameOf(payload.result.winnerId)} wins</h1>
              <p className="sub">
                Took {payload.result.scores.find((s) => s.playerId === payload.result.winnerId)?.points}{' '}
                points off the table.
              </p>
            </div>

            <div className="sticker scores">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th className="num">Cards left</th>
                    <th className="num">This round</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.playerId}>
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
              <button type="button" className="btn btn-pink" onClick={() => room.nextRound('again')}>
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
            <p className="host-note">
              Waiting for {nameOf(view.hostId)} to deal again.
            </p>
          )}
        </div>

        {room.error && <p className="form-error" role="alert">{room.error}</p>}
      </div>
    </main>
  );
}
