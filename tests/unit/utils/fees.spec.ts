import { describe, it, expect } from 'vitest';
import { extractFeeFromEventData, sumFeesFromEvents } from '../../../src/utils/fees';

describe('utils/fees', () => {
  describe('extractFeeFromEventData', () => {
    it('parses array form [who, actual_fee, tip]', () => {
      const who = '0x8De305c88Ec150c707517858E3ea67fEdD5180FF';
      const actual = '1000000000000000000'; // 1 REEF in wei
      const tip = '200000000000000000'; // 0.2 REEF
      expect(extractFeeFromEventData([who, actual, tip])).toBe('1200000000000000000');
    });

    it('parses object form { actual_fee, tip }', () => {
      expect(extractFeeFromEventData({ actual_fee: '123', tip: '7' })).toBe('130');
    });

    it('parses object form with camelCase { actualFee, tip }', () => {
      expect(extractFeeFromEventData({ actualFee: '5', tip: 2 })).toBe('7');
    });

    it('handles bigint, hex and number inputs', () => {
      expect(extractFeeFromEventData(['0x0', 10n, '0x5'])).toBe('15');
      expect(extractFeeFromEventData(['0x0', '0xa', 5])).toBe('15');
    });

    it('falls back to 0 for invalid input', () => {
      // unknown shape
      expect(extractFeeFromEventData(null)).toBe('0');
      // string non-numeric
      expect(extractFeeFromEventData({ value: 'abc' })).toBe('0');
    });
  });

  describe('sumFeesFromEvents', () => {
    it('sums fees across multiple events', () => {
      const events = [
        { data: ['0xaddr', '10', '2'] },
        { data: { actual_fee: '3', tip: '0' } },
        { data: { actualFee: '5', tip: 1 } },
      ];
      expect(sumFeesFromEvents(events)).toBe('21');
    });

    it('returns 0 on empty or undefined', () => {
      expect(sumFeesFromEvents([])).toBe('0');
      expect(sumFeesFromEvents(undefined)).toBe('0');
    });
  });
});
