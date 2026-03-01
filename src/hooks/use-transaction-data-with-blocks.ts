import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, ApolloError, useApolloClient } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { PAGINATED_TRANSFERS_QUERY, PAGINATED_TRANSFERS_MIN_QUERY, TRANSFERS_POLLING_QUERY } from '../data/transfers';
import { mapTransfersToUiTransfers, type UiTransfer } from '../data/transfer-mapper';
import { useAddressResolver } from './use-address-resolver';
import { buildTransferOrderBy, buildTransferWhereFilter, isHasuraExplorerMode, type TransactionDirection } from '@/utils/transfer-query';
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
  isActive: boolean = true,
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

  const where = useMemo(
    () => buildTransferWhereFilter({ resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw, reefOnly, tokenIds, tokenMinRaw, tokenMaxRaw, erc20Only, excludeSwapLegs: !swapOnly }),
    [resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw, reefOnly, tokenIds, tokenMinRaw, tokenMaxRaw, erc20Only, swapOnly]
  );

  const orderBy = useMemo(() => buildTransferOrderBy(), []);

  const queryVariables = useMemo(() => {
    if (isHasuraExplorerMode) {
      return {
        limit,
        offset: 0,
        where,
        orderBy,
      };
    }
    return {
      first: limit,
      where,
      orderBy,
    };
  }, [limit, where, orderBy]);

  const { data, loading, error, fetchMore: apolloFetchMore } =
    useQuery<Record<string, unknown>, Record<string, unknown>>(
      pagedDoc as unknown as TypedDocumentNode<Record<string, unknown>, Record<string, unknown>>,
      {
        variables: queryVariables,
        skip: !resolvedAddress && !resolvedEvmAddress,
        notifyOnNetworkStatusChange: false,
        fetchPolicy: 'cache-first',
      }
    );

  const prevActiveRef = useRef<boolean>(isActive);
  useEffect(() => {
    prevActiveRef.current = isActive;
  }, [isActive]);

  const normalizedData = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source = (data ?? {}) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transfers = (source?.transfers ?? source?.transfer ?? []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const edges = (source?.transfersConnection?.edges ?? transfers.map((node: any) => ({ node }))) as any[];
    const rawTotal = Number(source?.transfersConnection?.totalCount ?? source?.transfersAggregate?.aggregate?.count);
    const totalCount = Number.isFinite(rawTotal) ? rawTotal : edges.length;
    const hasNextPage = Boolean(source?.transfersConnection?.pageInfo?.hasNextPage) || edges.length < totalCount;
    const endCursor = source?.transfersConnection?.pageInfo?.endCursor ?? null;

    return {
      transfers,
      transfersConnection: {
        edges,
        pageInfo: { hasNextPage, endCursor },
        totalCount,
      },
    };
  }, [data]);

  // Extract partner legs logic
  const { partnersByHash, setPartnersByHash } = useSwapPartnerLegs({ data: normalizedData, swapOnly, enabled: !!(resolvedAddress || resolvedEvmAddress) });
  
  // Extract token metadata resolving logic (called for side effects - cache warming)
  useTokenMetadataResolver({ data: normalizedData });

  // Reset partners when address changes
  useEffect(() => {
    setPartnersByHash({});
  }, [resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw, reefOnly, tokenIds, tokenMinRaw, tokenMaxRaw, setPartnersByHash]);

  const uiTransfers = useMemo(() => {
    const edges = normalizedData.transfersConnection.edges || [];
    if (edges.length === 0) {
      return [];
    }

    // Normalize Hasura response to match Subsquid structure expected by mapper
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalizeHasuraNode = (node: any) => {
      if (!isHasuraExplorerMode) return node;
      
      // Ensure all required fields exist with fallbacks
      const fromId = node.fromId || node.from_id || node.from?.id || '';
      const toId = node.toId || node.to_id || node.to?.id || '';
      const tokenData = node.verified_contract || node.token;
      const token = tokenData || { id: node.token_id || '', name: 'Unknown', contractData: null };
      
      return {
        ...node,
        // Always create from/to objects with resolved IDs (don't trust existing empty objects)
        from: { id: fromId },
        to: { id: toId },
        token,
      };
    };

    // Merge partner legs (if any) before mapping/aggregation in Swap mode only
    const partnerList = Object.values(partnersByHash).flat();
    const combinedEdges = swapOnly && partnerList.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? [...(edges as unknown as Array<{ node: any }>).map((e) => ({ node: normalizeHasuraNode(e.node) })), ...partnerList.map((n) => ({ node: normalizeHasuraNode(n) }))]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (edges as unknown as Array<{ node: any }>).map((e) => ({ node: normalizeHasuraNode(e.node) }));

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
  }, [normalizedData, resolvedAddress, resolvedEvmAddress, minReefRaw, maxReefRaw, partnersByHash, accountAddress, swapOnly]);

  const fetchMore = useCallback(async () => {
    if (!apolloFetchMore) return;

    if (isHasuraExplorerMode) {
      const loaded = normalizedData.transfersConnection.edges.length;
      const total = normalizedData.transfersConnection.totalCount || 0;
      if (loaded >= total) return;

      await apolloFetchMore({
        variables: {
          limit,
          offset: loaded,
          where,
          orderBy,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const prevList = (((prev as any)?.transfers ?? []) as any[]);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nextList = (((fetchMoreResult as any)?.transfers ?? []) as any[]);
          const seen = new Set<string>();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const merged: any[] = [];
          for (const item of [...prevList, ...nextList]) {
            const id = String(item?.id ?? '');
            if (!id || seen.has(id)) continue;
            seen.add(id);
            merged.push(item);
          }
          return {
            ...prev,
            transfers: merged,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            transfersAggregate: (fetchMoreResult as any)?.transfersAggregate ?? (prev as any)?.transfersAggregate,
          };
        },
      });
      return;
    }

    const hasNext = normalizedData.transfersConnection.pageInfo.hasNextPage;
    if (!hasNext) return;
    await apolloFetchMore({
      variables: {
        after: normalizedData.transfersConnection.pageInfo.endCursor,
      },
    });
  }, [apolloFetchMore, normalizedData, limit, where, orderBy]);

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
            where,
            orderBy,
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
            const partnerWhere = isHasuraExplorerMode
              ? { extrinsic_hash: { _in: missing }, reefswap_action: { _is_null: false } }
              : { extrinsicHash_in: missing, reefswapAction_isNull: false };
            const { data: q2 } = await (client as ApolloClient<NormalizedCacheObject>).query(
              {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                query: TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode<any, any>,
                variables: { where: partnerWhere, limit: Math.min(missing.length * 20, 500), orderBy },
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

      // Normalize Hasura response to match Subsquid structure expected by mapper
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalizeNode = (node: any) => {
        if (!isHasuraExplorerMode) return node;
        const fromId = node.fromId || node.from_id || node.from?.id || '';
        const toId = node.toId || node.to_id || node.to?.id || '';
        const tokenData = node.verified_contract || node.token;
        const token = tokenData || { id: node.token_id || '', name: 'Unknown', contractData: null };
        return { ...node, from: { id: fromId }, to: { id: toId }, token };
      };

      // Map to UI model
      const mapped = mapTransfersToUiTransfers(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        list.map((n: any) => ({ node: normalizeNode(n) })),
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
  }, [client, resolvedAddress, resolvedEvmAddress, accountAddress, swapOnly, minReefRaw, maxReefRaw, where, orderBy]);

  const isLoading = loading || (isResolvingAddress && !data);
  const totalError = error; // Do not create a new error for the resolving state

  return {
    transfers: uiTransfers,
    loading: isLoading,
    error: totalError,
    hasMore: normalizedData.transfersConnection.pageInfo.hasNextPage,
    totalCount: normalizedData.transfersConnection.totalCount,
    fetchMore,
    fetchWindow,
  };
}
