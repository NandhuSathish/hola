import {
  modules,
  type GameEvent,
  type GameModule,
  type PlayerRef,
  type Room,
  type RoundResult,
} from '@holla/shared';

/**
 * Drives whichever GameModule a room has chosen. The core never names a game
 * (CLAUDE.md rule 4): everything here goes through the registry and the
 * interface, so adding a game needs no changes in this file.
 *
 * All randomness and time are injected, because the engine may not reach for
 * either itself (rule 3).
 */
export type RunnerDeps = {
  now?: () => number;
  rng?: () => number;
};

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const fail = <T = never>(error: string): Outcome<T> => ({ ok: false, error });

/** Only seated players take part; spectators watch until the next deal. */
function seatedRefs(room: Room): PlayerRef[] {
  return room.players
    .filter((p) => !p.spectator)
    .map((p) => ({ id: p.id, name: p.name, look: p.look }));
}

export function createGameRunner(deps: RunnerDeps = {}) {
  const now = deps.now ?? Date.now;
  const rng = deps.rng ?? Math.random;
  const ctx = () => ({ now: now(), rng });

  function moduleFor(room: Room): GameModule | undefined {
    return modules[room.gameId];
  }

  function start(room: Room): Outcome<{ events: GameEvent[] }> {
    if (room.phase !== 'lobby') return fail('The game has already started.');

    const game = moduleFor(room);
    if (!game) return fail('That game is not ready to play yet.');

    // Everyone sitting out rejoins the table for a fresh deal.
    for (const player of room.players) player.spectator = false;

    const players = seatedRefs(room);
    if (players.length < game.minPlayers) {
      return fail(`${game.name} needs at least ${game.minPlayers} players.`);
    }
    if (players.length > game.maxPlayers) {
      return fail(`${game.name} tops out at ${game.maxPlayers} players.`);
    }

    room.game = game.setup(players, room.settings, ctx());
    room.phase = 'playing';
    return ok({ events: [{ kind: 'deal', text: 'a new round was dealt' }] });
  }

  function act(room: Room, playerId: string, action: unknown): Outcome<{ events: GameEvent[] }> {
    if (room.phase !== 'playing' || room.game === null) return fail('No round is running.');

    const game = moduleFor(room);
    if (!game) return fail('That game is not loaded.');

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return fail('You are not in this room.');
    if (player.spectator) return fail('You are watching this round.');

    const result = game.onAction(room.game, playerId, action, ctx());
    if (!result.ok) return fail(result.error);

    room.game = result.state;
    settleIfOver(room, game);
    return ok({ events: result.events });
  }

  /** Called on a timer. Returns null when nothing actually changed. */
  function tick(room: Room): { events: GameEvent[] } | null {
    if (room.phase !== 'playing' || room.game === null) return null;

    const game = moduleFor(room);
    if (!game?.onTick) return null;

    const result = game.onTick(room.game, ctx());
    if (!result) return null;

    room.game = result.state;
    settleIfOver(room, game);
    return { events: result.events };
  }

  /**
   * Fold a player out of the round, whether they walked or were retired past
   * the grace window. The name comes in rather than being looked up: on both
   * paths they are already out of `room.players` by the time anyone reports it.
   */
  function playerLeft(
    room: Room,
    playerId: string,
    name = 'Someone',
  ): { events: GameEvent[] } | null {
    if (room.phase !== 'playing' || room.game === null) return null;

    const game = moduleFor(room);
    if (!game) return null;

    room.game = game.onPlayerLeft(room.game, playerId);
    settleIfOver(room, game);
    return { events: [{ kind: 'left', text: `${name} left the table` }] };
  }

  /**
   * Moves the room to results the moment the module says the round is done,
   * and banks the points. Winner takes all, so most rows add zero.
   */
  function settleIfOver(room: Room, game: GameModule): void {
    if (room.game === null) return;
    const result = game.getResult(room.game);
    if (!result) return;

    room.phase = 'results';
    for (const row of result.scores) {
      room.totals[row.playerId] = (room.totals[row.playerId] ?? 0) + row.points;
    }
  }

  function result(room: Room): RoundResult | null {
    const game = moduleFor(room);
    if (!game || room.game === null) return null;
    return game.getResult(room.game);
  }

  /** What this player is allowed to see. Spectators never get a hand. */
  function viewFor(room: Room, playerId: string): unknown | null {
    const game = moduleFor(room);
    if (!game || room.game === null) return null;

    const player = room.players.find((p) => p.id === playerId);
    if (!player || player.spectator) return game.getSpectatorView(room.game);
    return game.getPlayerView(room.game, playerId);
  }

  /** Host chose what happens after the results screen. */
  function next(room: Room, mode: 'again' | 'lobby' | 'reset'): Outcome<{ events: GameEvent[] }> {
    if (room.phase !== 'results') return fail('The round is still going.');

    if (mode === 'again') {
      room.phase = 'lobby';
      room.game = null;
      return start(room);
    }

    room.phase = 'lobby';
    room.game = null;
    if (mode === 'reset') room.totals = {};
    return ok({ events: [] });
  }

  return { start, act, tick, playerLeft, result, viewFor, next };
}

export type GameRunner = ReturnType<typeof createGameRunner>;
