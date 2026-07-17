import { useMemo } from 'react';
import { useQuery } from '@apollo/client';
import {
  POOL_STAKING_QUERY, POOL_TRANSFERS_QUERY, poolStakingWhere, poolTransferWhere, type TimeRange,
} from '@/data/pool';
import {
  stakingRowToSovraTx, transferRowToSovraTx, type RawStakingRow, type RawTransferRow,
} from '@/data/pool-adapter';
import type { ChannelId, PoolPrices, SovraTx } from '@/components/SovraWaterfall/types';

export interface UsePoolTransfersArgs {
  /** Every identity of the wallet (native id + claimed EVM address). */
  accounts: string[] | null;
  channel: ChannelId;
  prices: PoolPrices;
  enabled: boolean;
  range?: TimeRange;
  limit?: number;
}

export interface UsePoolTransfersReturn {
  txs: SovraTx[];
  loading: boolean;
}

/**
 * List of SovraTx rows for one channel + optional time range. Routes stakeIn to
 * the staking table and inflow/outflow/swap to transfer. Lazy via `enabled`.
 */
export function usePoolTransfers({
  accounts, channel, prices, enabled, range, limit = 50,
}: UsePoolTransfersArgs): UsePoolTransfersReturn {
  const isStake = channel === 'stakeIn';

  const where = useMemo(
    // staking rewards are always keyed by the native id (accounts[0])
    () => (isStake ? poolStakingWhere(accounts?.[0] ?? '', range) : poolTransferWhere(accounts ?? [], channel, range)),
    [isStake, accounts, channel, range],
  );

  const { data, loading } = useQuery(isStake ? POOL_STAKING_QUERY : POOL_TRANSFERS_QUERY, {
    variables: { where, limit },
    skip: !accounts?.length || !enabled,
    fetchPolicy: 'cache-first',
  });

  const txs = useMemo(() => {
    const rows = data?.rows ?? [];
    const now = Date.now();
    return isStake
      ? (rows as RawStakingRow[]).map((r) => stakingRowToSovraTx(r, prices, now))
      : (rows as RawTransferRow[]).map((r) => transferRowToSovraTx(r, accounts ?? [], prices, now));
  }, [data, isStake, accounts, prices]);

  return { txs, loading };
}
