// src/utils/reefscan-helpers.ts
import { UiTransfer } from '../data/transfer-mapper';

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

export function generateReefscanUrl(transaction: UiTransfer): string {
  const baseUrl = 'https://reefscan.com';

  // First, try to generate a specific transfer URL from the transaction ID.
  if (transaction.id) {
    const parts = transaction.id.split('-').map((part: string) => part.replace(/,/g, ''));
    if (parts.length === 3) {
      const [p0, p1, p2] = parts;
      if (parts.every((part: string) => /^\d+$/.test(part))) {
        if (parts.every((part: string) => !isNaN(Number(part)) && Number(part) >= 0)) {
          return `${baseUrl}/transfer/${p0}/${p1}/${p2}`;
        }
      }
      if (!isNaN(Number(p0)) && /^[0-9a-fA-F]+$/.test(p1) && !isNaN(Number(p2))) {
        return `${baseUrl}/transfer/${p0}/1/${p2}`;
      }
    } else if (parts.length === 2) {
      const [p0, p1] = parts;
      if (!isNaN(Number(p0)) && !isNaN(Number(p1))) {
        return `${baseUrl}/transfer/${p0}/${p1}/1`;
      }
    }
  }

  // If a transfer-specific URL can't be made, fall back to the extrinsic hash.
  if (transaction.extrinsicHash) {
    const cleanHash = transaction.extrinsicHash.startsWith('0x') ? transaction.extrinsicHash : `0x${transaction.extrinsicHash}`;
    if (cleanHash.length === 66 && /^[0-9a-fA-F]{64}$/.test(cleanHash.substring(2))) {
      return `${baseUrl}/extrinsic/${cleanHash}`;
    }
  }

  console.warn('Could not generate a valid Reefscan URL for transaction:', transaction);
  return '#'; // Fallback if no valid URL can be generated
}
