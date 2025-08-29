import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, ApolloError, useApolloClient } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { PAGINATED_TRANSFERS_QUERY } from '../data/transfers';
import type { TransferOrderByInput, TransfersFeeQueryQuery as TransfersFeeQuery, TransfersFeeQueryQueryVariables as TransfersFeeQueryVariables } from '@/gql/graphql';
import { mapTransfersToUiTransfers, type UiTransfer } from '../data/transfer-mapper';
import { useAddressResolver } from './use-address-resolver';
import { fetchFeesByExtrinsicHashes, getCachedFee } from '../data/transfers';


export interface UseTransactionDataReturn {
  transfers: UiTransfer[];
  loading: boolean;
  error?: ApolloError | Error;
  hasMore: boolean;
  fetchMore: () => void;
}

export function useTransactionDataWithBlocks(
  accountAddress: string | null | undefined,
  limit: number
): UseTransactionDataReturn {

  const { resolveAddress, resolveEvmAddress } = useAddressResolver();
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedEvmAddress, setResolvedEvmAddress] = useState<string | null>(null);

  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const client = useApolloClient();
  const [feesByHash, setFeesByHash] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!accountAddress) {
      setResolvedAddress(null);
      setResolvedEvmAddress(null);
      return;
    }

    const resolveAndSet = async () => {
      setIsResolvingAddress(true);
      try {
        const [nativeId, evm] = await Promise.all([
          resolveAddress(accountAddress),
          resolveEvmAddress(accountAddress),
        ]);
        setResolvedAddress(nativeId);
        setResolvedEvmAddress(evm);
      } catch (error) {
        console.error('Failed to resolve address:', error);
        setResolvedAddress(null); // Set to null on error to prevent invalid queries
        setResolvedEvmAddress(null);
      }
      finally {
        setIsResolvingAddress(false);
      }
    };

    resolveAndSet();
  }, [accountAddress, resolveAddress, resolveEvmAddress]);

  const { data, loading, error, fetchMore: apolloFetchMore } = 
    useQuery<TransfersFeeQuery, TransfersFeeQueryVariables>(
      PAGINATED_TRANSFERS_QUERY as unknown as TypedDocumentNode<TransfersFeeQuery, TransfersFeeQueryVariables>,
      {
        variables: {
          first: limit,
          where: {
            OR: [
              ...(resolvedAddress ? [
                { from: { id_eq: resolvedAddress } },
                { to: { id_eq: resolvedAddress } },
              ] : []),
              ...(resolvedEvmAddress ? [
                { fromEvmAddress_eq: resolvedEvmAddress },
                { toEvmAddress_eq: resolvedEvmAddress },
              ] : []),
            ],
          },
          orderBy: ['timestamp_DESC'] as TransferOrderByInput[],
        },
        skip: !resolvedAddress && !resolvedEvmAddress,
        notifyOnNetworkStatusChange: false,
      }
    );

  // Reset fees when address changes
  useEffect(() => {
    setFeesByHash({});
  }, [resolvedAddress, resolvedEvmAddress]);

  // Fetch fees for extrinsics present in current edges,
  // but skip ones that already contain inline signedData.fee.partialFee
  useEffect(() => {
    const edges = data?.transfersConnection.edges || [];
    const nodes = edges.map((e) => e?.node).filter(Boolean) as Array<NonNullable<typeof edges[number]>['node']>;
    if (nodes.length === 0) return;

    // Prime state cache with inline fees from signedData
    const inlineMap: Record<string, string> = {};
    for (const n of nodes) {
      const h = n?.extrinsicHash;
      const inlineFee = (n as unknown as { signedData?: any })?.signedData?.fee?.partialFee as string | undefined;
      if (h && inlineFee && feesByHash[h] === undefined) {
        inlineMap[h] = inlineFee;
      }
    }
    if (Object.keys(inlineMap).length > 0) {
      setFeesByHash((prev) => ({ ...prev, ...inlineMap }));
    }

    // Build fetch list only for those without inline fee and not cached
    const missing = nodes
      .filter((n) => {
        const h = n?.extrinsicHash;
        if (!h) return false;
        const hasInline = (n as unknown as { signedData?: any })?.signedData?.fee?.partialFee;
        if (hasInline) return false;
        return feesByHash[h] === undefined && getCachedFee(h) === undefined;
      })
      .map((n) => n.extrinsicHash!) as string[];
    if (missing.length === 0) return;

    let cancelled = false;
    fetchFeesByExtrinsicHashes(client as ApolloClient<NormalizedCacheObject>, missing)
      .then((map) => {
        if (cancelled) return;
        setFeesByHash((prev) => ({ ...prev, ...map }));
      })
      .catch((e) => {
        console.warn('[fees] batch fetch failed', e);
      });

    return () => { cancelled = true; };
  }, [client, data, feesByHash]);

  const uiTransfers = useMemo(() => {
    const edges = data?.transfersConnection.edges || [];
    if (edges.length === 0) {
      return [];
    }

    const mapped = mapTransfersToUiTransfers(edges, resolvedAddress ?? resolvedEvmAddress ?? undefined);
    // inject fees
    return mapped.map((t) => ({
      ...t,
      feeAmount: t.extrinsicHash ? (feesByHash[t.extrinsicHash] ?? getCachedFee(t.extrinsicHash) ?? t.feeAmount) : t.feeAmount,
    }));
  }, [data, resolvedAddress, resolvedEvmAddress, feesByHash]);

  const fetchMore = useCallback(() => {
    if (apolloFetchMore && data?.transfersConnection.pageInfo.hasNextPage) {
      apolloFetchMore({
        variables: {
          after: data.transfersConnection.pageInfo.endCursor,
        },
      });
    }
  }, [apolloFetchMore, data]);

  const isLoading = loading || isResolvingAddress;
  const totalError = error; // Do not create a new error for the resolving state

  return {
    transfers: uiTransfers,
    loading: isLoading,
    error: totalError,
    hasMore: data?.transfersConnection.pageInfo.hasNextPage || false,
    fetchMore,
  };
}
