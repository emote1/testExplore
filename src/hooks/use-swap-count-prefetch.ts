import { useEffect, useState, useRef } from 'react';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useApolloClient, type ApolloClient, type NormalizedCacheObject } from '@apollo/client';
import { parse } from 'graphql';
import { useAddressResolver } from './use-address-resolver';

const swapCountCache = new Map<string, number>();

interface SwapCountResp {
  count: { aggregate: { count: number } };
}

const SWAP_COUNT_QUERY = parse(`
  query SwapCountForAddress($evm: String!) {
    count: transfer_aggregate(
      where: {
        reefswap_action: { _eq: "Swap" }
        type: { _eq: "ERC20" }
        _or: [
          { from_evm_address: { _eq: $evm } }
          { to_evm_address: { _eq: $evm } }
        ]
      }
      distinct_on: extrinsic_id
    ) {
      aggregate { count }
    }
  }
`);

export function useSwapCountPrefetch(address: string | null, enabled: boolean = true): number | null {
  const apollo = useApolloClient() as ApolloClient<NormalizedCacheObject>;
  const { resolveEvmAddress } = useAddressResolver();
  const [count, setCount] = useState<number | null>(null);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !address) {
      setCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const evmAddress = await resolveEvmAddress(address);
        if (!evmAddress || cancelled) return;
        const key = evmAddress.toLowerCase();

        const cached = swapCountCache.get(key);
        if (typeof cached === 'number') {
          if (!cancelled) setCount(cached);
          return;
        }

        if (fetchedRef.current === key) return;
        fetchedRef.current = key;

        const { data } = await apollo.query<SwapCountResp>({
          query: SWAP_COUNT_QUERY as TypedDocumentNode<SwapCountResp, { evm: string }>,
          variables: { evm: key },
          fetchPolicy: 'cache-first',
        });
        const total = data?.count?.aggregate?.count ?? 0;
        swapCountCache.set(key, total);
        if (!cancelled) setCount(total);
      } catch (e) {
        console.debug('[swap-prefetch] failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [address, enabled, apollo, resolveEvmAddress]);

  return count;
}

export function clearSwapCountCache(): void {
  swapCountCache.clear();
}
