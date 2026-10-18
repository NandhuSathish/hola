import type { ComponentType } from 'react';
import type { PublicPlayer } from '@holla/shared';

export type SettingsProps = {
  settings: unknown;
  /** Only the host, and only before the deal. */
  canEdit: boolean;
  onChange: (patch: Record<string, unknown>) => void;
};

export type TableProps = {
  /** This player's own view, shaped by the game. */
  view: unknown;
  me: string;
  players: PublicPlayer[];
  send: (action: unknown) => void;
};

export type GameUI = {
  Settings: ComponentType<SettingsProps>;
  Table: ComponentType<TableProps>;
};
