import { beforeEach, describe, expect, it } from 'vitest';
import { DISCONNECT_GRACE_MS, EMPTY_ROOM_TTL_MS, MAX_PLAYERS } from '@holla/shared';
import { createRoomStore, toView, type RoomStore } from './rooms.js';

let clock = 1_000_000;
let store: RoomStore;

/** Deterministic codes so assertions never flake. */
function seqRng() {
  let i = 0;
  return () => ((i++ * 7) % 24) / 24;
}

function seat(name: string, code?: string) {
  const res = code
    ? store.join({ code, name, avatar: '🦊' })
    : store.create({ name, avatar: '🐯', gameId: 'last-card' });
  if (!res.ok) throw new Error(res.error);
  return res.value;
}

beforeEach(() => {
  clock = 1_000_000;
  store = createRoomStore({ now: () => clock, rng: seqRng() });
});

describe('creating and joining', () => {
  it('seats the creator as host', () => {
    const host = seat('Nandhu');
    const room = store.get(host.code)!;
    expect(room.hostId).toBe(host.playerId);
    expect(room.players).toHaveLength(1);
    expect(room.phase).toBe('lobby');
  });

  it('accepts the code case-insensitively', () => {
    const host = seat('Nandhu');
    expect(store.get(host.code.toLowerCase())).toBeDefined();
  });

  it('refuses a blank name', () => {
    expect(store.create({ name: '   ', avatar: '🐯', gameId: 'last-card' }).ok).toBe(false);
  });

  it('refuses an unknown code', () => {
    const res = store.join({ code: 'ZZZZ', name: 'Sam', avatar: '🦊' });
    expect(res).toEqual({ ok: false, error: 'No room with that code.' });
  });

  it('makes clashing names unique', () => {
    const host = seat('Sam');
    seat('Sam', host.code);
    seat('Sam', host.code);
    expect(store.get(host.code)!.players.map((p) => p.name)).toEqual(['Sam', 'Sam2', 'Sam3']);
  });

  it('gives everyone a different avatar, even if they all ask for the same one', () => {
    const host = store.create({ name: 'Host', avatar: '🐯', gameId: 'last-card' });
    if (!host.ok) throw new Error(host.error);
    for (const who of ['A', 'B', 'C']) {
      store.join({ code: host.value.code, name: who, avatar: '🐯' });
    }
    const avatars = store.get(host.value.code)!.players.map((p) => p.avatar);
    expect(new Set(avatars).size).toBe(4);
    expect(avatars[0]).toBe('🐯');
  });

  it('keeps a free avatar the player actually chose', () => {
    const host = store.create({ name: 'Host', avatar: '🐯', gameId: 'last-card' });
    if (!host.ok) throw new Error(host.error);
    store.join({ code: host.value.code, name: 'B', avatar: '🦄' });
    expect(store.get(host.value.code)!.players[1]?.avatar).toBe('🦄');
  });

  it('fills to 15 and then refuses', () => {
    const host = seat('Host');
    for (let i = 1; i < MAX_PLAYERS; i++) seat(`P${i}`, host.code);
    expect(store.get(host.code)!.players).toHaveLength(MAX_PLAYERS);
    const overflow = store.join({ code: host.code, name: 'Late', avatar: '🦊' });
    expect(overflow).toEqual({ ok: false, error: 'That room is full.' });
  });
});

describe('rejoining', () => {
  it('gives the same seat back with the right secret', () => {
    const host = seat('Nandhu');
    store.markDisconnected(host.playerId);
    expect(store.get(host.code)!.players[0]!.connected).toBe(false);

    const res = store.rejoin({ ...host });
    expect(res.ok).toBe(true);
    expect(store.get(host.code)!.players[0]!.connected).toBe(true);
    expect(store.get(host.code)!.players).toHaveLength(1);
  });

  it('refuses a wrong secret', () => {
    const host = seat('Nandhu');
    const res = store.rejoin({ code: host.code, playerId: host.playerId, secret: 'nope' });
    expect(res).toEqual({ ok: false, error: 'That seat belongs to someone else.' });
  });

  it('refuses once the seat has been swept away', () => {
    const host = seat('Host');
    const guest = seat('Guest', host.code);
    store.markDisconnected(guest.playerId);
    clock += DISCONNECT_GRACE_MS;
    store.sweep();

    expect(store.rejoin({ ...guest })).toEqual({ ok: false, error: 'Your seat was given up.' });
  });
});

describe('leaving and host handover', () => {
  it('passes the crown to the longest-present player', () => {
    const host = seat('Host');
    clock += 10;
    const second = seat('Second', host.code);
    clock += 10;
    seat('Third', host.code);

    store.leave(host.playerId);
    expect(store.get(host.code)!.hostId).toBe(second.playerId);
  });

  it('skips disconnected players when handing over', () => {
    const host = seat('Host');
    clock += 10;
    const second = seat('Second', host.code);
    clock += 10;
    const third = seat('Third', host.code);

    store.markDisconnected(second.playerId);
    store.leave(host.playerId);
    expect(store.get(host.code)!.hostId).toBe(third.playerId);
  });

  it('keeps the crown while the host is only briefly disconnected', () => {
    const host = seat('Host');
    clock += 10;
    seat('Second', host.code);

    // a refresh, not a departure
    store.markDisconnected(host.playerId);
    expect(store.get(host.code)!.hostId).toBe(host.playerId);

    clock += DISCONNECT_GRACE_MS - 1;
    store.sweep();
    expect(store.get(host.code)!.hostId).toBe(host.playerId);

    store.rejoin({ ...host });
    expect(store.get(host.code)!.hostId).toBe(host.playerId);
  });

  it('hands the crown over once the host is gone past the grace window', () => {
    const host = seat('Host');
    clock += 10;
    const second = seat('Second', host.code);

    store.markDisconnected(host.playerId);
    clock += DISCONNECT_GRACE_MS;
    store.sweep();

    expect(store.get(host.code)!.hostId).toBe(second.playerId);
  });

  it('does not let a rejoining guest steal the crown from a dropped host', () => {
    const host = seat('Host');
    clock += 10;
    const guest = seat('Guest', host.code);

    store.markDisconnected(host.playerId);
    store.markDisconnected(guest.playerId);
    store.rejoin({ ...guest });

    expect(store.get(host.code)!.hostId).toBe(host.playerId);
  });

  it('deletes the room when the last player leaves', () => {
    const host = seat('Only');
    store.leave(host.playerId);
    expect(store.get(host.code)).toBeUndefined();
    expect(store.size).toBe(0);
  });
});

describe('the sweep', () => {
  it('keeps a dropped seat inside the grace window', () => {
    const host = seat('Host');
    seat('Guest', host.code);
    const guest = store.get(host.code)!.players[1]!;

    store.markDisconnected(guest.id);
    clock += DISCONNECT_GRACE_MS - 1;
    store.sweep();
    expect(store.get(host.code)!.players).toHaveLength(2);
  });

  it('removes the seat once the window passes', () => {
    const host = seat('Host');
    const guest = seat('Guest', host.code);

    store.markDisconnected(guest.playerId);
    clock += DISCONNECT_GRACE_MS;
    const { changed } = store.sweep();

    expect(changed).toHaveLength(1);
    expect(store.get(host.code)!.players).toHaveLength(1);
  });

  it('closes a room everyone dropped out of, after the ttl', () => {
    const host = seat('Host');
    store.markDisconnected(host.playerId);

    clock += DISCONNECT_GRACE_MS;
    store.sweep(); // host removed, room now empty
    expect(store.get(host.code)).toBeUndefined();
  });

  it('leaves a room alone while somebody is still connected', () => {
    const host = seat('Host');
    clock += EMPTY_ROOM_TTL_MS * 2;
    const { closed } = store.sweep();
    expect(closed).toHaveLength(0);
    expect(store.get(host.code)).toBeDefined();
  });
});

describe('views', () => {
  it('never leaks a secret', () => {
    const host = seat('Host');
    seat('Guest', host.code);
    const view = toView(store.get(host.code)!);

    expect(JSON.stringify(view)).not.toContain(store.get(host.code)!.players[0]!.secret);
    for (const player of view.players) {
      expect(player).not.toHaveProperty('secret');
    }
  });

  it('marks a mid-game joiner as a spectator', () => {
    const host = seat('Host');
    store.get(host.code)!.phase = 'playing';
    const late = seat('Late', host.code);

    const player = store.get(host.code)!.players.find((p) => p.id === late.playerId)!;
    expect(player.spectator).toBe(true);
  });
});

describe('choosing a game and its rules', () => {
  it('starts with the chosen game and its defaults', () => {
    const host = seat('Host');
    const room = store.get(host.code)!;
    expect(room.gameId).toBe('last-card');
    expect(room.settings).toMatchObject({ stackDraw: true, turnTimer: 20 });
  });

  it('refuses to create a room on a coming-soon game', () => {
    const res = store.create({ name: 'Host', avatar: '🐯', gameId: 'snakes-ladders' });
    expect(res).toEqual({ ok: false, error: 'That game is not ready to play yet.' });
  });

  it('refuses to switch to a coming-soon game', () => {
    const host = seat('Host');
    expect(store.setGame(host.playerId, 'snakes-ladders')).toEqual({
      ok: false,
      error: 'That game is not ready to play yet.',
    });
    expect(store.get(host.code)!.gameId).toBe('last-card');
  });

  it('refuses an unknown game id', () => {
    const host = seat('Host');
    expect(store.setGame(host.playerId, 'not-a-game').ok).toBe(false);
  });

  it('lets only the host change the game', () => {
    const host = seat('Host');
    const guest = seat('Guest', host.code);
    expect(store.setGame(guest.playerId, 'last-card')).toEqual({
      ok: false,
      error: 'Only the host can change the game.',
    });
  });

  it('refuses a game change once play has started', () => {
    const host = seat('Host');
    store.get(host.code)!.phase = 'playing';
    expect(store.setGame(host.playerId, 'last-card')).toEqual({
      ok: false,
      error: 'You can only change the game before the deal.',
    });
  });

  it('folds a settings patch in through the game spec', () => {
    const host = seat('Host');
    const res = store.updateSettings(host.playerId, { sevenZero: true, turnTimer: 40 });
    expect(res.ok).toBe(true);
    expect(store.get(host.code)!.settings).toMatchObject({
      sevenZero: true,
      turnTimer: 40,
      stackDraw: true,
    });
  });

  it('ignores junk in a settings patch instead of storing it', () => {
    const host = seat('Host');
    store.updateSettings(host.playerId, {
      turnTimer: 9999,
      stackDraw: 'yes please',
      evil: 'payload',
    });
    const settings = store.get(host.code)!.settings as Record<string, unknown>;
    expect(settings['turnTimer']).toBe(20);
    expect(settings['stackDraw']).toBe(true);
    expect(settings).not.toHaveProperty('evil');
  });

  it('lets only the host change the rules', () => {
    const host = seat('Host');
    const guest = seat('Guest', host.code);
    expect(store.updateSettings(guest.playerId, { sevenZero: true })).toEqual({
      ok: false,
      error: 'Only the host can change the rules.',
    });
  });
});
