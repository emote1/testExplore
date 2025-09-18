import { useMemo } from 'react';
import { useQuery } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { VERIFIED_CONTRACTS_BY_IDS_QUERY, buildIconMap, type TokenIconMap } from '@/data/token-icons';

export interface UseTokenIconsResult {
  icons: TokenIconMap;
  loading: boolean;
  error?: Error;
}

export function useTokenIcons(ids: string[] | undefined, limit = 100): UseTokenIconsResult {
  const uniqueIds = useMemo(() => {
    const s = new Set<string>();
    for (const id of ids ?? []) {
      if (typeof id === 'string' && id) s.add(id);
    }
    return Array.from(s);
  }, [ids]);

  const { data, loading, error } = useQuery(
    VERIFIED_CONTRACTS_BY_IDS_QUERY as unknown as TypedDocumentNode<any, any>,
    {
      variables: { ids: uniqueIds, first: Math.min(uniqueIds.length, limit) },
      skip: uniqueIds.length === 0,
      fetchPolicy: 'cache-first',
    }
  );

  const icons = useMemo(() => {
    const rows: Array<{ id?: unknown; contractData?: unknown }> = data?.verifiedContracts ?? [];
    return buildIconMap(rows);
  }, [data]);

  return { icons, loading, error: error as Error | undefined };
}
