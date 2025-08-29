import { describe, it, expect } from 'vitest';
import { toU64 } from '../../../src/utils/number';

describe('utils/number toU64', () => {
  it('converts finite numbers, floors decimals, clamps negatives', () => {
    expect(toU64(42)).toBe(42);
    expect(toU64(42.9)).toBe(42);
    expect(toU64(-3)).toBe(0);
  });

  it('parses decimal and hex strings', () => {
    expect(toU64('42')).toBe(42);
    expect(toU64('0x2a')).toBe(42);
  });

  it('returns fallback for invalid inputs', () => {
    expect(toU64('not-a-number')).toBe(0);
    expect(toU64('not-a-number', 7)).toBe(7);
    expect(toU64(undefined)).toBe(0);
    expect(toU64(null, 5)).toBe(5);
  });

  it('handles other primitives via Number()', () => {
    expect(toU64(true)).toBe(1);
    // Objects and symbols become NaN -> fallback
    expect(toU64({} as any, 9)).toBe(9);
  });
});
