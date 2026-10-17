/**
 * 16 options so every seat at a full table of 15 stays distinct
 * (REFERENCE.md section 5). Order matches the mock's picker.
 */
export const AVATARS = [
  '🐯', '🦊', '🐼', '🐸', '🐙', '🦄', '🐨', '🐵',
  '🐺', '🐷', '🦁', '🐮', '🐔', '🐧', '🦉', '🐝',
] as const;

export type Avatar = (typeof AVATARS)[number];

export function isValidAvatar(value: string): value is Avatar {
  return (AVATARS as readonly string[]).includes(value);
}

/** First avatar not already taken in the room, falling back to the first. */
export function firstFreeAvatar(taken: readonly string[]): Avatar {
  const used = new Set(taken);
  return AVATARS.find((a) => !used.has(a)) ?? AVATARS[0];
}
