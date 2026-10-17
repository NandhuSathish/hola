import type { ComponentType } from 'react';

export type SettingsProps = {
  settings: unknown;
  /** Only the host, and only before the deal. */
  canEdit: boolean;
  onChange: (patch: Record<string, unknown>) => void;
};

export type GameUI = {
  Settings: ComponentType<SettingsProps>;
};
