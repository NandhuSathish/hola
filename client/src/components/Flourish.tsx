import { memo, useCallback, useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '../lib/motion';
import './Flourish.css';

/** A short message that slides in under the top bar and leaves on its own. */
export function Toast({ message }: { message: string | null }) {
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    setShown(message);
    const timer = setTimeout(() => setShown(null), 2200);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className={`toast${shown ? ' show' : ''}`} role="status" aria-live="polite">
      {shown}
    </div>
  );
}

/** The big "Last card!" slam. `at` changes to fire it again. */
export function Stamp({ text, at }: { text: string; at: number }) {
  const reduced = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (at === 0) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), reduced ? 900 : 1100);
    return () => clearTimeout(timer);
  }, [at, reduced]);

  if (!visible) return null;

  return (
    <div className={`stamp${reduced ? ' still' : ''}`} aria-hidden="true">
      <span key={at}>{text}</span>
    </div>
  );
}

const CONFETTI_COLOURS = ['var(--red)', 'var(--sun)', 'var(--mint)', 'var(--sky)', 'var(--pink)'];

/** Falls once when the results screen opens. Skipped entirely under reduced motion. */
export function Confetti({ pieces = 46 }: { pieces?: number }) {
  const reduced = usePrefersReducedMotion();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => setGone(true), 4200);
    return () => clearTimeout(timer);
  }, [reduced]);

  if (reduced || gone) return null;

  return (
    <div className="confetti-layer" aria-hidden="true">
      {Array.from({ length: pieces }).map((_, i) => (
        <i
          key={i}
          className="confetti"
          style={{
            left: `${(i * 97) % 100}vw`,
            background: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
            borderRadius: i % 3 === 0 ? '50%' : undefined,
            animationDuration: `${1.8 + ((i * 37) % 16) / 10}s`,
            animationDelay: `${((i * 13) % 50) / 100}s`,
            ['--r' as string]: `${((i * 71) % 720) - 360}deg`,
          }}
        />
      ))}
    </div>
  );
}

export type FlightPlan = {
  /** Where the card started, in viewport coordinates. */
  from: DOMRect;
  /** Where it is headed, captured at the same moment. */
  to: DOMRect;
  /** What it looked like. */
  node: React.ReactNode;
  id: number;
};

/**
 * Animates a card from the hand to the discard pile.
 *
 * Driven by the Web Animations API rather than CSS. The table re-renders
 * several times a second while the turn ring counts down, and anything that
 * lives in the style attribute gets rewritten by React on each of those —
 * which restarts a CSS animation and pins the card at its start. element
 * .animate() runs outside React's reconciliation, so it is immune to that.
 *
 * It is pure decoration: the move has already been sent, so skipping or
 * interrupting this changes nothing about the game.
 */
function FlyingCardImpl({ plan, onDone }: { plan: FlightPlan | null; onDone: () => void }) {
  const reduced = usePrefersReducedMotion();

  const start = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !plan || reduced) return;

      const dx = plan.to.left + plan.to.width / 2 - (plan.from.left + plan.from.width / 2);
      const dy = plan.to.top + plan.to.height / 2 - (plan.from.top + plan.from.height / 2);
      const scale = plan.from.width > 0 ? plan.to.width / plan.from.width : 1;
      const spin = (plan.id % 19) - 9;

      const animation = node.animate(
        [
          { transform: 'translate(0, 0) rotate(0deg) scale(1)' },
          { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(${scale})` },
        ],
        { duration: 420, easing: 'cubic-bezier(0.3, 1.3, 0.5, 1)', fill: 'forwards' },
      );

      animation.finished.then(onDone).catch(() => {
        // cancelled because the card unmounted first; nothing to clean up
      });
    },
    [plan, reduced, onDone],
  );

  if (!plan || reduced) return null;

  return (
    <div
      ref={start}
      className="flying-card"
      aria-hidden="true"
      style={{ left: plan.from.left, top: plan.from.top, width: plan.from.width }}
    >
      {plan.node}
    </div>
  );
}

/** Memoised on the plan, so the turn ring's ticking cannot disturb a flight. */
export const FlyingCard = memo(
  FlyingCardImpl,
  (prev, next) => prev.plan?.id === next.plan?.id && prev.onDone === next.onDone,
);
