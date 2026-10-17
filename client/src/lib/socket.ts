import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@holla/shared';

/**
 * Same origin as the page: in dev Vite proxies /socket.io to the server, in
 * production the server serves this bundle itself. So no URL to configure.
 *
 * Note the type parameters are reversed relative to the server — what the
 * server emits is what we listen for.
 */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: true,
  // We re-establish identity ourselves with playerId + secret
  // (REFERENCE.md section 6), so Socket.io's own recovery stays off.
  transports: ['websocket', 'polling'],
});

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

/** Promise wrapper so callers can await an acknowledgement. */
export function emitWithAck<E extends keyof ClientToServerEvents, R>(
  event: E,
  ...args: unknown[]
): Promise<R> {
  return new Promise((resolve) => {
    (socket.emit as unknown as (e: E, ...a: unknown[]) => void)(event, ...args, resolve);
  });
}
