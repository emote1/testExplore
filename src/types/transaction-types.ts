// src/types/transaction-types.ts
import type { ApiPageInfo } from '../types/reefscan-api'; // Added import

// Интерфейсы для signedData
export interface SignedDataFee {
  partialFee: string;
}

export interface SignedData {
  fee: SignedDataFee;
}

// Пример интерфейса для транзакции
export interface Transaction {
  id: string;
  hash: string; // Added for easier access than extrinsicHash
  timestamp: string;
  from: string;
  to: string;
  fromEvm?: string;
  toEvm?: string;
  amount: string;
  tokenSymbol: string;
  tokenDecimals: number;
  success: boolean;
  status: 'Success' | 'Fail'; // Added for display
  extrinsicHash?: string | null;
  extrinsicId?: string | null;
  type: string;
  feeAmount: string;
  feeTokenSymbol: string; // Added for fee display
  signedData?: SignedData;
  raw?: any; // Added for raw transaction data
}

export interface SortConfig {
  key: keyof Transaction | null;
  direction: 'asc' | 'desc';
}

// Block-based pagination interfaces
export interface TransactionBlock {
  transactions: Transaction[];
  pageInfo: ApiPageInfo;
  totalCount: number;
  fetchedAt: number;
  nativeAddress: string;
}

export interface BlockPaginationState {
  currentBlock: TransactionBlock | null;
  currentBlockStartPage: number;
  remainingTransactions: Transaction[];
}
