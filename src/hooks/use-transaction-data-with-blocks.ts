import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, ApolloError, useApolloClient } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { PAGINATED_TRANSFERS_QUERY, PAGINATED_TRANSFERS_MIN_QUERY, TRANSFERS_POLLING_QUERY } from '../data/transfers';
import type { TransferOrderByInput, TransfersMinQueryQuery as TransfersQuery, TransfersMinQueryQueryVariables as TransfersQueryVariables } from '@/gql/graphql';
import { mapTransfersToUiTransfers, type UiTransfer } from '../data/transfer-mapper';
import { useAddressResolver } from './use-address-resolver';
import { buildTransferWhereFilter, type TransactionDirection } from '@/utils/transfer-query';
import { isValidEvmAddressFormat, isValidSubstrateAddressFormat } from '@/utils/address-helpers';
import {
  ensureUniqueTransfers,
  sortTransfersByAmount,
  sortTransfersByTimestamp,
  aggregateSwaps,
  identifyMissingPartnerHashes
} from '@/utils/transfer-helpers';
import { useSwapPartnerLegs } from './use-swap-partner-legs';
import { useTokenMetadataResolver } from './use-token-metadata-resolver';


export interface UseTransactionDataReturn {
  transfers: UiTransfer[];
  loading: boolean;
  error?: ApolloError | Error;
  hasMore: boolean;
  totalCount?: number;
  fetchMore: () => Promise<void>;
  /** Fetch a specific window using offset/limit with the same filters and ordering */
  fetchWindow: (offset: number, limit: number) => Promise<UiTransfer[]>;
}

export function useTransactionDataWithBlocks(
  accountAddress: string | null | undefined,
  limit: number,
  direction: TransactionDirection = 'any',
  minReefRaw?: string | bigint | null,
  maxReefRaw?: string | bigint | null,
  reefOnly: boolean = false,
  tokenIds: string[] | null = null,
  tokenMinRaw: string | bigint | null = null,
  tokenMaxRaw: string | bigint | null = null,
  erc20Only: boolean = false,
  swapOnly: boolean = false,
): UseTransactionDataReturn {

  const { resolveBoth } = useAddressResolver();
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedEvmAddress, setResolvedEvmAddress] = useState<string | null>(null);

  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const client = useApolloClient();

  useEffect(() => {
    if (!accountAddress) {
      setResolvedAddress(null);
      setResolvedEvmAddress(null);
      return;
    }

    const input = accountAddress.trim();
    if (!input) {
      setResolvedAddress(null);
      setResolvedEvmAddress(null);
      return;
    }

    // Optimistic: start querying immediately using the provided address format
    // (0x uses *_EvmAddress fields; SS58 uses from/to.id)
    if (isValidEvmAddressFormat(input)) {
      setResolvedAddress(null);
      setResolvedEvmAddress(input);
    } else if (isValidSubstrateAddressFormat(input)) {
      setResolvedAddress(input);
      setResolvedEvmAddress(null);
    }

    const resolveAndSet = async () => {
      setIsResolvingAddress(true);
      try {
        // Optimized: single query returns both nativeId and evmAddress
        const { nativeId, evmAddress } = await resolveBoth(input);
        setResolvedAddress(nativeId);
        setResolvedEvmAddress(evmAddress);
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
  }, [accountAddress, resolveBoth]);

  const pagedDoc = ((tokenIds && tokenIds.length > 0) || reefOnly || swapOnly)
    ? PAGINATED_TRANSFERS_MIN_QUERY
    : PAGINATED_TRANSFERS_QUERY;

  const { data, loading, error, fetchMore: apolloFetchMore } = 
    useQuery<TransfersQuery, TransfersQueryVariables>(
      pagedDoc as unknown as TypedDocumentNode<TransfersQuery, TransfersQueryVariables>,
      {
        variables: {
          first: limit,
          where: buildTransferWhereFilter({ resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw, reefOnly, tokenIds, tokenMinRaw, tokenMaxRaw, erc20Only, excludeSwapLegs: !swapOnly }),
          orderBy: ((minReefRaw || maxReefRaw || tokenMinRaw || tokenMaxRaw) ? ['amount_ASC', 'id_ASC'] : ['timestamp_DESC', 'id_DESC']) as TransferOrderByInput[],
        },
        skip: !resolvedAddress && !resolvedEvmAddress,
        notifyOnNetworkStatusChange: false,
        fetchPolicy: 'cache-and-network',
      }
    );

  // Extract partner legs logic
  const { partnersByHash, setPartnersByHash } = useSwapPartnerLegs({ data, swapOnly, enabled: !!(resolvedAddress || resolvedEvmAddress) });
  
  // Extract token metadata resolving logic
  const { metaVersion } = useTokenMetadataResolver({ data });

  // Reset partners when address changes
  useEffect(() => {
    setPartnersByHash({});
  }, [resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw, reefOnly, tokenIds, tokenMinRaw, tokenMaxRaw, setPartnersByHash]);

  const uiTransfers = useMemo(() => {
    const edges = data?.transfersConnection.edges || [];
    if (edges.length === 0) {
      return [];
    }

    // Merge partner legs (if any) before mapping/aggregation in Swap mode only
    const partnerList = Object.values(partnersByHash).flat();
    const combinedEdges = swapOnly && partnerList.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? [...(edges as unknown as Array<{ node: any }>), ...partnerList.map((n) => ({ node: n }))]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (edges as unknown as Array<{ node: any }>);

    const mapped = mapTransfersToUiTransfers(
      combinedEdges,
      accountAddress ?? resolvedAddress ?? resolvedEvmAddress ?? undefined
    );

    // Enforce global stable order matching server order
    const enriched = (minReefRaw || maxReefRaw)
      ? sortTransfersByAmount(mapped)
      : sortTransfersByTimestamp(mapped);

    // Belt-and-suspenders: ensure unique transfers by id
    const unique = ensureUniqueTransfers(enriched);

    if (!swapOnly) {
      // All/Incoming/Outgoing: return plain transfers without building SWAP rows
      return unique;
    }

    return aggregateSwaps(unique);
  }, [data, resolvedAddress, resolvedEvmAddress, minReefRaw, maxReefRaw, partnersByHash, metaVersion, accountAddress, swapOnly]);

  const fetchMore = useCallback(async () => {
    if (!apolloFetchMore || !data?.transfersConnection.pageInfo.hasNextPage) return;
    await apolloFetchMore({
      variables: {
        after: data.transfersConnection.pageInfo.endCursor,
      },
    });
  }, [apolloFetchMore, data]);

  // Fast windowed fetch by offset/limit with same where/orderBy
  const fetchWindow = useCallback(async (offset: number, limit: number): Promise<UiTransfer[]> => {
    if (!resolvedAddress && !resolvedEvmAddress) return [];
    try {
      const { data: q } = await (client as ApolloClient<NormalizedCacheObject>).query(
        {
          // Use polling query since it exposes offset/limit on plain list
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          query: TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode<any, any>,
          variables: {
            where: buildTransferWhereFilter({ resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw, reefOnly, tokenIds, tokenMinRaw, tokenMaxRaw, erc20Only, excludeSwapLegs: !swapOnly }),
            orderBy: ((minReefRaw || maxReefRaw || tokenMinRaw || tokenMaxRaw) ? ['amount_ASC', 'id_ASC'] : ['timestamp_DESC', 'id_DESC']) as TransferOrderByInput[],
            offset: Math.max(0, Math.floor(offset) || 0),
            limit: Math.max(1, Math.floor(limit) || 1),
          },
          fetchPolicy: 'network-only',
        }
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = (q?.transfers || []) as Array<any>;
      // Light mode: skip partner fetch in window path to avoid extra queries
      if (!swapOnly) {
        try {
          const missing = identifyMissingPartnerHashes(list, new Set(), { strict: true });
          if (missing.length > 0) {
            // Important: do NOT restrict by address here; partner legs may not involve the user
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const where: any = { extrinsicHash_in: missing, reefswapAction_isNull: false };
            const { data: q2 } = await (client as ApolloClient<NormalizedCacheObject>).query(
              {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                query: TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode<any, any>,
                variables: { where, limit: Math.min(missing.length * 20, 500) },
                fetchPolicy: 'network-only',
              }
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const partners = (q2?.transfers || []) as Array<any>;
            if (partners.length > 0) {
              const seen = new Set(list.map((n) => n?.id));
              for (const p of partners) {
                if (!p?.id || seen.has(p.id)) continue;
                list.push(p);
                seen.add(p.id);
              }
            }
          }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_e) {
          // best-effort; ignore partner errors in window mode
        }
      }
      if (!list.length) return [];

      // Map to UI model
      const mapped = mapTransfersToUiTransfers(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        list.map((n: any) => ({ node: n })),
        accountAddress ?? resolvedAddress ?? resolvedEvmAddress ?? undefined
      );
      
      // Enforce global order consistent with server
      const enriched = (minReefRaw || maxReefRaw)
        ? sortTransfersByAmount(mapped)
        : sortTransfersByTimestamp(mapped);

      // Unique by id
      const unique = ensureUniqueTransfers(enriched);

      if (!swapOnly) return unique;
      return aggregateSwaps(unique);
    } catch (e) {
      console.warn('[tx][fetchWindow] failed', e);
      return [];
    }
  }, [client, resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw, reefOnly, tokenIds, tokenMinRaw, tokenMaxRaw, accountAddress, swapOnly]);

  const isLoading = loading || (isResolvingAddress && !data);
  const totalError = error; // Do not create a new error for the resolving state

  return {
    transfers: uiTransfers,
    loading: isLoading,
    error: totalError,
    hasMore: data?.transfersConnection.pageInfo.hasNextPage || false,
    totalCount: data?.transfersConnection.totalCount,
    fetchMore,
    fetchWindow,
  };
}
