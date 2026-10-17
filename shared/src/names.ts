import { NAME_MAX_LENGTH } from './events.js';

/** Trim, collapse inner whitespace, and clamp to the spec's 14 characters. */
export function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX_LENGTH);
}

/**
 * Names must be unique inside a room, so a clash gets a digit appended.
 * "Sam" against an existing "Sam" becomes "Sam2", then "Sam3", and the base is
 * shortened if the suffix would push it past the limit.
 */
export function uniqueName(desired: string, taken: readonly string[]): string {
  const base = cleanName(desired) || 'Player';
  const used = new Set(taken.map((n) => n.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;

  for (let n = 2; n < 100; n++) {
    const suffix = String(n);
    const room = NAME_MAX_LENGTH - suffix.length;
    const candidate = base.slice(0, room) + suffix;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return base.slice(0, NAME_MAX_LENGTH - 4) + Date.now().toString().slice(-3);
}

export function isValidName(raw: string): boolean {
  const name = cleanName(raw);
  return name.length >= 1 && name.length <= NAME_MAX_LENGTH;
}
