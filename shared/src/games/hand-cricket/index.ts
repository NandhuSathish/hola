import type { GameModule } from '../types.js';
import { HAND_CRICKET_DEFAULTS, type HandCricketSettings } from './settings.js';
import type { HandCricketAction, HandCricketState, HandCricketView } from './types.js';
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
 * The first game where two people act at the same moment rather than in turn.
 * `onTick` is not a courtesy here the way a turn timer is — it is what closes
 * the ball, so a match keeps moving whoever is slow.
 */
export const handCricket: GameModule<
  HandCricketState,
  HandCricketAction,
  HandCricketView,
  HandCricketSettings
> = {
  id: 'hand-cricket',
  name: 'Hand Cricket',
  minPlayers: 2,
  maxPlayers: 15,
  defaultSettings: HAND_CRICKET_DEFAULTS,

  setup,
  onAction,
  onTick,
  getPlayerView,
  getSpectatorView,
  getResult,
  onPlayerLeft,
};
