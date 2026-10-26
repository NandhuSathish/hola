import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import {
  SHARED_VERSION,
  type GameEvent,
  type Room,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
  REACTION_EVERY_MS,
  isReaction,
} from '@holla/shared';
import { createRoomStore, toView } from './rooms.js';
import { createGameRunner } from './gameRunner.js';

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
const runner = createGameRunner();

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

const playerRoom = (playerId: string) => 'p:' + playerId;

function broadcast(code: string): void {
  const room = store.get(code);
  if (room) io.to(code).emit('room:state', toView(room));
}

/** One player's own view — never anyone else's hand (rule 2). */
function sendView(room: Room, playerId: string): void {
  const view = runner.viewFor(room, playerId);
  if (view !== null) io.to(playerRoom(playerId)).emit('game:view', view);
}

/**
 * Everything a client needs after arriving or coming back: its own view, and
 * the round's result if it walked in on the results screen. Without the
 * result, a refresh there would show an empty scoreboard.
 */
function catchUp(room: Room, playerId: string): void {
  sendView(room, playerId);
  if (room.phase !== 'results') return;
  const result = runner.result(room);
  if (result) io.to(playerRoom(playerId)).emit('game:result', { result, totals: room.totals });
}

/** Everyone gets their own view; nobody gets a broadcast of the whole state. */
function sendAllViews(room: Room): void {
  for (const player of room.players) sendView(room, player.id);
}

function sendEvents(room: Room, events: GameEvent[]): void {
  if (events.length > 0) io.to(room.code).emit('game:events', events);
}

function sendResultIfDone(room: Room): void {
  if (room.phase !== 'results') return;
  const result = runner.result(room);
  if (result) io.to(room.code).emit('game:result', { result, totals: room.totals });
}

/** The usual trio after anything that moves a round along. */
function publish(room: Room, events: GameEvent[]): void {
  broadcast(room.code);
  sendAllViews(room);
  sendEvents(room, events);
  sendResultIfDone(room);
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

/** Unique per throw, so the same emoji twice still animates twice. */
let reactionId = 0;

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
    void socket.join(playerRoom(res.value.playerId));

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
    void socket.join(playerRoom(res.value.playerId));

    ack({ ok: true, ...res.value });
    broadcast(res.value.code);

    // Walking in on a round in progress: hand over the spectator view at once,
    // otherwise this client sits on an empty table until someone else moves.
    const joined = store.get(res.value.code);
    if (joined) catchUp(joined, res.value.playerId);
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
    void socket.join(playerRoom(input.playerId));

    ack({ ok: true });
    broadcast(res.value.code);
    // A refreshed client has no game state, so hand it straight back.
    catchUp(res.value, input.playerId);
  });

  socket.on('room:leave', (ack) => {
    const playerId = socket.data.playerId;
    if (!playerId) {
      ack({ ok: false, error: 'You are not in a room.' });
      return;
    }

    // Fold them out of the round before the seat goes. Without this a
    // player who leaves mid-game keeps a token on the board that still takes
    // turns and can win a game they walked out of — the sweep did this for a
    // dropped connection, but a deliberate exit never went through it.
    const playing = store.roomOfPlayer(playerId);
    const name = playing?.players.find((p) => p.id === playerId)?.name;
    const folded = playing ? runner.playerLeft(playing, playerId, name) : null;

    const room = store.leave(playerId);
    if (room) void socket.leave(room.code);
    socket.data.playerId = undefined;
    socket.data.code = undefined;

    ack({ ok: true });
    if (!room) return;
    if (folded) publish(room, folded.events);
    else broadcast(room.code);
  });

  socket.on('room:look', (input, ack) => {
    const playerId = socket.data.playerId;
    if (!playerId) {
      ack({ ok: false, error: 'You are not in a room.' });
      return;
    }
    const res = store.setLook(playerId, input?.look);
    if (!res.ok) {
      ack({ ok: false, error: res.error });
      return;
    }
    ack({ ok: true });
    broadcast(res.value.code);
  });

  /*
   * Reactions are fire and forget: no acknowledgement, and a bad one is
   * dropped rather than argued about. The rate limit is per connection and
   * deliberately generous for a person and useless for a script.
   */
  let lastReactionAt = 0;
  socket.on('room:react', (input) => {
    const playerId = socket.data.playerId;
    const code = socket.data.code;
    if (!playerId || !code) return;
    if (!isReaction(input?.emoji)) return;

    const at = Date.now();
    if (at - lastReactionAt < REACTION_EVERY_MS) return;
    lastReactionAt = at;

    reactionId += 1;
    io.to(code).emit('room:reaction', { playerId, emoji: input.emoji, id: reactionId });
  });

  socket.on('room:setGame', (input, ack) => {
    const playerId = socket.data.playerId;
    if (!playerId) {
      ack({ ok: false, error: 'You are not in a room.' });
      return;
    }
    const res = store.setGame(playerId, input.gameId);
    if (!res.ok) {
      ack({ ok: false, error: res.error });
      return;
    }
    // Broadcast before the ack: the client navigates to the lobby off the
    // back of this, and a lobby that has not heard about the new game yet
    // bounces straight back to the picker. Socket.io keeps a connection's
    // messages in order, so sending the state first is enough.
    broadcast(res.value.code);
    ack({ ok: true });
  });

  socket.on('room:settings', (patch, ack) => {
    const playerId = socket.data.playerId;
    if (!playerId) {
      ack({ ok: false, error: 'You are not in a room.' });
      return;
    }
    const res = store.updateSettings(playerId, patch);
    if (!res.ok) {
      ack({ ok: false, error: res.error });
      return;
    }
    ack({ ok: true });
    broadcast(res.value.code);
  });

  socket.on('game:start', (ack) => {
    const playerId = socket.data.playerId;
    const room = playerId ? store.roomOfPlayer(playerId) : undefined;
    if (!playerId || !room) {
      ack({ ok: false, error: 'You are not in a room.' });
      return;
    }
    if (room.hostId !== playerId) {
      ack({ ok: false, error: 'Only the host can start the game.' });
      return;
    }

    const res = runner.start(room);
    if (!res.ok) {
      ack({ ok: false, error: res.error });
      return;
    }

    ack({ ok: true });
    publish(room, res.value.events);
    console.log('[game] ' + room.code + ' dealt ' + room.gameId);
  });

  socket.on('game:action', (action, ack) => {
    const playerId = socket.data.playerId;
    const room = playerId ? store.roomOfPlayer(playerId) : undefined;
    if (!playerId || !room) {
      ack({ ok: false, error: 'You are not in a room.' });
      return;
    }

    const res = runner.act(room, playerId, action);
    if (!res.ok) {
      // A refused move is normal play, not a failure: tell just this player,
      // and resend their view so a hopeful click cannot desync them.
      ack({ ok: false, error: res.error });
      sendView(room, playerId);
      return;
    }

    ack({ ok: true });
    publish(room, res.value.events);
  });

  socket.on('game:next', (input, ack) => {
    const playerId = socket.data.playerId;
    const room = playerId ? store.roomOfPlayer(playerId) : undefined;
    if (!playerId || !room) {
      ack({ ok: false, error: 'You are not in a room.' });
      return;
    }
    if (room.hostId !== playerId) {
      ack({ ok: false, error: 'Only the host can do that.' });
      return;
    }

    const res = runner.next(room, input.mode);
    if (!res.ok) {
      ack({ ok: false, error: res.error });
      return;
    }

    ack({ ok: true });
    publish(room, res.value.events);
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
  const { changed, closed, removed } = store.sweep();

  // Anyone retired past the grace window leaves the round properly, so their
  // cards go back to the pile rather than vanishing.
  for (const { code, gone } of removed) {
    const room = store.get(code);
    if (!room) continue;
    for (const { id, name } of gone) {
      const res = runner.playerLeft(room, id, name);
      if (res) publish(room, res.events);
    }
  }

  for (const room of changed) {
    if (store.get(room.code)) broadcast(room.code);
  }
  for (const code of closed) {
    io.to(code).emit('room:closed', { reason: 'Everyone left, so the room closed.' });
    console.log(`[room] ${code} closed`);
  }
}, SWEEP_EVERY_MS).unref();

/**
 * Turn timers. The tick runs often, but only a fired timeout changes anything,
 * and only then does anyone get a message — the countdown itself is drawn
 * client-side from turnEndsAt (REFERENCE.md section 6).
 */
const TICK_EVERY_MS = 1_000;
setInterval(() => {
  for (const room of store.playing()) {
    const res = runner.tick(room);
    if (res) publish(room, res.events);
  }
}, TICK_EVERY_MS).unref();

httpServer.listen(PORT, () => {
  console.log(
    `[holla] server on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`,
  );
});
