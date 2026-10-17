import type { RoomView } from './types.js';

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

export type CreateRoomInput = { name: string; avatar: string; gameId: string };
export type JoinRoomInput = { code: string; name: string; avatar: string };
export type RejoinRoomInput = { code: string; playerId: string; secret: string };

export interface ClientToServerEvents {
  'room:create': (input: CreateRoomInput, ack: (res: AckWith<Seat>) => void) => void;
  'room:join': (input: JoinRoomInput, ack: (res: AckWith<Seat>) => void) => void;
  'room:rejoin': (input: RejoinRoomInput, ack: (res: Ack) => void) => void;
  'room:leave': (ack: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  /** Sent on every change to the room, and once right after you join or rejoin. */
  'room:state': (view: RoomView) => void;
  /** The room went away under you (host closed it, or it was swept). */
  'room:closed': (payload: { reason: string }) => void;
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

export const MAX_PLAYERS = 15;
export const NAME_MAX_LENGTH = 14;
/** A dropped player keeps their seat this long before being removed. */
export const DISCONNECT_GRACE_MS = 60_000;
/** A room with nobody connected is deleted after this long. */
export const EMPTY_ROOM_TTL_MS = 10 * 60_000;
