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

export function generateReefscanUrl(tx: Pick<Transaction, 'extrinsicId' | 'extrinsicHash'>): string | null {
  if (tx.extrinsicId) {
    const parts = tx.extrinsicId.split('-').map(part => part.replace(/,/g, ''));
    if (parts.length === 3) {
      const p0 = parts[0];
      const p1 = parts[1];
      const p2 = parts[2];
      // Проверяем, является ли первая и третья часть числом, а вторая - шестнадцатеричной строкой
      if (/^\d+$/.test(p0) && /^[0-9a-fA-F]+$/.test(p1) && /^\d+$/.test(p2)) {
        // Если средняя часть - hex, но не является стандартным индексом (например, 'cf30d')
        // и при этом первая и третья часть - числа (блок и событие)
        // Это особый случай для extrinsicId типа 0012580519-cf30d-000001
        // где cf30d не является стандартным индексом события, а скорее частью хеша.
        // В таких случаях Reefscan использует /1/ для второго параметра.
        if (p1.length > 2 && !/^\d+$/.test(p1)) { // Длиннее двух символов и не число
            return `https://reefscan.com/transfer/${p0}/1/${p2}`;
        }
        return `https://reefscan.com/transfer/${p0}/${p1}/${p2}`;
      }
    } else if (parts.length === 2) {
      const p0 = parts[0];
      const p1 = parts[1];
      if (/^\d+$/.test(p0) && /^\d+$/.test(p1)) {
        return `https://reefscan.com/transfer/${p0}/${p1}/1`; // Добавляем /1 как индекс события по умолчанию
      }
    }
  }

  if (tx.extrinsicHash) {
    let cleanHash = tx.extrinsicHash;
    if (tx.extrinsicHash.startsWith('0x') && tx.extrinsicHash.length === 66) {
      // Хеш уже в правильном формате
    } else if (!tx.extrinsicHash.startsWith('0x') && tx.extrinsicHash.length === 64) {
      cleanHash = `0x${tx.extrinsicHash}`;
    } else {
      // Нестандартный формат хеша, пытаемся его "очистить" или возвращаем null, если невозможно
      const match = tx.extrinsicHash.match(/[0-9a-fA-F]{64}/);
      if (match) {
        cleanHash = `0x${match[0]}`;
      } else {
        console.warn('Cannot determine a valid extrinsic hash for Reefscan link:', tx.extrinsicHash);
        return null; // Не удалось сформировать ссылку
      }
    }
    return `https://reefscan.com/extrinsic/${cleanHash}`;
  }
  return null;
}
