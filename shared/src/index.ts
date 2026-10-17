export type { Player, PublicPlayer, Room, RoomPhase, RoomView } from './types.js';

export type {
  Ack,
  AckWith,
  ClientToServerEvents,
  CreateRoomInput,
  InterServerEvents,
  JoinRoomInput,
  RejoinRoomInput,
  Seat,
  ServerToClientEvents,
  SocketData,
} from './events.js';
export {
  DISCONNECT_GRACE_MS,
  EMPTY_ROOM_TTL_MS,
  MAX_PLAYERS,
  NAME_MAX_LENGTH,
} from './events.js';

export {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  makeRoomCode,
  normaliseRoomCode,
} from './room-code.js';

export { cleanName, isValidName, uniqueName } from './names.js';

export type { Avatar } from './avatars.js';
export { AVATARS, firstFreeAvatar, isValidAvatar } from './avatars.js';

export type {
  GameEvent,
  GameInfo,
  GameModule,
  PlayerRef,
  RoundResult,
  SettingsSpec,
} from './games/types.js';
export {
  DEFAULT_GAME_ID,
  catalogue,
  getGameInfo,
  isPickable,
  isPlayable,
  modules,
  settingsSpecs,
} from './games/index.js';

export type { LastCardSettings, TurnTimer } from './games/last-card/settings.js';
export { LAST_CARD_DEFAULTS, lastCardSettings } from './games/last-card/settings.js';

/** Bumped by hand; the client logs it on boot so we can see what is deployed. */
export const SHARED_VERSION = '0.1.0';
