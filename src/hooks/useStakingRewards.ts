import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { STAKINGS_CONNECTION_QUERY, STAKINGS_LIST_QUERY, buildStakingWhere } from '@/data/staking';
import { useAddressResolver } from './use-address-resolver';
import { isHasuraExplorerMode } from '@/utils/transfer-query';

export interface UiReward {
  id: string;
  amount: string; // base units (REEF 18)
  timestamp: string;
  extrinsicHash?: string | null;
  signer: string;
}

interface UseStakingRewardsReturn {
  rewards: UiReward[];
  loading: boolean;
  error?: Error;
  pageIndex: number;
  pageCount: number;
  setPageIndex: (i: number) => void;
  totalCount: number;
  pageSize: number;
}

export function useStakingRewards(accountAddress: string | null | undefined, pageSize = 25): UseStakingRewardsReturn {
  const { resolveAddress } = useAddressResolver();
  const [resolved, setResolved] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const stakingWhere = useMemo(
    () => (resolved ? buildStakingWhere({ accountId: resolved }) : null),
    [resolved]
  );

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (!accountAddress) {
          setResolved(null);
          setPageIndex(0);
          return;
        }
        const native = await resolveAddress(accountAddress);
        if (!cancelled) {
          setResolved(native);
          setPageIndex(0); // reset on address change
        }
      } catch {
        if (!cancelled) {
          setResolved(null);
          setPageIndex(0);
        }
      }
    }
    run();
    return () => { cancelled = true; };
  }, [accountAddress, resolveAddress]);

  const { data: conn, loading: connLoading, error: connError } = useQuery(
    STAKINGS_CONNECTION_QUERY as unknown as TypedDocumentNode,
    {
      variables: isHasuraExplorerMode
        ? { where: stakingWhere }
        : { accountId: resolved as string },
      skip: !resolved || (isHasuraExplorerMode && !stakingWhere),
    }
  );
  const totalCount: number = (conn?.stakingsConnection?.totalCount ?? conn?.stakingsConnection?.aggregate?.count ?? 0) as number;

  const offset = pageIndex * pageSize;
  const { data, loading, error } = useQuery(
    STAKINGS_LIST_QUERY as unknown as TypedDocumentNode,
    {
      variables: isHasuraExplorerMode
        ? { where: stakingWhere, first: pageSize, after: offset }
        : { accountId: resolved as string, first: pageSize, after: offset },
      skip: !resolved || (isHasuraExplorerMode && !stakingWhere),
    }
  );

  const rewards = useMemo<UiReward[]>(() => {
    const list = (data?.stakings ?? []) as Array<{ id: string; amount: string; timestamp: string; event?: { extrinsic?: { hash?: string } }; signer?: { id?: string } }>;
    return list.map((s) => ({
      id: s.id,
      amount: s.amount,
      timestamp: s.timestamp,
      extrinsicHash: s?.event?.extrinsic?.hash ?? null,
      signer: s?.signer?.id ?? '',
    }));
  }, [data]);

  const pageCount = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

  return {
    rewards,
    loading: loading || connLoading,
    error: (error as Error) ?? (connError as Error) ?? undefined,
    pageIndex,
    pageCount,
    setPageIndex,
    totalCount,
    pageSize,
  };
}
