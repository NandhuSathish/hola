export type { Player, PublicPlayer, Room, RoomPhase, RoomView } from './types.js';
export {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  makeRoomCode,
  normaliseRoomCode,
} from './room-code.js';

/** Bumped by hand; the client logs it on boot so we can see what is deployed. */
export const SHARED_VERSION = '0.1.0';
