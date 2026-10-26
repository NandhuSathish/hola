import type { RoomView } from './types.js';
import type { Look } from './look.js';
import type { GameEvent, RoundResult } from './games/types.js';

/**
 * Every client -> server event answers with an acknowledgement rather than
 * throwing, so the caller always learns why something was refused.
 */
export type Ack = { ok: true } | { ok: false; error: string };
export type AckWith<T> = ({ ok: true } & T) | { ok: false; error: string };

/** What the server hands back once you are seated. Store it per room code. */
export type Seat = {
  code: string;
  playerId: string;
  secret: string;
};

/** `gameId` is empty for a fresh room: the game is chosen from inside it. */
export type CreateRoomInput = { name: string; look: Look; gameId: string };
export type JoinRoomInput = { code: string; name: string; look: Look };
export type RejoinRoomInput = { code: string; playerId: string; secret: string };

export interface ClientToServerEvents {
  'room:create': (input: CreateRoomInput, ack: (res: AckWith<Seat>) => void) => void;
  'room:join': (input: JoinRoomInput, ack: (res: AckWith<Seat>) => void) => void;
  'room:rejoin': (input: RejoinRoomInput, ack: (res: Ack) => void) => void;
  'room:leave': (ack: (res: Ack) => void) => void;
  /** Restyle your fighter. Lobby only — mid-game it would be a disguise. */
  'room:look': (input: { look: Look }, ack: (res: Ack) => void) => void;
  /**
   * Throw an emoji. No acknowledgement: a reaction that failed is not worth
   * telling anyone about, and the round trip would make it feel sticky.
   */
  'room:react': (input: { emoji: string }) => void;
  /** Host only, lobby only, and the game must be a 'ready' one. */
  'room:setGame': (input: { gameId: string }, ack: (res: Ack) => void) => void;
  /** Host only, lobby only. The patch is validated by the game's own spec. */
  'room:settings': (patch: unknown, ack: (res: Ack) => void) => void;
  /** Host only, lobby only, at least two players, and the game must have an engine. */
  'game:start': (ack: (res: Ack) => void) => void;
  /** A move. The shape belongs to the active game, so it is opaque here. */
  'game:action': (action: unknown, ack: (res: Ack) => void) => void;
  /** Host only, results phase. */
  'game:next': (input: { mode: 'again' | 'lobby' | 'reset' }, ack: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  /** Sent on every change to the room, and once right after you join or rejoin. */
  'room:state': (view: RoomView) => void;
  /** The room went away under you (host closed it, or it was swept). */
  'room:closed': (payload: { reason: string }) => void;
  /**
   * This player's own view of the game. Sent after every accepted action, on a
   * fired turn timeout, and right after a rejoin — never on a plain tick.
   */
  'game:view': (view: unknown) => void;
  /** Feeds the log and toasts. */
  'game:events': (events: GameEvent[]) => void;
  /** Somebody reacted. `id` is unique per throw, so repeats still animate. */
  'room:reaction': (payload: { playerId: string; emoji: Reaction; id: number }) => void;
  /** Round over: who won, what everyone was holding, and the running totals. */
  'game:result': (payload: { result: RoundResult; totals: Record<string, number> }) => void;
}

/** Nothing server-to-server yet; Socket.io wants the slot filled. */
export interface InterServerEvents {
  ping: () => void;
}

/** Per-connection scratch space the server keeps. */
export interface SocketData {
  playerId?: string;
  code?: string;
}

/**
 * What you can throw at the room. A closed list, because an open one is a
 * text field by another name and this is a game for one friend group, not a
 * chat.
 */
export const REACTIONS = ['😂', '🔥', '😱', '👏', '🐍', '🏏'] as const;
export type Reaction = (typeof REACTIONS)[number];

export const isReaction = (value: unknown): value is Reaction =>
  (REACTIONS as readonly unknown[]).includes(value);

/** Nobody needs to send more than this, and a bot would send far more. */
export const REACTION_EVERY_MS = 600;

export const MAX_PLAYERS = 15;
export const NAME_MAX_LENGTH = 14;
/** A dropped player keeps their seat this long before being removed. */
export const DISCONNECT_GRACE_MS = 60_000;
/** A room with nobody connected is deleted after this long. */
export const EMPTY_ROOM_TTL_MS = 10 * 60_000;
