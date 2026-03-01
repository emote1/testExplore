import { useQuery } from '@apollo/client';
import { parse } from 'graphql';
import React from 'react';
import { reefExplorerClient } from '../reef-explorer-client';

const STAKING_ACTIVITY_QUERY = parse(`
  query StakingActivity($where: staking_activity_bool_exp!, $limit: Int!, $offset: Int!) {
    staking_activity(
      where: $where
      order_by: [{ timestamp: desc }]
      limit: $limit
      offset: $offset
    ) {
      id
      signer_id
      signer_evm_address
      staking_type
      amount
      era
      validator_id
      timestamp
    }
    staking_activity_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`);

export interface StakingActivityRow {
  id: string;
  signer_id: string;
  signer_evm_address: string | null;
  staking_type: string;
  amount: string;
  era: number | null;
  validator_id: string | null;
  timestamp: string;
}

interface UseStakingActivityParams {
  address: string | null;
  evmAddress: string | null;
  enabled?: boolean;
  pageSize?: number;
}

export function useStakingActivity({
  address,
  evmAddress,
  enabled = true,
  pageSize = 20,
}: UseStakingActivityParams) {
  const [page, setPage] = React.useState(0);

  const where = React.useMemo(() => {
    if (!address && !evmAddress) return null;
    const conditions: Record<string, unknown>[] = [];
    if (address) conditions.push({ signer_id: { _eq: address } });
    if (evmAddress) conditions.push({ signer_evm_address: { _ilike: evmAddress.toLowerCase() } });
    return conditions.length === 1 ? conditions[0] : { _or: conditions };
  }, [address, evmAddress]);

  const { data, loading, error, refetch } = useQuery(STAKING_ACTIVITY_QUERY, {
    client: reefExplorerClient,
    variables: {
      where: where ?? {},
      limit: pageSize,
      offset: page * pageSize,
    },
    skip: !enabled || !where,
    fetchPolicy: 'cache-first',
  });

  const rows: StakingActivityRow[] = React.useMemo(() => {
    return (data?.staking_activity ?? []) as StakingActivityRow[];
  }, [data]);

  const totalCount = React.useMemo(() => {
    return data?.staking_activity_aggregate?.aggregate?.count ?? 0;
  }, [data]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    rows,
    totalCount,
    page,
    setPage,
    totalPages,
    pageSize,
    isLoading: loading,
    error: error?.message ?? null,
    refetch,
  };
}
