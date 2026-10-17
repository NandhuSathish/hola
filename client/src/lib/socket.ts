import { io, type Socket } from 'socket.io-client';

/**
 * Same origin as the page: in dev Vite proxies /socket.io to the server, in
 * production the server serves this bundle itself. So no URL to configure.
 */
export const socket: Socket = io({
  autoConnect: true,
  // We re-establish identity ourselves with playerId + secret (REFERENCE.md
  // section 6), so Socket.io's own recovery stays off.
  transports: ['websocket', 'polling'],
});

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';
