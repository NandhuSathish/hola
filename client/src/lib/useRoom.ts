import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ack, AckWith, RoomView, Seat } from '@holla/shared';
import { socket, type ConnectionState } from './socket';
import { clearSeat, loadSeat, saveSeat, type Profile } from './session';
import { navigate, roomPath } from './route';

type State = {
  connection: ConnectionState;
  room: RoomView | null;
  me: string | null;
  error: string | null;
  busy: boolean;
};

export function useRoom(codeFromUrl: string | null) {
  const [state, setState] = useState<State>({
    connection: socket.connected ? 'connected' : 'connecting',
    room: null,
    me: loadSeat(codeFromUrl ?? '')?.playerId ?? null,
    error: null,
    busy: false,
  });

  // Kept in a ref so the socket handlers below always see the current code
  // without needing to be torn down and re-attached on every change.
  const codeRef = useRef<string | null>(codeFromUrl);
  codeRef.current = codeFromUrl;

  const patch = useCallback((next: Partial<State>) => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  /**
   * Identity is ours, not Socket.io's: whenever the transport comes back we
   * re-present playerId + secret and the server hands the same seat back.
   */
  const rejoin = useCallback(() => {
    const code = codeRef.current;
    if (!code) return;
    const seat = loadSeat(code);
    if (!seat) return;

    socket.emit('room:rejoin', seat, (res: Ack) => {
      if (res.ok) {
        patch({ me: seat.playerId, error: null });
      } else {
        clearSeat(code);
        patch({ me: null, room: null, error: res.error });
      }
    });
  }, [patch]);

  useEffect(() => {
    const onConnect = () => {
      patch({ connection: 'connected' });
      rejoin();
    };
    const onDisconnect = () => patch({ connection: 'disconnected' });
    const onState = (view: RoomView) => patch({ room: view, error: null });
    const onClosed = (payload: { reason: string }) => {
      const code = codeRef.current;
      if (code) clearSeat(code);
      patch({ room: null, me: null, error: payload.reason });
      navigate('/');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);
    socket.on('room:closed', onClosed);

    if (socket.connected) rejoin();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
      socket.off('room:closed', onClosed);
    };
  }, [patch, rejoin]);

  // Landing on /r/CODE in a fresh tab: try the stored seat for that room.
  useEffect(() => {
    if (codeFromUrl && socket.connected) rejoin();
  }, [codeFromUrl, rejoin]);

  const createRoom = useCallback(
    (profile: Profile, gameId = 'last-card') => {
      patch({ busy: true, error: null });
      socket.emit(
        'room:create',
        { ...profile, gameId },
        (res: AckWith<Seat>) => {
          if (!res.ok) {
            patch({ busy: false, error: res.error });
            return;
          }
          saveSeat(res);
          patch({ busy: false, me: res.playerId });
          navigate(roomPath(res.code));
        },
      );
    },
    [patch],
  );

  const joinRoom = useCallback(
    (code: string, profile: Profile) => {
      patch({ busy: true, error: null });
      socket.emit('room:join', { code, ...profile }, (res: AckWith<Seat>) => {
        if (!res.ok) {
          patch({ busy: false, error: res.error });
          return;
        }
        saveSeat(res);
        patch({ busy: false, me: res.playerId });
        navigate(roomPath(res.code));
      });
    },
    [patch],
  );

  const setGame = useCallback(
    (gameId: string) => {
      patch({ error: null });
      socket.emit('room:setGame', { gameId }, (res: Ack) => {
        if (!res.ok) patch({ error: res.error });
        else navigate(roomPath(codeRef.current ?? ''));
      });
    },
    [patch],
  );

  const updateSettings = useCallback(
    (settingsPatch: Record<string, unknown>) => {
      socket.emit('room:settings', settingsPatch, (res: Ack) => {
        if (!res.ok) patch({ error: res.error });
      });
    },
    [patch],
  );

  const leaveRoom = useCallback(() => {
    const code = codeRef.current;
    socket.emit('room:leave', () => {
      if (code) clearSeat(code);
      patch({ room: null, me: null, error: null });
      navigate('/');
    });
  }, [patch]);

  return { ...state, createRoom, joinRoom, setGame, updateSettings, leaveRoom };
}
