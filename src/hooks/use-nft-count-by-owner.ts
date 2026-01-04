import { useEffect, useMemo, useState } from 'react';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useQuery } from '@apollo/client';
import { NFTS_BY_OWNER_COUNT_QUERY } from '../data/nfts';
import { useAddressResolver } from './use-address-resolver';

export interface UseNftCountByOwnerReturn {
  totalCount?: number;
  isLoading: boolean;
  error?: Error;
}

export function useNftCountByOwner(owner: string | null | undefined): UseNftCountByOwnerReturn {
  const { resolveEvmAddress } = useAddressResolver();
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!owner) {
        setEvmAddress(null);
        return;
      }
      setIsResolving(true);
      try {
        const resolved = await resolveEvmAddress(owner);
        if (!active) return;
        setEvmAddress(resolved);
      } catch {
        if (!active) return;
        setEvmAddress(null);
      } finally {
        if (active) setIsResolving(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [owner, resolveEvmAddress]);

  const { data, loading, error } = useQuery(
    NFTS_BY_OWNER_COUNT_QUERY as unknown as TypedDocumentNode,
    {
      variables: { owner: evmAddress },
      skip: !evmAddress || isResolving,
      fetchPolicy: 'cache-first',
    }
  );

  const totalCount = useMemo(() => {
    const v = data?.tokenHolders?.totalCount;
    return typeof v === 'number' ? v : undefined;
  }, [data]);

  return {
    totalCount,
    isLoading: loading || isResolving,
    error: error as Error | undefined,
  };
}
