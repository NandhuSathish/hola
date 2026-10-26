import { describe, expect, it } from 'vitest';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  makeRoomCode,
  normaliseRoomCode,
} from './room-code.js';

/** Deterministic stand-in for Math.random, so these tests never flake. */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

describe('room codes', () => {
  it('has no lookalike letters', () => {
    expect(ROOM_CODE_ALPHABET).not.toContain('I');
    expect(ROOM_CODE_ALPHABET).not.toContain('O');
    expect(ROOM_CODE_ALPHABET).toHaveLength(24);
  });

  it('builds a code of the right length from the alphabet', () => {
    const code = makeRoomCode(seqRng([0, 0.5, 0.99, 0.25]));
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    expect([...code].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
  });

  it('is deterministic for a given rng', () => {
    const values = [0.1, 0.4, 0.7, 0.9];
    expect(makeRoomCode(seqRng(values))).toBe(makeRoomCode(seqRng(values)));
  });

  it('never runs off the end of the alphabet when rng returns almost 1', () => {
    const code = makeRoomCode(() => 0.999999999);
    expect(code).toBe('ZZZZ');
  });

  it('accepts codes case-insensitively', () => {
    expect(normaliseRoomCode('  kpxj ')).toBe('KPXJ');
    expect(isValidRoomCode('kpxj')).toBe(true);
  });

  it('rejects wrong lengths and lookalike letters', () => {
    expect(isValidRoomCode('KPX')).toBe(false);
    expect(isValidRoomCode('KPXJQ')).toBe(false);
    expect(isValidRoomCode('KPXI')).toBe(false);
    expect(isValidRoomCode('KPX0')).toBe(false);
  });
});
