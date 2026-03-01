import { useQuery } from '@apollo/client';
import { parse } from 'graphql';
import React from 'react';
import { reefExplorerClient } from '../reef-explorer-client';

const STAKING_COUNT_QUERY = parse(`
  query StakingCountPrefetch($where: staking_activity_bool_exp!) {
    staking_activity_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`);

interface UseStakingCountPrefetchParams {
  address: string | null;
  evmAddress: string | null;
  enabled?: boolean;
}

export function useStakingCountPrefetch({
  address,
  evmAddress,
  enabled = true,
}: UseStakingCountPrefetchParams): number | null {
  const where = React.useMemo(() => {
    if (!address && !evmAddress) return null;
    const conditions: Record<string, unknown>[] = [];
    if (address) conditions.push({ signer_id: { _eq: address } });
    if (evmAddress) conditions.push({ signer_evm_address: { _ilike: evmAddress.toLowerCase() } });
    return conditions.length === 1 ? conditions[0] : { _or: conditions };
  }, [address, evmAddress]);

  const { data } = useQuery(STAKING_COUNT_QUERY, {
    client: reefExplorerClient,
    variables: { where: where ?? {} },
    skip: !enabled || !where,
    fetchPolicy: 'cache-first',
  });

  return React.useMemo(() => {
    const count = data?.staking_activity_aggregate?.aggregate?.count;
    return typeof count === 'number' ? count : null;
  }, [data]);
}
