import type { Look } from '../look.js';

export type PlayerRef = { id: string; name: string; look: Look };

/** Feeds the event log and toasts. */
export type GameEvent = { kind: string; text: string; playerId?: string };

export type RoundResult = {
  winnerId: string;
  /**
   * What each player's number means, and which way it reads. The results
   * table is shared, so it cannot know that cards left is a thing to have
   * few of while runs are a thing to have many of — the game has to say.
   */
  scoreLabel: string;
  higherIsBetter: boolean;
  scores: { playerId: string; score: number; points: number }[];
};

/**
 * What the game picker shows. Deliberately separate from GameModule, because a
 * "coming soon" game has metadata but no implementation (REFERENCE.md section 3).
 */
export type GameInfo = {
  id: string;
  name: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  estimate: string;
  /** 'soon' entries have no module and can never be started. */
  status: 'ready' | 'soon';
};

/**
 * Settings belong to the game, not the core. The server owns the stored value
 * but never interprets it — it just asks the spec to fold in a patch.
 */
export type SettingsSpec<S = unknown> = {
  defaults: S;
  /** Merge a client patch, discarding anything invalid. Never throws. */
  apply(current: S, patch: unknown): S;
};

export interface GameModule<State = unknown, Action = unknown, View = unknown, Settings = unknown> {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  defaultSettings: Settings;

  /**
   * ctx carries now as well as rng: a turn timer needs a start time, and
   * rule 3 forbids reading the clock inside the engine.
   */
  setup(players: PlayerRef[], settings: Settings, ctx: { now: number; rng: () => number }): State;

  /** Validate and apply. Illegal moves come back as an error, never a throw. */
  onAction(
    state: State,
    playerId: string,
    action: Action,
    ctx: { now: number; rng: () => number },
  ): { ok: true; state: State; events: GameEvent[] } | { ok: false; error: string };

  /** Called by the runner on a timer for turn timeouts. */
  onTick?(
    state: State,
    ctx: { now: number; rng: () => number },
  ): { state: State; events: GameEvent[] } | null;

  getPlayerView(state: State, playerId: string): View;
  getSpectatorView(state: State): View;
  getResult(state: State): RoundResult | null;
  onPlayerLeft(state: State, playerId: string): State;
}
