import type { GameUI } from './types';
import { LastCardSettingsPanel } from './last-card/Settings';

/**
 * id -> components. Mirrors the shared registry: adding a game means one folder
 * here and one line below, and the core never imports a game directly.
 * The Table component joins this in Phase 3.
 */
export const gameUIs: Record<string, GameUI> = {
  'last-card': { Settings: LastCardSettingsPanel },
};

export function getGameUI(id: string): GameUI | undefined {
  return gameUIs[id];
}
