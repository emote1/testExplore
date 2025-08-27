import { describe, it, expect } from 'vitest';
import { parseDataUrlJson } from '../../../src/utils/data-url';

function toBase64(s: string): string {
  // Node or browser env: rely on Buffer if present
  const B = (globalThis as any).Buffer as typeof Buffer | undefined;
  if (B) return B.from(s, 'utf-8').toString('base64');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const btoaFn = (globalThis as any).btoa as ((s: string) => string) | undefined;
  if (btoaFn) return btoaFn(s);
  throw new Error('No base64 encoder in this environment');
}

describe('utils/data-url', () => {
  it('parses base64 data:application/json', () => {
    const obj = { name: 'x', image: 'ipfs://hash' };
    const json = JSON.stringify(obj);
    const dataUrl = `data:application/json;base64,${toBase64(json)}`;
    const parsed = parseDataUrlJson(dataUrl);
    expect(parsed).toEqual(obj);
  });

  it('parses URL-encoded data:application/json', () => {
    const obj = { a: 1, b: 'str' };
    const json = encodeURIComponent(JSON.stringify(obj));
    const dataUrl = `data:application/json,${json}`;
    const parsed = parseDataUrlJson(dataUrl);
    expect(parsed).toEqual(obj);
  });

  it('returns null for invalid json', () => {
    const bad = 'data:application/json,%7Bbad';
    expect(parseDataUrlJson(bad)).toBeNull();
  });

  it('returns null for non-data url', () => {
    expect(parseDataUrlJson('http://example.com')).toBeNull();
  });
});
