import type { Look } from './look.js';

/** A player as the server stores them. `secret` never leaves the server. */
export type Player = {
  id: string;
  secret: string;
  name: string;
  look: Look;
  connected: boolean;
  joinedAt: number;
  lastSeen: number;
  /** Watching only; seated again when the next round is dealt. */
  spectator: boolean;
};

/** A player as other clients see them — no secret. */
export type PublicPlayer = Omit<Player, 'secret'>;

export type RoomPhase = 'lobby' | 'playing' | 'results';

/**
 * The core is game-agnostic (CLAUDE.md rule 4): `gameId` is a registry key and
 * `settings` / `game` are opaque here. Only the active GameModule reads them.
 */
export type Room = {
  code: string;
  hostId: string;
  players: Player[];
  phase: RoomPhase;
  gameId: string;
  settings: unknown;
  game: unknown | null;
  totals: Record<string, number>;
  createdAt: number;
};

export type RoomView = {
  code: string;
  hostId: string;
  players: PublicPlayer[];
  phase: RoomPhase;
  gameId: string;
  settings: unknown;
  totals: Record<string, number>;
};
