import { AVATARS, type Seat } from '@holla/shared';

const PROFILE_KEY = 'holla:profile';
const seatKey = (code: string) => `holla:seat:${code.toUpperCase()}`;

export type Profile = { name: string; avatar: string };

/**
 * Two stores on purpose:
 *
 * - The profile (name, avatar) lives in localStorage. That is you, on this
 *   device, across every room and every visit.
 * - The seat lives in sessionStorage, which is per browser tab. It still
 *   survives a refresh, a crash and a dropped connection, which is what the
 *   60s grace window exists for. But two tabs are two players, so friends can
 *   share a laptop and a full table can be tested on one machine. With
 *   localStorage every tab would silently be the same person.
 *
 * Storage throws in some private-browsing modes, so every access is guarded
 * and the app stays usable without it — you just lose your seat on a refresh.
 */
function read<T>(store: Storage, key: string): T | null {
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(store: Storage, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* no storage, no problem */
  }
}

function remove(store: Storage, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadProfile(): Profile {
  const saved = read<Partial<Profile>>(localStorage, PROFILE_KEY);
  return {
    name: typeof saved?.name === 'string' ? saved.name : '',
    avatar: typeof saved?.avatar === 'string' ? saved.avatar : AVATARS[0],
  };
}

export function saveProfile(profile: Profile): void {
  write(localStorage, PROFILE_KEY, profile);
}

/** Per room code and per tab, so one browser can hold several seats. */
export function loadSeat(code: string): Seat | null {
  const saved = read<Seat>(sessionStorage, seatKey(code));
  if (!saved?.playerId || !saved?.secret) return null;
  return { ...saved, code: code.toUpperCase() };
}

export function saveSeat(seat: Seat): void {
  write(sessionStorage, seatKey(seat.code), seat);
}

export function clearSeat(code: string): void {
  remove(sessionStorage, seatKey(code));
}
