// src/types/transaction-types.ts

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
  hash: string; // Added for transaction hash display
  blockNumber?: number;
  from: string;
  to: string;
  timestamp: string;
  type: string;
  extrinsicHash?: string | null;
  extrinsicId?: string | null;
  signer: string;
  section: string;
  method: string;
  recipient: string;
  sender: string; // Added for consistency
  amount: string | number;
  status?: string;
  success?: boolean; // Added for success status
  displayType?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  feeAmount?: number; // Added for fee display
  feeTokenSymbol?: string; // Added for fee token
  signedData?: SignedData;
  raw?: any; // Added for raw transaction data
}

export interface SortConfig {
  key: keyof Transaction | null;
  direction: 'asc' | 'desc';
}
