/**
 * Room codes are 4 letters. I and O are left out so nobody mistypes them as
 * 1 and 0 (REFERENCE.md section 5). Digits are not used at all.
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

/**
 * Pure: randomness is injected so tests can pin it. `rng` must return a float
 * in [0, 1) the way `Math.random` does.
 */
export function makeRoomCode(rng: () => number): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const index = Math.floor(rng() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[index] ?? ROOM_CODE_ALPHABET[0];
  }
  return code;
}

/** Codes are typed case-insensitively, so normalise before comparing. */
export function normaliseRoomCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidRoomCode(input: string): boolean {
  const code = normaliseRoomCode(input);
  if (code.length !== ROOM_CODE_LENGTH) return false;
  return [...code].every((char) => ROOM_CODE_ALPHABET.includes(char));
}
