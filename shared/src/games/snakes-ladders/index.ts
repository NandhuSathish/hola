import type { GameModule } from '../types.js';
import { SNAKES_DEFAULTS, type SnakesSettings } from './settings.js';
import type { SnakesAction, SnakesState, SnakesView } from './types.js';
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
 * Pure by construction (CLAUDE.md rule 3): the dice come from the injected
 * `rng` and time arrives as `now`, so a seed replays a whole game exactly.
 *
 * Nothing here is hidden from anyone — the board is public — but the
 * per-player view is still how `canRoll` gets answered.
 */
export const snakesLadders: GameModule<SnakesState, SnakesAction, SnakesView, SnakesSettings> = {
  id: 'snakes-ladders',
  name: 'Snakes & Ladders',
  minPlayers: 2,
  maxPlayers: 8,
  defaultSettings: SNAKES_DEFAULTS,

  setup,
  onAction,
  onTick,
  getPlayerView,
  getSpectatorView,
  getResult,
  onPlayerLeft,
};
