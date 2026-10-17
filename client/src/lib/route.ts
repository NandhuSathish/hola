import { useEffect, useState } from 'react';
import { isValidRoomCode, normaliseRoomCode } from '@holla/shared';

export type Route =
  | { screen: 'home' }
  /** Picking a game. With a code the host is swapping it; without, a new room. */
  | { screen: 'games'; code: string | null }
  | { screen: 'lobby'; code: string };

export function parseRoute(pathname: string): Route {
  if (/^\/games\/?$/.test(pathname)) return { screen: 'games', code: null };

  const room = /^\/r\/([a-zA-Z]{4})(\/games)?\/?$/.exec(pathname);
  const raw = room?.[1];
  if (raw && isValidRoomCode(raw)) {
    const code = normaliseRoomCode(raw);
    return room[2] ? { screen: 'games', code } : { screen: 'lobby', code };
  }

  return { screen: 'home' };
}

export function navigate(to: string): void {
  if (window.location.pathname === to) return;
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * A handful of screens do not need a router dependency, just the history API
 * and a listener. Back and forward work because we push real URLs.
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
export const gamesPath = (code?: string | null) =>
  code ? `/r/${code.toUpperCase()}/games` : '/games';
