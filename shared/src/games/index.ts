import type { GameInfo, GameModule, SettingsSpec } from './types.js';
import { lastCardSettings } from './last-card/settings.js';
import { lastCard } from './last-card/index.js';
import { snakesSettings } from './snakes-ladders/settings.js';
import { snakesLadders } from './snakes-ladders/index.js';
import { handCricketSettings } from './hand-cricket/settings.js';
import { handCricket } from './hand-cricket/index.js';

/**
 * Everything the picker shows, built or not. Order is display order.
 */
export const catalogue: GameInfo[] = [
  {
    id: 'last-card',
    name: 'Last Card',
    tagline:
      'Match the colour or the number, dump your hand fast, and shout before someone catches you sitting on one card.',
    minPlayers: 2,
    maxPlayers: 15,
    estimate: '~10 min a round',
    status: 'ready',
  },
  {
    id: 'hand-cricket',
    name: 'Hand Cricket',
    tagline:
      'Two teams, one number each per ball. Match the batter and they are out. Bowler changes every over.',
    minPlayers: 2,
    maxPlayers: 15,
    estimate: '~10 min an innings',
    // Engine done and tested; flips to 'ready' when its table lands (5b).
    status: 'soon',
  },
  {
    id: 'snakes-ladders',
    name: 'Snakes & Ladders',
    tagline:
      'Roll, climb, and get swallowed one square from home. Same room, same voice chat, a lot more shouting at dice.',
    minPlayers: 2,
    maxPlayers: 8,
    estimate: '~15 min',
    status: 'ready',
  },
];

/** Settings specs for games you can pick. The lobby needs these before any engine exists. */
export const settingsSpecs: Record<string, SettingsSpec> = {
  'last-card': lastCardSettings as SettingsSpec,
  'snakes-ladders': snakesSettings as SettingsSpec,
  'hand-cricket': handCricketSettings as SettingsSpec,
};

/** Engines. A game is only startable once it appears here. */
export const modules: Record<string, GameModule> = {
  'last-card': lastCard as GameModule,
  'snakes-ladders': snakesLadders as GameModule,
  'hand-cricket': handCricket as GameModule,
};

export const DEFAULT_GAME_ID = 'last-card';

export function getGameInfo(id: string): GameInfo | undefined {
  return catalogue.find((g) => g.id === id);
}

/** A game can be chosen for a room only if it is in the catalogue and ready. */
export function isPickable(id: string): boolean {
  return getGameInfo(id)?.status === 'ready';
}

/** A game can actually be started only once its engine is registered. */
export function isPlayable(id: string): boolean {
  return isPickable(id) && id in modules;
}
