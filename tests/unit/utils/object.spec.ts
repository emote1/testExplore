import { describe, it, expect } from 'vitest';
import { get, getString, getNumber } from '../../../src/utils/object';

describe('utils/object', () => {
  it('get returns nested values or undefined', () => {
    const obj = { a: { b: { c: 'str', d: 42, e: '0x2a' } } };
    expect(get(obj, ['a', 'b', 'c'])).toBe('str');
    expect(get(obj, ['a', 'b', 'd'])).toBe(42);
    expect(get(obj, ['a', 'x'])).toBeUndefined();
    expect(get({ a: null as unknown as object }, ['a', 'b'])).toBeUndefined();
  });

  it('getString only returns strings', () => {
    const obj = { a: { b: { c: 'str', d: 42 } } };
    expect(getString(obj, ['a', 'b', 'c'])).toBe('str');
    expect(getString(obj, ['a', 'b', 'd'])).toBeUndefined();
    expect(getString(obj, ['a', 'x'])).toBeUndefined();
  });

  it('getNumber parses number-like strings too', () => {
    const obj = { a: { b: { d: 42, e: '0x2a', f: 'not-a-number' } } };
    expect(getNumber(obj, ['a', 'b', 'd'])).toBe(42);
    expect(getNumber(obj, ['a', 'b', 'e'])).toBe(42);
    expect(getNumber(obj, ['a', 'b', 'f'])).toBeUndefined();
    expect(getNumber(obj, ['a', 'x'])).toBeUndefined();
  });
});
