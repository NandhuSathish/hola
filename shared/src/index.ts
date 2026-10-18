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

export type {
  Card,
  CardValue,
  Color,
  LastCardAction,
  LastCardState,
  LastCardView,
  SeatState,
} from './games/last-card/types.js';
export { lastCard } from './games/last-card/index.js';
export {
  buildDeck,
  canPlayOn,
  cardValue,
  decksFor,
  handValue,
  isNumberCard,
  isWild,
  shuffle,
} from './games/last-card/deck.js';

export type {
  LastTurn,
  MoveStep,
  SnakesAction,
  SnakesSeat,
  SnakesState,
  SnakesView,
} from './games/snakes-ladders/types.js';
export { snakesLadders } from './games/snakes-ladders/index.js';
export {
  COLUMNS,
  CROWD_TILES,
  FIRST_TILE,
  LADDERS,
  LAST_TILE,
  MYSTERY_TILES,
  SNAKES,
  ladderAt,
  snakeAt,
  tileToCell,
  walkPath,
} from './games/snakes-ladders/board.js';
export type { SnakesSettings, SnakesTurnTimer } from './games/snakes-ladders/settings.js';
export { MAX_ROLLS_PER_TURN, SNAKES_DEFAULTS, snakesSettings } from './games/snakes-ladders/settings.js';

export type { LastCardSettings, TurnTimer } from './games/last-card/settings.js';
export { LAST_CARD_DEFAULTS, lastCardSettings } from './games/last-card/settings.js';

/** Bumped by hand; the client logs it on boot so we can see what is deployed. */
export const SHARED_VERSION = '0.1.0';
