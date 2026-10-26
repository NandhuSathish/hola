/**
 * Board layout, lifted from design/snakes-ladders-mock.html.
 *
 * 100 tiles in a 10x10 boustrophedon: tile 1 is bottom-left, numbering runs
 * right along the bottom row, then left along the next one up, and so on.
 */
export const FIRST_TILE = 1;
export const LAST_TILE = 100;
export const COLUMNS = 10;

/** [foot, head] — climbing one takes you up. */
export const LADDERS: readonly (readonly [number, number])[] = [
  [4, 25],
  [13, 34],
  [21, 42],
  [28, 55],
  [50, 69],
  [62, 81],
  [74, 92],
];

/** [head, tail] — landing on a head drops you to the tail. */
export const SNAKES: readonly (readonly [number, number])[] = [
  [99, 41],
  [93, 72],
  [89, 53],
  [76, 58],
  [64, 36],
  [49, 11],
  [46, 25],
  [32, 10],
];

/** Gift tiles. The cards themselves arrive in 4b. */
export const MYSTERY_TILES: readonly number[] = [7, 17, 38, 45, 57, 67, 79, 86, 95];

/** Megaphone tiles, where the room votes on your fate. Also 4b. */
export const CROWD_TILES: readonly number[] = [24, 60, 84];

export function ladderAt(tile: number): number | null {
  return LADDERS.find(([foot]) => foot === tile)?.[1] ?? null;
}

export function snakeAt(tile: number): number | null {
  return SNAKES.find(([head]) => head === tile)?.[1] ?? null;
}

/**
 * Row and column for a tile, with row 0 at the bottom. Rendering lives in the
 * client, but the mapping is a property of the board, so it belongs here and
 * can be tested.
 */
export function tileToCell(tile: number): { row: number; col: number } {
  const i = tile - FIRST_TILE;
  const row = Math.floor(i / COLUMNS);
  const col = row % 2 === 0 ? i % COLUMNS : COLUMNS - 1 - (i % COLUMNS);
  return { row, col };
}

/**
 * Walking `steps` tiles from `from`, one at a time, bouncing back off 100.
 * Returns every tile stepped on, so the client can animate hop by hop.
 *
 * The mock bounces unconditionally inside `walk`; whether an overshoot is even
 * attempted is decided by the exact-finish setting before this is called.
 */
export function walkPath(from: number, steps: number): number[] {
  const path: number[] = [];
  let at = from;
  let bounced = false;

  for (let i = 0; i < Math.abs(steps); i++) {
    let next = at + (bounced ? -1 : Math.sign(steps));
    if (next > LAST_TILE) {
      bounced = true;
      next = LAST_TILE - 1;
    }
    if (next < FIRST_TILE) next = FIRST_TILE;
    at = next;
    path.push(at);
  }

  return path;
}
