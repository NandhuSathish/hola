import type { GameModule } from '../types.js';
import { LAST_CARD_DEFAULTS, type LastCardSettings } from './settings.js';
import type { LastCardAction, LastCardState, LastCardView } from './types.js';
import {
  getPlayerView,
  getResult,
  getSpectatorView,
  onAction,
  onPlayerLeft,
  onTick,
  setup,
} from './rules.js';

/**
 * Pure by construction (CLAUDE.md rule 3): no sockets, no timers, no clock and
 * no Math.random in here. Randomness arrives as `rng` and time as `now`, which
 * is what makes every rule below testable with a fixed seed.
 *
 * Seat order is the room's seat order, and seat 0 is the host — that is how
 * "the player after the host goes first" is resolved.
 */
export const lastCard: GameModule<LastCardState, LastCardAction, LastCardView, LastCardSettings> = {
  id: 'last-card',
  name: 'Last Card',
  minPlayers: 2,
  maxPlayers: 15,
  defaultSettings: LAST_CARD_DEFAULTS,

  setup,
  onAction,
  onTick,
  getPlayerView,
  getSpectatorView,
  getResult,
  onPlayerLeft,
};
