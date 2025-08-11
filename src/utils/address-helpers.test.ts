/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest';
import { 
  isValidEvmAddressFormat, 
  isValidSubstrateAddressFormat, 
  getAddressType, 
  isValidAddress 
} from './address-helpers';

describe('address-helpers', () => {

  describe('isValidEvmAddressFormat', () => {
    it('should return true for a valid EVM address', () => {
      expect(isValidEvmAddressFormat('0x1234567890123456789012345678901234567890')).toBe(true);
    });

    it('should return false for an invalid EVM address', () => {
      expect(isValidEvmAddressFormat('not-an-address')).toBe(false);
      expect(isValidEvmAddressFormat('0x123')).toBe(false); // too short
      expect(isValidEvmAddressFormat('1234567890123456789012345678901234567890')).toBe(false); // no 0x prefix
    });
  });

  describe('isValidSubstrateAddressFormat', () => {
    it('should return true for a valid Substrate address', () => {
      expect(isValidSubstrateAddressFormat('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')).toBe(true);
    });

    it('should return false for an invalid Substrate address', () => {
      expect(isValidSubstrateAddressFormat('not-an-address')).toBe(false);
      expect(isValidSubstrateAddressFormat('0x1234567890123456789012345678901234567890')).toBe(false); // EVM address
      expect(isValidSubstrateAddressFormat('5GrwvaEF')).toBe(false); // too short
    });
  });

  describe('getAddressType', () => {
    it('should return "evm" for valid EVM addresses', () => {
      expect(getAddressType('0x1234567890123456789012345678901234567890')).toBe('evm');
    });

    it('should return "substrate" for valid Substrate addresses', () => {
      expect(getAddressType('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')).toBe('substrate');
    });

    it('should return "invalid" for invalid addresses', () => {
      expect(getAddressType('not-an-address')).toBe('invalid');
      expect(getAddressType('')).toBe('invalid');
    });
  });

  describe('isValidAddress', () => {
    it('should return true for valid EVM addresses', () => {
      expect(isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true);
    });

    it('should return true for valid Substrate addresses', () => {
      expect(isValidAddress('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')).toBe(true);
    });

    it('should return false for invalid addresses', () => {
      expect(isValidAddress('not-an-address')).toBe(false);
      expect(isValidAddress('')).toBe(false);
    });
  });
});
