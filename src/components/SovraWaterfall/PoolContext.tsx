import { createContext, useContext } from 'react';
import type { PoolPrices } from './types';

export interface PoolCtx {
  /** Resolved native account id (null until resolved). */
  account: string | null;
  /** Every identity of the wallet: native id + claimed EVM address. */
  accounts: string[] | null;
  /** Live REEF + token USD prices, for row valueUsd. */
  prices: PoolPrices;
}

export const PoolContext = createContext<PoolCtx>({
  account: null,
  accounts: null,
  prices: { reefUsd: 0, pricesById: {} },
});

export const usePoolContext = () => useContext(PoolContext);
