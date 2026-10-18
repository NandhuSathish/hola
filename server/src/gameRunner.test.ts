import { beforeEach, describe, expect, it } from 'vitest';
import type { LastCardView, Room } from '@holla/shared';
import { createGameRunner, type GameRunner } from './gameRunner.js';
import { createRoomStore, type RoomStore } from './rooms.js';

let clock = 1_000_000;
let store: RoomStore;
let runner: GameRunner;

function seeded(seed = 7): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A room with `count` players seated, host first. */
function room(count: number): { room: Room; ids: string[] } {
  const host = store.create({ name: 'Host', avatar: '🐯', gameId: 'last-card' });
  if (!host.ok) throw new Error(host.error);
  const ids = [host.value.playerId];

  for (let i = 1; i < count; i++) {
    const joined = store.join({ code: host.value.code, name: 'P' + i, avatar: '🦊' });
    if (!joined.ok) throw new Error(joined.error);
    ids.push(joined.value.playerId);
  }

  const found = store.get(host.value.code);
  if (!found) throw new Error('room vanished');
  return { room: found, ids };
}

const view = (r: Room, id: string) => runner.viewFor(r, id) as LastCardView;

beforeEach(() => {
  clock = 1_000_000;
  store = createRoomStore({ now: () => clock, rng: seeded(1) });
  runner = createGameRunner({ now: () => clock, rng: seeded(2) });
});

describe('starting a round', () => {
  it('deals and moves the room to playing', () => {
    const { room: r } = room(4);
    const res = runner.start(r);

    expect(res.ok).toBe(true);
    expect(r.phase).toBe('playing');
    expect(r.game).not.toBeNull();
    expect(view(r, r.hostId).seats).toHaveLength(4);
  });

  it('refuses a game with no engine behind it', () => {
    const { room: r } = room(3);
    r.gameId = 'snakes-ladders';
    expect(runner.start(r)).toEqual({ ok: false, error: 'That game is not ready to play yet.' });
    expect(r.phase).toBe('lobby');
  });

  it('refuses a table of one', () => {
    const { room: r } = room(1);
    const res = runner.start(r);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('at least 2');
  });

  it('refuses to deal twice', () => {
    const { room: r } = room(3);
    runner.start(r);
    expect(runner.start(r)).toEqual({ ok: false, error: 'The game has already started.' });
  });

  it('seats anyone who was spectating', () => {
    const { room: r, ids } = room(3);
    const watcher = r.players.find((p) => p.id === ids[2]);
    if (watcher) watcher.spectator = true;

    runner.start(r);
    expect(r.players.every((p) => !p.spectator)).toBe(true);
    expect(view(r, r.hostId).seats).toHaveLength(3);
  });
});

describe('making a move', () => {
  it('refuses a move before the deal', () => {
    const { room: r, ids } = room(3);
    expect(runner.act(r, ids[0]!, { type: 'draw' })).toEqual({
      ok: false,
      error: 'No round is running.',
    });
  });

  it('passes the engine refusal straight through', () => {
    const { room: r, ids } = room(3);
    runner.start(r);
    // seat 0 is the host, and the player after the host leads
    const res = runner.act(r, ids[0]!, { type: 'draw' });
    expect(res).toEqual({ ok: false, error: 'Wait for your turn.' });
  });

  it('refuses a spectator', () => {
    const { room: r, ids } = room(3);
    runner.start(r);
    const watcher = r.players.find((p) => p.id === ids[1]);
    if (watcher) watcher.spectator = true;

    expect(runner.act(r, ids[1]!, { type: 'draw' })).toEqual({
      ok: false,
      error: 'You are watching this round.',
    });
  });

  it('accepts a legal move and reports events', () => {
    const { room: r } = room(3);
    runner.start(r);
    const whoseTurn = view(r, r.hostId).turnPlayerId;

    const res = runner.act(r, whoseTurn, { type: 'draw' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.events.length).toBeGreaterThan(0);
  });

  it('refuses junk without throwing', () => {
    const { room: r } = room(3);
    runner.start(r);
    const whoseTurn = view(r, r.hostId).turnPlayerId;
    expect(runner.act(r, whoseTurn, { type: 'nonsense' }).ok).toBe(false);
    expect(runner.act(r, whoseTurn, null).ok).toBe(false);
  });
});

describe('views', () => {
  it('gives each player their own hand and nobody else"s', () => {
    const { room: r, ids } = room(3);
    runner.start(r);

    const mine = view(r, ids[0]!);
    const theirs = view(r, ids[1]!);
    expect(mine.me.hand).toHaveLength(7);
    expect(theirs.me.hand).toHaveLength(7);
    expect(mine.me.hand.map((c) => c.id)).not.toEqual(theirs.me.hand.map((c) => c.id));

    // nothing in my payload matches another player's cards
    const otherIds = new Set(theirs.me.hand.map((c) => c.id));
    for (const card of mine.me.hand) expect(otherIds.has(card.id)).toBe(false);
  });

  it('hands a spectator no cards at all', () => {
    const { room: r, ids } = room(3);
    runner.start(r);
    const watcher = r.players.find((p) => p.id === ids[2]);
    if (watcher) watcher.spectator = true;

    const spectate = view(r, ids[2]!);
    expect(spectate.me.hand).toHaveLength(0);
    expect(spectate.seats).toHaveLength(3);
  });

  it('has nothing to show before a deal', () => {
    const { room: r, ids } = room(3);
    expect(runner.viewFor(r, ids[0]!)).toBeNull();
  });
});

describe('finishing and scoring', () => {
  /** Plays legal moves until somebody goes out. */
  function playOut(r: Room, limit = 3000): void {
    for (let i = 0; i < limit && r.phase === 'playing'; i++) {
      const current = view(r, r.hostId).turnPlayerId;
      const mine = view(r, current);
      const playable = mine.me.playableIds;

      if (playable.length > 0) {
        const id = playable[0]!;
        const card = mine.me.hand.find((c) => c.id === id);
        const action: Record<string, unknown> = { type: 'play', cardId: id };
        if (card && (card.value === 'wild' || card.value === 'wild4')) action['chosenColor'] = 'red';
        if (card && card.value === '7' && r.settings && (r.settings as { sevenZero?: boolean }).sevenZero) {
          action['swapWith'] = r.players.find((p) => p.id !== current)?.id;
        }
        if (!runner.act(r, current, action).ok) runner.act(r, current, { type: 'draw' });
      } else {
        const drew = runner.act(r, current, { type: 'draw' });
        if (drew.ok && view(r, r.hostId).turnPlayerId === current) {
          runner.act(r, current, { type: 'pass' });
        }
      }
    }
  }

  it('moves to results and banks the winner"s points', () => {
    const { room: r } = room(3);
    runner.start(r);
    playOut(r);

    expect(r.phase).toBe('results');
    const result = runner.result(r);
    expect(result).not.toBeNull();

    const winner = result!.winnerId;
    expect(r.totals[winner]).toBe(result!.scores.find((s) => s.playerId === winner)?.points);
    // winner takes all, so everyone else banked nothing
    for (const row of result!.scores) {
      if (row.playerId !== winner) expect(r.totals[row.playerId] ?? 0).toBe(0);
    }
  });

  it('adds up across rounds', () => {
    const { room: r } = room(3);
    runner.start(r);
    playOut(r);
    const firstWinner = runner.result(r)!.winnerId;
    const afterOne = r.totals[firstWinner] ?? 0;

    runner.next(r, 'again');
    expect(r.phase).toBe('playing');
    playOut(r);

    const second = runner.result(r)!;
    if (second.winnerId === firstWinner) {
      expect(r.totals[firstWinner]).toBeGreaterThan(afterOne);
    } else {
      expect(r.totals[firstWinner]).toBe(afterOne);
    }
  });
});

describe('what happens next', () => {
  it('refuses while the round is still going', () => {
    const { room: r } = room(3);
    runner.start(r);
    expect(runner.next(r, 'again')).toEqual({ ok: false, error: 'The round is still going.' });
  });

  it('returns to the lobby and clears the game', () => {
    const { room: r } = room(3);
    runner.start(r);
    r.phase = 'results';

    expect(runner.next(r, 'lobby').ok).toBe(true);
    expect(r.phase).toBe('lobby');
    expect(r.game).toBeNull();
  });

  it('wipes the totals on reset', () => {
    const { room: r, ids } = room(3);
    r.totals[ids[0]!] = 120;
    runner.start(r);
    r.phase = 'results';

    runner.next(r, 'reset');
    expect(r.totals).toEqual({});
    expect(r.phase).toBe('lobby');
  });
});

describe('a player leaving mid-round', () => {
  it('folds them out and keeps the round going', () => {
    const { room: r, ids } = room(4);
    runner.start(r);

    const res = runner.playerLeft(r, ids[2]!);
    expect(res).not.toBeNull();
    expect(view(r, r.hostId).seats).toHaveLength(3);
    expect(r.phase).toBe('playing');
  });

  it('ends the round when only one is left standing', () => {
    const { room: r, ids } = room(3);
    runner.start(r);

    runner.playerLeft(r, ids[1]!);
    runner.playerLeft(r, ids[2]!);
    expect(r.phase).toBe('results');
  });

  it('does nothing outside a round', () => {
    const { room: r, ids } = room(3);
    expect(runner.playerLeft(r, ids[0]!)).toBeNull();
  });
});

describe('the turn timer', () => {
  it('does nothing before the deadline', () => {
    const { room: r } = room(3);
    runner.start(r);
    clock += 1_000;
    expect(runner.tick(r)).toBeNull();
  });

  it('moves the turn on once it expires', () => {
    const { room: r } = room(3);
    runner.start(r);
    const before = view(r, r.hostId).turnPlayerId;

    clock += 21_000; // default timer is 20s
    const ticked = runner.tick(r);

    expect(ticked).not.toBeNull();
    expect(view(r, r.hostId).turnPlayerId).not.toBe(before);
  });

  it('stays quiet when there is no round', () => {
    const { room: r } = room(3);
    expect(runner.tick(r)).toBeNull();
  });
});
