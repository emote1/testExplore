import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TransactionDirection } from '@/utils/transfer-query';

export type TxTypeFilter = 'all' | 'incoming' | 'outgoing' | 'swap' | 'staking';

interface TransactionFilterState {
  txType: TxTypeFilter;
  direction: TransactionDirection;
  tokenFilter: string;
  minAmountInput: string;
  maxAmountInput: string;
  customDecimals: number | null;
  
  // Actions
  setTxType: (type: TxTypeFilter) => void;
  setDirection: (direction: TransactionDirection) => void;
  setTokenFilter: (token: string) => void;
  setMinAmountInput: (min: string) => void;
  setMaxAmountInput: (max: string) => void;
  setCustomDecimals: (decimals: number | null) => void;
  resetFilters: () => void;
}

export const useTransactionFilterStore = create<TransactionFilterState>()(
  persist(
    (set) => ({
      txType: 'all',
      direction: 'any',
      tokenFilter: 'all',
      minAmountInput: '',
      maxAmountInput: '',
      customDecimals: null,

      setTxType: (txType) => set({ 
        txType, 
        direction: txType === 'incoming' || txType === 'outgoing' ? txType : 'any' 
      }),
      setDirection: (direction) => set({ direction }),
      setTokenFilter: (tokenFilter) => set({ tokenFilter, customDecimals: null }),
      setMinAmountInput: (minAmountInput) => set({ minAmountInput }),
      setMaxAmountInput: (maxAmountInput) => set({ maxAmountInput }),
      setCustomDecimals: (customDecimals) => set({ customDecimals }),
      resetFilters: () => set({
        txType: 'all',
        direction: 'any',
        tokenFilter: 'all',
        minAmountInput: '',
        maxAmountInput: '',
        customDecimals: null,
      }),
    }),
    {
      name: 'transaction-filter-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist specific fields
      partialize: (state) => ({
        txType: state.txType,
        direction: state.direction,
        tokenFilter: state.tokenFilter,
      }),
    }
  )
);
