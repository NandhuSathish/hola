import { useEffect, useRef, useState } from 'react';

/**
 * How much of the current turn is left, 0-100, for a countdown ring.
 *
 * The server deliberately does not broadcast a countdown (REFERENCE.md §6):
 * it sends `turnEndsAt` once and the clock runs here. The turn's length is
 * inferred from when this client first saw the turn change, so nothing extra
 * has to travel and a late joiner simply sees a shorter first ring.
 */
export function useTurnCountdown(turnPlayerId: string, turnEndsAt: number | null): number {
  const [progress, setProgress] = useState(100);
  const startedAt = useRef(Date.now());
  const lastTurn = useRef(turnPlayerId);

  if (lastTurn.current !== turnPlayerId) {
    lastTurn.current = turnPlayerId;
    startedAt.current = Date.now();
  }

  useEffect(() => {
    if (turnEndsAt === null) {
      setProgress(100);
      return;
    }
    const total = Math.max(1, turnEndsAt - startedAt.current);
    const tick = () => {
      const left = turnEndsAt - Date.now();
      setProgress(Math.max(0, Math.min(100, (left / total) * 100)));
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [turnPlayerId, turnEndsAt]);

  return Math.round(progress);
}
