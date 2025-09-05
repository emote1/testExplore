import { describe, it, expect } from 'vitest';
import { createNewItemDetector } from '../../../src/utils/transfer-new-items';

interface Item { id: string }

describe('createNewItemDetector', () => {
  it('primes on first call and returns empty array', () => {
    const detector = createNewItemDetector<Item>({ key: (i) => i.id, max: 10 });
    const first = detector.detectNew([{ id: 'a' }, { id: 'b' }]);
    expect(first).toEqual([]);
  });

  it('returns only new items on subsequent calls', () => {
    const detector = createNewItemDetector<Item>({ key: (i) => i.id, max: 10 });
    void detector.detectNew([{ id: 'a' }, { id: 'b' }]); // prime
    const res = detector.detectNew([{ id: 'b' }, { id: 'c' }]);
    expect(res.map(i => i.id)).toEqual(['c']);
  });

  it('evicts oldest when exceeding max and redetects evicted as new', () => {
    const detector = createNewItemDetector<Item>({ key: (i) => i.id, max: 3 });
    void detector.detectNew([{ id: 'a' }, { id: 'b' }, { id: 'c' }]); // prime with 3
    // add a new one -> evict oldest 'a'
    const res1 = detector.detectNew([{ id: 'd' }]);
    expect(res1.map(i => i.id)).toEqual(['d']);
    // 'a' should now be considered new again
    const res2 = detector.detectNew([{ id: 'a' }]);
    expect(res2.map(i => i.id)).toEqual(['a']);
  });

  it('ignores items with falsy keys', () => {
    const detector = createNewItemDetector<{ id?: string | null }>({ key: (i) => i.id ?? undefined, max: 5 });
    const first = detector.detectNew([{ id: null }, { id: undefined }, {}]);
    expect(first).toEqual([]);
    const res = detector.detectNew([{ id: 'x' }, { id: null }]);
    expect(res.map(i => i.id)).toEqual(['x']);
  });

  it('add() marks ids as seen and prevents them from being detected', () => {
    const detector = createNewItemDetector<Item>({ key: (i) => i.id, max: 10 });
    void detector.detectNew([{ id: 'a' }]); // prime with 'a'
    detector.add('c'); // manually mark 'c' as seen
    const res = detector.detectNew([{ id: 'b' }, { id: 'c' }, { id: 'd' }]);
    // 'c' should not be considered new; 'b' and 'd' are new
    expect(res.map(i => i.id)).toEqual(['b', 'd']);
  });

  it('reset() clears memory and primes again', () => {
    const detector = createNewItemDetector<Item>({ key: (i) => i.id, max: 10 });
    void detector.detectNew([{ id: 'a' }, { id: 'b' }]); // prime
    detector.reset();
    // first call after reset should prime again and return []
    const firstAfterReset = detector.detectNew([{ id: 'b' }, { id: 'c' }]);
    expect(firstAfterReset).toEqual([]);
    // next call should detect only truly new ones compared to last prime
    const secondAfterReset = detector.detectNew([{ id: 'c' }, { id: 'd' }]);
    expect(secondAfterReset.map(i => i.id)).toEqual(['d']);
  });

  it('does not misalign items when some keys are falsy (regression)', () => {
    const detector = createNewItemDetector<{ id?: string | null }>({ key: (i) => i.id ?? undefined, max: 5 });
    void detector.detectNew([{ id: 'a' }]); // prime state
    const res = detector.detectNew([{ id: null }, { id: 'b' }]);
    expect(res.map(i => i.id)).toEqual(['b']);
  });
});
