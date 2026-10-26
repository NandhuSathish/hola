import { useEffect, useState } from 'react';

/**
 * Every animation in the app checks this. Rule 8 and REFERENCE.md section 8
 * both ask for the game to stay fully playable with motion turned off, so the
 * answer is always "skip the flourish", never "skip the state change".
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof matchMedia === 'function'
      ? matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
