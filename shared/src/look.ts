/**
 * What your fighter looks like.
 *
 * Lifted straight from design/snakes-ladders-mock.html, which stores the same
 * three numbers under `holla-fighter`. It replaces the emoji avatar: both
 * mocks draw a player as a little boxer's head, not a picture of an animal,
 * and the same figure is the token on the board.
 *
 * Indices rather than names, so the wire payload stays tiny and a client that
 * is a version behind still renders something.
 */

/** Skin tones, light to dark. */
export const SKINS = ['#FFDDB8', '#F2C08F', '#D79A64', '#A86B3C', '#6E4325'] as const;

/** Hair colours, the last two deliberately unnatural. */
export const HAIRS = ['#2B1B12', '#1D1530', '#8A3B1F', '#E8B64C', '#FF8EC0', '#2EC4B6'] as const;

/** Head styles. `hat` is the fabric colour where the style wears one. */
export const STYLES = [
  { id: 'cap', name: 'Cap', hat: '#FF4D4D' },
  { id: 'beanie', name: 'Beanie', hat: '#FFC21A' },
  { id: 'spiky', name: 'Spiky' },
  { id: 'bun', name: 'Bun' },
  { id: 'band', name: 'Headband', hat: '#FF4D4D' },
  { id: 'curly', name: 'Curls' },
  { id: 'mohawk', name: 'Mohawk' },
  { id: 'hood', name: 'Bunny hood', hat: '#FFF4DC' },
] as const;

/** Jersey colours, one per seat. 8 of them, reused once past eight players. */
export const TEAM_COLOURS = [
  '#2F8BFF', '#FF5FA8', '#22C97A', '#FFC21A',
  '#B48CFF', '#FF4D4D', '#FF9F45', '#5FD3E8',
] as const;

/** Shorts, a darker partner for each jersey. */
export const SHORTS = [
  '#1A55B8', '#C42F78', '#178F55', '#C8901A',
  '#7E5BD0', '#C42F2F', '#C76E1F', '#2A9DB5',
] as const;

export type Look = { style: number; skin: number; hair: number };

export const DEFAULT_LOOK: Look = { style: 0, skin: 1, hair: 0 };

const clamp = (value: unknown, length: number): number => {
  const n = typeof value === 'number' ? Math.floor(value) : NaN;
  return Number.isFinite(n) && n >= 0 && n < length ? n : 0;
};

/**
 * Anything off the wire goes through here. An out-of-range index would throw
 * inside the renderer on every frame, so it is clamped rather than rejected.
 */
export function sanitiseLook(value: unknown): Look {
  const raw = (value ?? {}) as Partial<Look>;
  return {
    style: clamp(raw.style, STYLES.length),
    skin: clamp(raw.skin, SKINS.length),
    hair: clamp(raw.hair, HAIRS.length),
  };
}

/** A look nobody in the room is wearing yet, so seats stay tellable apart. */
export function freeLook(taken: readonly Look[]): Look {
  const used = new Set(taken.map((l) => `${l.style}-${l.hair}`));
  for (let style = 0; style < STYLES.length; style++) {
    for (let hair = 0; hair < HAIRS.length; hair++) {
      if (!used.has(`${style}-${hair}`)) {
        return { style, skin: (style + hair) % SKINS.length, hair };
      }
    }
  }
  return DEFAULT_LOOK;
}
