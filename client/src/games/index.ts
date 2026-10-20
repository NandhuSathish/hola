import type { GameUI } from './types';
import { LastCardSettingsPanel } from './last-card/Settings';
import { LastCardTable } from './last-card/Table';
import { SnakesSettingsPanel } from './snakes-ladders/Settings';
import { SnakesTable } from './snakes-ladders/Table';
import { HandCricketSettingsPanel } from './hand-cricket/Settings';
import { HandCricketTable } from './hand-cricket/Table';

/**
 * id -> components. Mirrors the shared registry: adding a game means one folder
 * here and one line below, and the core never imports a game directly.
 */
export const gameUIs: Record<string, GameUI> = {
  'last-card': {
    Settings: LastCardSettingsPanel,
    Table: LastCardTable as GameUI['Table'],
  },
  'snakes-ladders': {
    Settings: SnakesSettingsPanel,
    Table: SnakesTable as GameUI['Table'],
  },
  'hand-cricket': {
    Settings: HandCricketSettingsPanel,
    Table: HandCricketTable as GameUI['Table'],
  },
};

export function getGameUI(id: string): GameUI | undefined {
  return gameUIs[id];
}
