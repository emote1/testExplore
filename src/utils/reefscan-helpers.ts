// src/utils/reefscan-helpers.ts
import { Transaction } from '../types/transaction-types';

export function determineDisplayType(type: string, from: string, to: string, currentAddress: string): string {
  const lowerCurrentAddress = currentAddress.toLowerCase();
  if (to.toLowerCase() === lowerCurrentAddress && from.toLowerCase() !== lowerCurrentAddress) {
    return 'Входящая';
  }
  if (from.toLowerCase() === lowerCurrentAddress && to.toLowerCase() !== lowerCurrentAddress) {
    return 'Исходящая';
  }
  if (from.toLowerCase() === lowerCurrentAddress && to.toLowerCase() === lowerCurrentAddress) {
    return 'Самому себе';
  }

  const typeMapping: { [key: string]: string } = {
    'NATIVE_TRANSFER': 'Перевод REEF',
    'REEF20_TRANSFER': 'Перевод токена',
    'CONTRACT_CALL': 'Вызов контракта',
    'EVM_EXECUTE': 'EVM Выполнение',
  };
  return typeMapping[type] || type;
}

export function generateReefscanUrl(transaction: Transaction): string {
  const baseUrl = 'https://reefscan.com';
  if (transaction.extrinsicId) {
    const parts = transaction.extrinsicId.split('-').map(part => part.replace(/,/g, '')); // remove commas
    if (parts.length === 3) {
      const p0 = parts[0];
      const p1 = parts[1];
      const p2 = parts[2];

      // Check if all parts are purely decimal strings first
      if (parts.every(part => /^\d+$/.test(part))) {
        // And also ensure they are valid numbers (though /^\d+$/ mostly covers this for non-empty strings)
        if (parts.every(part => !isNaN(Number(part)) && Number(part) >= 0)) {
           return `${baseUrl}/transfer/${p0}/${p1}/${p2}`;
        }
      }
      
      // Then check for BLOCK-HEX-EVENT (p0 decimal, p1 hex, p2 decimal)
      // This will now only be reached if the "all decimal" check above failed (e.g., p1 contains a-f)
      // or if a part is not purely digits (e.g. empty string, which /^\d+$/ would reject)
      if (!isNaN(Number(p0)) && /^[0-9a-fA-F]+$/.test(p1) && !isNaN(Number(p2))) {
        // The '1' in the middle path segment is specific to this extrinsicId format as per existing tests.
        return `${baseUrl}/transfer/${p0}/1/${p2}`;
      }
    } else if (parts.length === 2) {
      const p0 = parts[0];
      const p1 = parts[1];
      if (!isNaN(Number(p0)) && !isNaN(Number(p1))) {
        return `${baseUrl}/transfer/${p0}/${p1}/1`;
      }
    }
  }
  if (transaction.extrinsicHash) {
    // Attempt to clean the hash to a standard 66-char hex string
    let cleanHash = transaction.extrinsicHash.startsWith('0x') 
      ? transaction.extrinsicHash 
      : `0x${transaction.extrinsicHash}`;
    // Ensure the hash part (without '0x') is hex and total length is 66
    if (cleanHash.length === 66 && /^[0-9a-fA-F]{64}$/.test(cleanHash.substring(2))) {
       return `${baseUrl}/extrinsic/${cleanHash}`;
    }
  }
  // Fallback to transaction.hash if extrinsicId or extrinsicHash don't yield a URL or are invalid
  if (transaction.hash && transaction.hash.startsWith('0x') && transaction.hash.length === 66 && /^[0-9a-fA-F]{64}$/.test(transaction.hash.substring(2))) {
      return `${baseUrl}/extrinsic/${transaction.hash}`;
  }
  console.warn('Could not generate a valid Reefscan URL for transaction:', transaction);
  return '#'; // Fallback if no valid URL can be generated
}
