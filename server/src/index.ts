import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import {
  SHARED_VERSION,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from '@holla/shared';
import { createRoomStore, toView } from './rooms.js';

const PORT = Number(process.env['PORT'] ?? 3000);
const isProduction = process.env['NODE_ENV'] === 'production';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

const app = express();
const httpServer = createServer(app);

// Same origin in production, and Vite proxies to us in dev, so no CORS setup.
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer);

const store = createRoomStore();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, shared: SHARED_VERSION, uptime: Math.round(process.uptime()) });
});

if (isProduction) {
  app.use(express.static(clientDist));
  // Express 5 dropped the bare '*' path. path-to-regexp v8 spells a catch-all
  // as a named wildcard, so deep links like /r/KPXJ reach the SPA. '/' is
  // already handled by express.static serving index.html.
  app.get('/*splat', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

function broadcast(code: string): void {
  const room = store.get(code);
  if (room) io.to(code).emit('room:state', toView(room));
}

/**
 * No accounts means anyone could spin up rooms in a loop, so each connection
 * gets a small allowance. Cheap insurance for an in-memory store.
 */
const CREATE_LIMIT = 10;
const createCounts = new WeakMap<object, number>();
function overCreateLimit(key: object): boolean {
  const used = (createCounts.get(key) ?? 0) + 1;
  createCounts.set(key, used);
  return used > CREATE_LIMIT;
}

io.on('connection', (socket) => {
  socket.on('room:create', (input, ack) => {
    if (overCreateLimit(socket)) {
      ack({ ok: false, error: 'Too many rooms from this tab. Reload and try again.' });
      return;
    }

    const res = store.create(input);
    if (!res.ok) {
      ack({ ok: false, error: res.error });
      return;
    }

    socket.data.playerId = res.value.playerId;
    socket.data.code = res.value.code;
    void socket.join(res.value.code);

    ack({ ok: true, ...res.value });
    broadcast(res.value.code);
    console.log(`[room] ${res.value.code} created`);
  });

  socket.on('room:join', (input, ack) => {
    const res = store.join(input);
    if (!res.ok) {
      ack({ ok: false, error: res.error });
      return;
    }

    socket.data.playerId = res.value.playerId;
    socket.data.code = res.value.code;
    void socket.join(res.value.code);

    ack({ ok: true, ...res.value });
    broadcast(res.value.code);
  });

  socket.on('room:rejoin', (input, ack) => {
    const res = store.rejoin(input);
    if (!res.ok) {
      ack({ ok: false, error: res.error });
      return;
    }

    socket.data.playerId = input.playerId;
    socket.data.code = res.value.code;
    void socket.join(res.value.code);

    ack({ ok: true });
    broadcast(res.value.code);
  });

  socket.on('room:leave', (ack) => {
    const playerId = socket.data.playerId;
    if (!playerId) {
      ack({ ok: false, error: 'You are not in a room.' });
      return;
    }

    const room = store.leave(playerId);
    if (room) void socket.leave(room.code);
    socket.data.playerId = undefined;
    socket.data.code = undefined;

    ack({ ok: true });
    if (room) broadcast(room.code);
  });

  socket.on('disconnect', () => {
    const playerId = socket.data.playerId;
    if (!playerId) return;
    const room = store.markDisconnected(playerId);
    if (room) broadcast(room.code);
  });
});

// Retires seats past the 60s grace window and rooms nobody came back to.
const SWEEP_EVERY_MS = 5_000;
setInterval(() => {
  const { changed, closed } = store.sweep();
  for (const room of changed) {
    if (store.get(room.code)) broadcast(room.code);
  }
  for (const code of closed) {
    io.to(code).emit('room:closed', { reason: 'Everyone left, so the room closed.' });
    console.log(`[room] ${code} closed`);
  }
}, SWEEP_EVERY_MS).unref();

httpServer.listen(PORT, () => {
  console.log(
    `[holla] server on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`,
  );
});
