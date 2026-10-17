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
