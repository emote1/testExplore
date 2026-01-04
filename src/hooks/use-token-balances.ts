import { useEffect, useMemo, useState } from 'react';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useQuery } from '@apollo/client';
import { TOKEN_HOLDERS_PAGED_QUERY, mapTokenHoldersToUiBalances, type UiTokenBalance } from '@/data/balances';
import { useAddressResolver } from './use-address-resolver';

export interface UseTokenBalancesReturn {
  balances: UiTokenBalance[];
  loading: boolean;
  error?: Error;
  totalCount?: number;
}

export function useTokenBalances(address: string | null | undefined, first = 50): UseTokenBalancesReturn {
  const { resolveAddress } = useAddressResolver();
  const [resolved, setResolved] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!address) { setResolved(null); return; }
      setIsResolving(true);
      try {
        const native = await resolveAddress(address);
        if (!active) return;
        setResolved(native);
      } catch {
        if (!active) return;
        setResolved(null);
      } finally {
        if (active) setIsResolving(false);
      }
    })();
    return () => { active = false; };
  }, [address, resolveAddress]);

  const { data, loading, error } = useQuery(
    TOKEN_HOLDERS_PAGED_QUERY as unknown as TypedDocumentNode,
    {
      variables: { accountId: resolved, first },
      skip: !resolved || isResolving,
      fetchPolicy: 'cache-first',
    }
  );

  const balances = useMemo(() => {
    const edges = data?.tokenHolders?.edges ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return mapTokenHoldersToUiBalances(edges as Array<{ node?: any } | null>);
  }, [data]);

  return { balances, loading, error: error as Error | undefined, totalCount: data?.tokenHolders?.totalCount };
}
