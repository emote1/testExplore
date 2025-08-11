// src/utils/address-helpers.ts
import { u8aToHex } from '@polkadot/util';
import { decodeAddress } from '@polkadot/util-crypto';

/**
 * Validates if a string is a valid EVM address format (0x + 40 hex characters)
 */
export function isValidEvmAddressFormat(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates if a string is a valid Substrate address format (SS58)
 * Basic validation for Reef Chain addresses
 */
export function isValidSubstrateAddressFormat(address: string): boolean {
  // Basic SS58 format validation - starts with 5 and is 47-48 characters
  return /^5[1-9A-HJ-NP-Za-km-z]{46,47}$/.test(address);
}

/**
 * Determines the type of address (EVM, Substrate, or invalid)
 */
export function getAddressType(address: string): 'evm' | 'substrate' | 'invalid' {
  if (isValidEvmAddressFormat(address)) {
    return 'evm';
  }
  if (isValidSubstrateAddressFormat(address)) {
    return 'substrate';
  }
  return 'invalid';
}

/**
 * Validates if an address is in any supported format
 */
export function isValidAddress(address: string): boolean {
  return getAddressType(address) !== 'invalid';
}

/**
 * Converts a Substrate address to its EVM equivalent.
 * If the address is already in EVM format, it returns it directly.
 * Throws an error for invalid address formats.
 * @param address The address to convert.
 * @returns The EVM address string.
 */
export function convertAddressToEvm(address: string): string {
  if (isValidEvmAddressFormat(address)) {
    return address;
  }
  if (isValidSubstrateAddressFormat(address)) {
    const decoded = decodeAddress(address);
    return u8aToHex(decoded);
  }
  throw new Error(`Invalid address format: ${address}`);
}
