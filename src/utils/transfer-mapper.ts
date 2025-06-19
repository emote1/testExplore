import type { Transaction } from '../types/transaction-types';
import { determineDisplayType } from './reefscan-helpers';

interface ApiTransfer {
  id: string;
  amount: string;
  timestamp: string;
  success: boolean;
  extrinsicHash?: string;
  from?: { id: string };
  to?: { id: string };
  token?: {
    id: string;
    name?: string;
    contractData?: string;
  };
}

interface ParsedTokenData {
  symbol: string;
  decimals: number;
}

/**
 * Parse contract data from API token
 */
export function parseTokenData(contractData?: string): ParsedTokenData {
  const defaults = { symbol: 'REEF', decimals: 18 };
  
  if (!contractData) return defaults;
  
  try {
    const parsed = JSON.parse(contractData);
    return {
      symbol: parsed.symbol || defaults.symbol,
      decimals: parsed.decimals !== undefined 
        ? parseInt(parsed.decimals.toString(), 10) 
        : defaults.decimals
    };
  } catch {
    return defaults;
  }
}

/**
 * Convert API transfer to Transaction format
 */
export function mapTransferToTransaction(
  transfer: ApiTransfer, 
  userAddress?: string | null
): Transaction {
  const tokenData = parseTokenData(transfer.token?.contractData);
  const fromAddress = transfer.from?.id || '';
  const toAddress = transfer.to?.id || '';
  
  return {
    id: transfer.id,
    hash: transfer.extrinsicHash || '',
    timestamp: new Date(transfer.timestamp).toISOString(),
    from: fromAddress,
    to: toAddress,
    amount: transfer.amount,
    tokenSymbol: tokenData.symbol,
    tokenDecimals: tokenData.decimals,
    success: transfer.success,
    status: transfer.success ? 'Success' : 'Fail',
    extrinsicHash: transfer.extrinsicHash || null,
    extrinsicId: null,
    type: determineDisplayType('NATIVE_TRANSFER', fromAddress, toAddress, userAddress || ''),
    feeAmount: '0', // Fee data not available in polling
    feeTokenSymbol: 'REEF',
    signedData: undefined,
    raw: transfer
  };
}
