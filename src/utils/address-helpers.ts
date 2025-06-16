// src/utils/address-helpers.ts

export function isValidEvmAddressFormat(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
