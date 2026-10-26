import { useEffect, useRef, useState } from 'react';
import { REACTIONS, type Reaction } from '@holla/shared';
import { usePrefersReducedMotion } from '../lib/motion';
import { isMuted, play, setMuted, warmUp } from '../lib/sound';
import './Reactions.css';

/** How long one emoji is in the air. Matches the CSS. */
const FLIGHT_MS = 1700;

type MenuProps = { onReact: (emoji: Reaction) => void };

/**
 * Reactions, as a button in the nav bar that opens a palette.
 *
 * The mock keeps these on a bar pinned across the bottom of the screen, as
 * part of the voicebar. That works there because the mock's table reserves a
 * strip for it; ours do not — on a phone it sat squarely on top of the Last
 * Card hand, and on a laptop it pushed the table below the fold. The top bar
 * is the one place that never competes with the game, so the palette lives
 * there and opens only when wanted.
 */
export function ReactionMenu({ onReact }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  const box = useRef<HTMLDivElement>(null);

  // A browser will not make a sound before the page has been touched, so the
  // first thing anyone presses is also what unlocks the audio.
  useEffect(() => {
    const unlock = () => warmUp();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Anywhere else, or Escape, puts it away.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <div className="reactmenu" ref={box}>
      <button
        type="button"
        className={`nav-react${open ? ' open' : ''}`}
        aria-expanded={open}
        aria-label="React"
        title="React"
        onClick={() => setOpen((on) => !on)}
      >
        🙂
      </button>

      {open && (
        <div className="sticker reactpop" role="group" aria-label="React">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="react"
              aria-label={`React ${emoji}`}
              onClick={() => {
                onReact(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}

          <span className="react-sep" aria-hidden="true" />

          <button
            type="button"
            className={`react mute${muted ? ' off' : ''}`}
            aria-pressed={muted}
            aria-label={muted ? 'Turn sounds on' : 'Turn sounds off'}
            title={muted ? 'Sounds off' : 'Sounds on'}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setMutedState(next);
              if (!next) {
                warmUp();
                play('tap');
              }
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      )}
    </div>
  );
}

type LayerProps = {
  reactions: { playerId: string; emoji: Reaction; id: number }[];
  onDone: (id: number) => void;
};

type Floater = {
  id: number;
  emoji: Reaction;
  left: number;
  top: number;
  drift: number;
};

/**
 * Emoji floating up from whoever threw them.
 *
 * Each one is pinned to its sender's seat at the moment it lands, by looking
 * for `[data-player="<id>"]` anywhere on the page — which is how a seat in
 * the lobby, a head in a seat strip and a row in a scorecard can all be the
 * anchor without any of them knowing about reactions. With nothing to pin to
 * it rises from the bottom of the screen instead, which is what happens when
 * the sender is off-screen or watching.
 *
 * Fixed positions, captured once: the layer does not follow a seat that
 * moves, because a 1.7s flight is shorter than anything that would move it.
 */
export function ReactionLayer({ reactions, onDone }: LayerProps) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const seen = useRef(new Set<number>());
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const fresh = reactions.filter((r) => !seen.current.has(r.id));
    if (fresh.length === 0) return;

    const added: Floater[] = [];
    for (const r of fresh) {
      seen.current.add(r.id);
      const seat = document.querySelector(`[data-player="${CSS.escape(r.playerId)}"]`);
      const box = seat?.getBoundingClientRect();
      added.push({
        id: r.id,
        emoji: r.emoji,
        left: box ? box.left + box.width / 2 : window.innerWidth / 2,
        top: box ? box.top : window.innerHeight - 140,
        drift: Math.random() * 80 - 40,
      });
    }

    play('pop');
    setFloaters((current) => [...current, ...added]);
    const timer = window.setTimeout(
      () => {
        setFloaters((current) => current.filter((f) => !added.some((a) => a.id === f.id)));
        for (const a of added) doneRef.current(a.id);
      },
      reduced ? 700 : FLIGHT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [reactions, reduced]);

  if (floaters.length === 0) return null;

  return (
    <div className="reaction-layer" aria-hidden="true">
      {floaters.map((f) => (
        <span
          key={f.id}
          className="floaty"
          style={{
            left: f.left,
            top: f.top,
            ['--dx' as string]: `${f.drift}px`,
          }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}
