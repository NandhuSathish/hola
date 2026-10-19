import { getGameInfo } from '@holla/shared';
import { navigate } from '../lib/route';
import { useCopy } from '../lib/useCopy';
import { CheckIcon, CopyIcon, LeaveIcon } from './icons';
import './NavBar.css';

type Props = {
  /** The room you are in, if any. */
  code?: string | null;
  /** Registry id of the chosen game, so the chip can name it. */
  gameId?: string | null;
  /** Socket state, so a drop is visible on every screen rather than one. */
  connection?: 'connecting' | 'connected' | 'disconnected';
  /**
   * Given only where the screen has no leave of its own. The lobby keeps its
   * own beside the invite link, so passing it there would be two ways out of
   * the same page.
   */
  onLeave?: () => void;
};

/** A colour per game, so the chip reads before the words do. */
const GAME_COLOUR: Record<string, string> = {
  'last-card': 'var(--pink)',
  'snakes-ladders': 'var(--mint)',
  'hand-cricket': 'var(--sun)',
};

/**
 * The bar across the top of every screen.
 *
 * Carries the three things that are true everywhere: where you are, what you
 * are playing, and whether the server is still there.
 */
export function NavBar({ code, gameId, connection = 'connected', onLeave }: Props) {
  const { copied, copy } = useCopy();
  const game = gameId ? getGameInfo(gameId) : undefined;
  const hasActions = Boolean(game || code || onLeave || connection !== 'connected');

  return (
    <header className="navbar">
      <button
        type="button"
        className="nav-brand"
        onClick={() => navigate('/')}
        aria-label="holla! home"
      >
        holla!
      </button>

      {/* The pill is a thing in its own right, so an empty one would read as
          a stray dot in the corner rather than as nothing. */}
      {hasActions && <div className="nav-right">
        {game && (
          <span
            className="nav-game"
            style={{ ['--c' as string]: GAME_COLOUR[game.id] ?? 'var(--sky)' }}
            title={game.name}
            /* The label is hidden on a narrow bar, so the chip carries the name
               itself — otherwise it would be a coloured dot and nothing else. */
            aria-label={`Playing ${game.name}`}
          >
            <i aria-hidden="true" />
            <span>{game.name}</span>
          </span>
        )}
        {connection !== 'connected' && (
          <span className="nav-state" role="status">
            {connection === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
          </span>
        )}

        {code && (
          <button
            type="button"
            className={`nav-code${copied ? ' copied' : ''}`}
            onClick={() => copy(code)}
            title="Copy the room code"
            aria-label={`Room ${code}. Copy the code.`}
          >
            <b>{code}</b>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        )}

        {onLeave && (
          <button type="button" className="nav-leave" onClick={onLeave}>
            <LeaveIcon />
            <span>Leave</span>
          </button>
        )}
      </div>}
    </header>
  );
}
