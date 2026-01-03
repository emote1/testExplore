import { isValidEvmAddressFormat } from '@/utils/address-helpers';
import { useMemo } from 'react';
import { UiTransfer } from '../data/transfer-mapper';
import { isReefToken, isUsdcByName, safeBigInt } from '@/utils/token-helpers';
import { isUsdcId } from '@/tokens/token-ids';

interface UseTransactionFilterProps {
  initialTransactions: UiTransfer[];
  tokenFilter: string;
  tokenMinRaw?: string | null;
  tokenMaxRaw?: string | null;
  softFallbackActive: boolean;
  serverTokenIds: string[] | null;
  swapOnly: boolean;
}

export function useTransactionFilter({
  initialTransactions,
  tokenFilter,
  tokenMinRaw,
  tokenMaxRaw,
  softFallbackActive,
  serverTokenIds,
  swapOnly,
}: UseTransactionFilterProps) {
  return useMemo(() => {
    const all = initialTransactions || [];
    const list = swapOnly
      ? all.filter(t => (t as any).method === 'swap' || (t as any).type === 'SWAP')
      : all.filter(t => (t as any).method !== 'swap' && (t as any).type !== 'SWAP');
    
    if (tokenFilter === 'all') return list;

    const addrLower = isValidEvmAddressFormat(tokenFilter) ? tokenFilter.toLowerCase() : undefined;

    const minRaw = tokenMinRaw != null && tokenMinRaw !== '' ? safeBigInt(tokenMinRaw) : null;
    const maxRaw = tokenMaxRaw != null && tokenMaxRaw !== '' ? safeBigInt(tokenMaxRaw) : null;
    
    const passesAmt = (amt: bigint): boolean => {
      if (minRaw !== null && amt < minRaw) return false;
      if (maxRaw !== null && amt > maxRaw) return false;
      return true;
    };

    const useNameFallback = softFallbackActive || !serverTokenIds || serverTokenIds.length === 0;

    return list.filter(t => {
      if (tokenFilter === 'reef') {
        if (t.method === 'swap' && t.swapInfo) {
          const soldAmt = (t.swapInfo.sold as any).amountBI ?? safeBigInt(t.swapInfo.sold.amount);
          const boughtAmt = (t.swapInfo.bought as any).amountBI ?? safeBigInt(t.swapInfo.bought.amount);
          const soldOk = isReefToken(t.swapInfo.sold.token) && (!minRaw && !maxRaw ? true : passesAmt(soldAmt));
          const boughtOk = isReefToken(t.swapInfo.bought.token) && (!minRaw && !maxRaw ? true : passesAmt(boughtAmt));
          return soldOk || boughtOk;
        }
        if (!isReefToken(t.token)) return false;
        const amt = (t as any).amountBI ?? safeBigInt(t.amount);
        return (!minRaw && !maxRaw) ? true : passesAmt(amt);
      }
      
      if (tokenFilter === 'usdc') {
        if (t.method === 'swap' && t.swapInfo) {
          const soldAmt = (t.swapInfo.sold as any).amountBI ?? safeBigInt(t.swapInfo.sold.amount);
          const boughtAmt = (t.swapInfo.bought as any).amountBI ?? safeBigInt(t.swapInfo.bought.amount);
          const soldOk = (isUsdcId(t.swapInfo.sold.token.id) || (useNameFallback && isUsdcByName(t.swapInfo.sold.token))) && (!minRaw && !maxRaw ? true : passesAmt(soldAmt));
          const boughtOk = (isUsdcId(t.swapInfo.bought.token.id) || (useNameFallback && isUsdcByName(t.swapInfo.bought.token))) && (!minRaw && !maxRaw ? true : passesAmt(boughtAmt));
          return soldOk || boughtOk;
        }
        if (!(isUsdcId(t.token.id) || (useNameFallback && isUsdcByName((t as any).token)))) return false;
        const amt = (t as any).amountBI ?? safeBigInt(t.amount);
        return (!minRaw && !maxRaw) ? true : passesAmt(amt);
      }
      
      if (addrLower) {
        if (t.method === 'swap' && t.swapInfo) {
          const soldAmt = (t.swapInfo.sold as any).amountBI ?? safeBigInt(t.swapInfo.sold.amount);
          const boughtAmt = (t.swapInfo.bought as any).amountBI ?? safeBigInt(t.swapInfo.bought.amount);
          const soldOk = String(t.swapInfo.sold.token.id || '').toLowerCase() === addrLower && (!minRaw && !maxRaw ? true : passesAmt(soldAmt));
          const boughtOk = String(t.swapInfo.bought.token.id || '').toLowerCase() === addrLower && (!minRaw && !maxRaw ? true : passesAmt(boughtAmt));
          return soldOk || boughtOk;
        }
        if (String(t.token.id || '').toLowerCase() !== addrLower) return false;
        const amt = (t as any).amountBI ?? safeBigInt(t.amount);
        return (!minRaw && !maxRaw) ? true : passesAmt(amt);
      }
      
      return true;
    });
  }, [initialTransactions, tokenFilter, tokenMinRaw, tokenMaxRaw, softFallbackActive, serverTokenIds, swapOnly]);
}
