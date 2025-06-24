import { describe, it, expect } from 'vitest';
import {
  formatTimestamp,
  shortenHash,
  formatAmount,
  formatFee,
  formatTokenAmount,
} from './formatters';

describe('formatters', () => {
  describe('formatTimestamp', () => {
    it('should format a valid ISO string', () => {
      const timestamp = '2023-10-27T10:00:00.000Z';
      // Expected format: 10/27/2023, 01:00 PM (example for en-US with specific timezone)
      // Note: The exact output depends on the test runner's environment timezone.
      // We will check for constituent parts to make it more robust.
      const result = formatTimestamp(timestamp, 'en-US');
      expect(result).toContain('10/27/2023');
    });

    it('should handle invalid date strings', () => {
      expect(formatTimestamp('invalid-date')).toBe('Invalid Date');
    });
  });

  describe('shortenHash', () => {
    it('should shorten a long hash', () => {
      const hash = '0x1234567890abcdef1234567890abcdef';
      expect(shortenHash(hash)).toBe('0x1234...cdef');
    });

    it('should not shorten a short hash', () => {
      const hash = '0x12345';
      expect(shortenHash(hash)).toBe('0x12345');
    });

    it('should handle undefined hash', () => {
      expect(shortenHash(undefined)).toBe('N/A');
    });
  });

  describe('formatAmount and formatFee (unified tests for formatTokenAmount)', () => {
    // 1. Standard Formatting (numbers >= 1)
    it('should format standard amounts with 2 decimal places', () => {
      expect(formatAmount('123450000000000000000', 18, 'REEF')).toBe('123.45 REEF');
    });

    // 2. Small Fractional Amounts (< 1)
    it('should format small fractional amounts with more precision', () => {
      expect(formatAmount('123456789000000000', 18, 'REEF')).toBe('0.123457 REEF');
    });

    // 3. Compact Formatting for Thousands (K)
    it('should use K notation for thousands', () => {
      expect(formatAmount('1234560000000000000000', 18, 'REEF')).toBe('1.23K REEF');
    });

    // 4. Compact Formatting for Millions (M)
    it('should use M notation for millions', () => {
      expect(formatAmount('1234567000000000000000000', 18, 'REEF')).toBe('1.23M REEF');
    });

    // 5. Zero and Invalid Amounts
    it('should format zero correctly', () => {
      expect(formatAmount('0', 18, 'REEF')).toBe('0.00 REEF');
    });

                it('should display the symbol for zero-amount NFT transfers', () => {
      expect(formatAmount('0', 0, 'SqwidERC1155')).toBe('SqwidERC1155');
      expect(formatAmount(' 0 ', 0, 'CoolCatERC721')).toBe('CoolCatERC721');
    });

    it('should handle non-numeric strings', () => {
      expect(formatAmount('abc', 18, 'REEF')).toBe('0.00 REEF');
    });

    // 6. Fee Formatting (High Precision, No Compact)
    it('should format fees with high precision and no compact notation', () => {
      // fee is 12.34567890123456789, max 8 decimal places, so it should be 12.3456789
      expect(formatFee('12345678901234567890', 'REEF')).toBe('12.3456789 REEF');
    });

    it('should not use compact notation for large fees', () => {
      expect(formatFee('1234567000000000000000000', 'REEF')).toBe('1,234,567.00 REEF');
    });

    // 7. Different Locales
        it('should format numbers for a different locale (de-DE)', () => {
      // Test with a number that includes a thousands separator in de-DE.
      // 1234.56 should be formatted as 1.234,56 in German.
      // Note: Compact notation is brittle in test envs, so we test standard formatting.
      // We call formatTokenAmount directly to bypass the compact notation logic in formatAmount
      expect(formatTokenAmount('1234560000000000000000', 18, 'REEF', undefined, false, 'de-DE')).toBe('1.234,56 REEF');
    });
  });
});
