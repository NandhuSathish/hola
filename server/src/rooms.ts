import { randomBytes, randomUUID } from 'node:crypto';
import {
  DISCONNECT_GRACE_MS,
  EMPTY_ROOM_TTL_MS,
  MAX_PLAYERS,
  cleanName,
  firstFreeAvatar,
  isValidAvatar,
  isValidName,
  isPickable,
  makeRoomCode,
  normaliseRoomCode,
  settingsSpecs,
  uniqueName,
  type Player,
  type Room,
  type RoomView,
  type Seat,
} from '@holla/shared';

export type StoreOptions = {
  /** Injected so tests can drive time instead of waiting for it. */
  now?: () => number;
  rng?: () => number;
};

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const fail = <T = never>(error: string): Outcome<T> => ({ ok: false, error });

function newPlayer(name: string, avatar: string, now: number): Player {
  return {
    id: randomUUID(),
    secret: randomBytes(24).toString('base64url'),
    name,
    avatar,
    connected: true,
    joinedAt: now,
    lastSeen: now,
    spectator: false,
  };
}

/** Strip secrets before anything leaves the server (rule 2). */
export function toView(room: Room): RoomView {
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map(({ secret: _secret, ...rest }) => rest),
    phase: room.phase,
    gameId: room.gameId,
    settings: room.settings,
    totals: room.totals,
  };
}

export function createRoomStore(options: StoreOptions = {}) {
  const now = options.now ?? Date.now;
  const rng = options.rng ?? Math.random;

  const rooms = new Map<string, Room>();
  /** playerId -> room code, so a socket can find its room in one hop. */
  const playerIndex = new Map<string, string>();

  function get(code: string): Room | undefined {
    return rooms.get(normaliseRoomCode(code));
  }

  function roomOfPlayer(playerId: string): Room | undefined {
    const code = playerIndex.get(playerId);
    return code ? rooms.get(code) : undefined;
  }

  function freshCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      const code = makeRoomCode(rng);
      if (!rooms.has(code)) return code;
    }
    throw new Error('Could not find a free room code');
  }

  /**
   * Only runs when the host is no longer seated at all — they left, or the
   * sweep retired them after the 60s grace. A host who merely drops (closed
   * laptop, refresh, flaky wifi) keeps the crown until that window passes,
   * which is what REFERENCE.md section 5 asks for.
   *
   * The longest-present connected player takes over, falling back to the
   * longest-present player, so a room is never left without a host.
   */
  function reassignHost(room: Room): void {
    if (room.players.some((p) => p.id === room.hostId)) return;
    const byAge = [...room.players].sort((a, b) => a.joinedAt - b.joinedAt);
    const next = byAge.find((p) => p.connected) ?? byAge[0];
    if (next) room.hostId = next.id;
  }

  function create(input: { name: string; avatar: string; gameId: string }): Outcome<Seat> {
    if (!isValidName(input.name)) return fail('Pick a name first.');
    if (!isPickable(input.gameId)) return fail('That game is not ready to play yet.');
    const avatar = isValidAvatar(input.avatar) ? input.avatar : firstFreeAvatar([]);
    const at = now();

    const host = newPlayer(cleanName(input.name), avatar, at);
    const room: Room = {
      code: freshCode(),
      hostId: host.id,
      players: [host],
      phase: 'lobby',
      gameId: input.gameId,
      settings: settingsSpecs[input.gameId]?.defaults ?? null,
      game: null,
      totals: {},
      createdAt: at,
    };

    rooms.set(room.code, room);
    playerIndex.set(host.id, room.code);
    return ok({ code: room.code, playerId: host.id, secret: host.secret });
  }

  function join(input: { code: string; name: string; avatar: string }): Outcome<Seat> {
    const room = get(input.code);
    if (!room) return fail('No room with that code.');
    if (!isValidName(input.name)) return fail('Pick a name first.');
    if (room.players.length >= MAX_PLAYERS) return fail('That room is full.');

    const at = now();
    const name = uniqueName(input.name, room.players.map((p) => p.name));
    // Unique within a room where possible (REFERENCE.md section 5): a taken
    // avatar is quietly swapped for a free one, so a table of people who never
    // touched the picker still reads at a glance.
    const taken = room.players.map((p) => p.avatar);
    const wanted = input.avatar;
    const avatar =
      isValidAvatar(wanted) && !taken.includes(wanted) ? wanted : firstFreeAvatar(taken);

    const player = newPlayer(name, avatar, at);
    // Joining mid-round means watching until the next deal.
    player.spectator = room.phase !== 'lobby';

    room.players.push(player);
    playerIndex.set(player.id, room.code);
    return ok({ code: room.code, playerId: player.id, secret: player.secret });
  }

  /** Same seat back if the secret matches — this is what survives a refresh. */
  function rejoin(input: { code: string; playerId: string; secret: string }): Outcome<Room> {
    const room = get(input.code);
    if (!room) return fail('That room has closed.');

    const player = room.players.find((p) => p.id === input.playerId);
    if (!player) return fail('Your seat was given up.');
    if (player.secret !== input.secret) return fail('That seat belongs to someone else.');

    player.connected = true;
    player.lastSeen = now();
    playerIndex.set(player.id, room.code);
    reassignHost(room);
    return ok(room);
  }

  /** Deliberate exit: the seat is released immediately. */
  function leave(playerId: string): Room | undefined {
    const room = roomOfPlayer(playerId);
    if (!room) return undefined;

    room.players = room.players.filter((p) => p.id !== playerId);
    playerIndex.delete(playerId);
    reassignHost(room);

    if (room.players.length === 0) rooms.delete(room.code);
    return room;
  }

  /** Host swaps the game before the deal. Settings reset to that game's defaults. */
  function setGame(playerId: string, gameId: string): Outcome<Room> {
    const room = roomOfPlayer(playerId);
    if (!room) return fail('You are not in a room.');
    if (room.hostId !== playerId) return fail('Only the host can change the game.');
    if (room.phase !== 'lobby') return fail('You can only change the game before the deal.');
    if (!isPickable(gameId)) return fail('That game is not ready to play yet.');

    room.gameId = gameId;
    room.settings = settingsSpecs[gameId]?.defaults ?? null;
    return ok(room);
  }

  /**
   * The core never interprets settings (rule 4) — it hands the patch to the
   * active game's spec and stores whatever comes back.
   */
  function updateSettings(playerId: string, patch: unknown): Outcome<Room> {
    const room = roomOfPlayer(playerId);
    if (!room) return fail('You are not in a room.');
    if (room.hostId !== playerId) return fail('Only the host can change the rules.');
    if (room.phase !== 'lobby') return fail('You can only change the rules before the deal.');

    const spec = settingsSpecs[room.gameId];
    if (!spec) return fail('That game has no settings.');

    room.settings = spec.apply(room.settings, patch);
    return ok(room);
  }

  /** Dropped connection: hold the seat, let the sweep decide later. */
  function markDisconnected(playerId: string): Room | undefined {
    const room = roomOfPlayer(playerId);
    if (!room) return undefined;

    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.connected = false;
      player.lastSeen = now();
    }
    // Deliberately no reassignHost here: the seat is still theirs.
    return room;
  }

  /**
   * Removes players past the grace window and rooms that have sat empty.
   * Returns the rooms that changed so callers can broadcast.
   */
  function sweep(): {
    changed: Room[];
    closed: string[];
    removed: { code: string; playerIds: string[] }[];
  } {
    const at = now();
    const changed: Room[] = [];
    const closed: string[] = [];
    const removed: { code: string; playerIds: string[] }[] = [];

    for (const room of [...rooms.values()]) {
      const expired = room.players.filter(
        (p) => !p.connected && at - p.lastSeen >= DISCONNECT_GRACE_MS,
      );

      if (expired.length > 0) {
        for (const p of expired) playerIndex.delete(p.id);
        room.players = room.players.filter((p) => !expired.includes(p));
        reassignHost(room);
        changed.push(room);
        removed.push({ code: room.code, playerIds: expired.map((p) => p.id) });
      }

      const nobodyHere = room.players.every((p) => !p.connected);
      const emptyFor = at - Math.max(room.createdAt, ...room.players.map((p) => p.lastSeen));

      if (room.players.length === 0 || (nobodyHere && emptyFor >= EMPTY_ROOM_TTL_MS)) {
        for (const p of room.players) playerIndex.delete(p.id);
        rooms.delete(room.code);
        closed.push(room.code);
      }
    }

    return { changed, closed, removed };
  }

  /** Rooms with a round in progress, for the turn-timer tick. */
  function playing(): Room[] {
    return [...rooms.values()].filter((r) => r.phase === 'playing');
  }

  return {
    create,
    join,
    playing,
    rejoin,
    leave,
    setGame,
    updateSettings,
    markDisconnected,
    sweep,
    get,
    roomOfPlayer,
    get size() {
      return rooms.size;
    },
  };
}

export type RoomStore = ReturnType<typeof createRoomStore>;
