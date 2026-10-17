import { useEffect, useState } from 'react';
import { SHARED_VERSION } from '@holla/shared';
import { socket, type ConnectionState } from '../lib/socket';
import './Home.css';

type Health = { ok: boolean; shared: string; uptime: number };

/**
 * Phase 0 placeholder. It wears the mock's clothes and proves the three pieces
 * are wired together — the real Home screen (name, avatar, mic check, join)
 * arrives in Phase 1.
 */
export function Home() {
  const [connection, setConnection] = useState<ConnectionState>(
    socket.connected ? 'connected' : 'connecting',
  );
  const [socketId, setSocketId] = useState<string | undefined>(socket.id);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    const onConnect = () => {
      setConnection('connected');
      setSocketId(socket.id);
      console.log('[holla] socket connected', socket.id);
    };
    const onDisconnect = (reason: string) => {
      setConnection('disconnected');
      setSocketId(undefined);
      console.log('[holla] socket disconnected:', reason);
    };
    const onHello = (payload: { shared: string }) => {
      console.log('[holla] server said hello, shared v' + payload.shared);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('hello', onHello);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('hello', onHello);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: Health) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const label =
    connection === 'connected'
      ? 'Connected'
      : connection === 'connecting'
        ? 'Connecting…'
        : 'Disconnected';

  return (
    <main className="home-screen">
      <div className="home-inner">
        <h1 className="wordmark" aria-label="holla!">
          <span>h</span>
          <span>o</span>
          <span>l</span>
          <span>l</span>
          <span>a</span>
          <span>!</span>
        </h1>

        <p className="tagline">
          Card nights with your crew. Voice is built in, so just open the link and start talking.
        </p>

        <div className="facts">
          <span className="fact">Up to 15 players</span>
          <span className="fact">Nothing to install</span>
          <span className="fact">Works on phones</span>
        </div>

        <section className="sticker boot-card">
          <h2>Scaffold check</h2>

          <div className="boot-row">
            <span>Socket</span>
            <span className={`pill ${connection}`}>{label}</span>
          </div>
          <div className="boot-row">
            <span>Socket id</span>
            <span>{socketId ?? '—'}</span>
          </div>
          <div className="boot-row">
            <span>/api/health</span>
            <span className={`pill ${health?.ok ? 'connected' : 'disconnected'}`}>
              {health?.ok ? 'ok' : 'no answer'}
            </span>
          </div>
          <div className="boot-row">
            <span>shared package</span>
            <span>v{SHARED_VERSION}</span>
          </div>

          <p className="boot-note">
            This panel only exists in Phase 0. If all four rows look right, the client, server and
            shared package are talking to each other.
          </p>
        </section>
      </div>
    </main>
  );
}
