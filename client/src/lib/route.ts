import { useEffect, useState } from 'react';
import { isValidRoomCode, normaliseRoomCode } from '@holla/shared';

export type Route = { screen: 'home' } | { screen: 'room'; code: string };

/** /r/KPXJ is the invite link; everything else is home. */
export function parseRoute(pathname: string): Route {
  const match = /^\/r\/([a-zA-Z]{4})\/?$/.exec(pathname);
  const code = match?.[1];
  if (code && isValidRoomCode(code)) {
    return { screen: 'room', code: normaliseRoomCode(code) };
  }
  return { screen: 'home' };
}

export function navigate(to: string): void {
  if (window.location.pathname === to) return;
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Five screens do not need a router library, just the history API and a
 * listener. Back and forward work because we push real URLs.
 */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return route;
}

export const roomPath = (code: string) => `/r/${code.toUpperCase()}`;
