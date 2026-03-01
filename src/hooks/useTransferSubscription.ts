import { sortTransfersByTimestamp, ensureUniqueTransfers } from '@/utils/transfer-helpers';
import { useRef, useEffect, useMemo, useState } from 'react';
import { useQuery, useApolloClient } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
// removed unused ApolloClient types
import { mapTransfersToUiTransfers, type UiTransfer } from '../data/transfer-mapper';
import {
  TransfersMinQueryQuery,
  TransfersMinQueryQueryVariables,
} from '@/gql/graphql';
import { TRANSFERS_POLLING_QUERY, PAGINATED_TRANSFERS_QUERY } from '../data/transfers';
import { PAGINATION_CONFIG } from '../constants/pagination';
import { useAddressResolver } from './use-address-resolver';
import { buildTransferOrderBy, buildTransferWhereFilter, isHasuraExplorerMode, type TransactionDirection } from '@/utils/transfer-query';
import { createNewItemDetector } from '@/utils/transfer-new-items';

const MAX_SEEN_IDS = 200;

interface UseTransferSubscriptionProps {
  address: string | null;
  onNewTransfer: (transfer: UiTransfer) => void;
  isEnabled: boolean;
  direction?: TransactionDirection;
  minReefRaw?: string | bigint | null;
  maxReefRaw?: string | bigint | null;
}

export function useTransferSubscription({
  address,
  onNewTransfer,
  isEnabled,
  direction = 'any',
  minReefRaw = null,
  maxReefRaw = null,
}: UseTransferSubscriptionProps) {
  const detectorRef = useRef(createNewItemDetector<UiTransfer>({ key: (t) => t.id, max: MAX_SEEN_IDS }));
  const client = useApolloClient();
  const { resolveBoth } = useAddressResolver();
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedEvmAddress, setResolvedEvmAddress] = useState<string | null>(null);

  // Resolve input address (EVM or Substrate) to:
  // - canonical native ID used in transfers.from/to.id
  // - evmAddress (0x...) to leverage fromEvmAddress_eq/toEvmAddress_eq filters
  useEffect(() => {
    if (!address) {
      setResolvedAddress(null);
      setResolvedEvmAddress(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        // Optimized: single query returns both nativeId and evmAddress
        const { nativeId, evmAddress } = await resolveBoth(address);
        if (!cancelled) {
          setResolvedAddress(nativeId);
          setResolvedEvmAddress(evmAddress);
        }
      } catch (error) {
        console.error('Failed to resolve address:', error);
        if (!cancelled) {
          setResolvedAddress(null);
          setResolvedEvmAddress(null);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [address, resolveBoth]);

  const queryVariables = useMemo(() => {
    const where = buildTransferWhereFilter({ resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw });
    if (!where) return null;

    return {
      where,
      orderBy: buildTransferOrderBy(),
      offset: 0,
      limit: PAGINATION_CONFIG.SUBSCRIPTION_FETCH_SIZE,
    };
  }, [resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw]);

  // Allow E2E to override polling interval via URL param ?pollMs=1000
  const pollIntervalMs = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('pollMs') ?? params.get('poll') ?? params.get('pollingMs');
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : PAGINATION_CONFIG.POLLING_INTERVAL_MS;
    } catch {
      return PAGINATION_CONFIG.POLLING_INTERVAL_MS;
    }
  }, []);

  // Clear tracking when address (input) or resolved values change
  useEffect(() => {
    detectorRef.current.reset();
  }, [address, resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw]);


  const { data, error, startPolling, stopPolling } = useQuery<Record<string, unknown>, Record<string, unknown>>(
    TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode<Record<string, unknown>, Record<string, unknown>>,
    {
      variables: queryVariables as Record<string, unknown>,
      skip: !isEnabled || (!resolvedAddress && !resolvedEvmAddress) || !queryVariables,
      pollInterval: isEnabled ? pollIntervalMs : 0,
      notifyOnNetworkStatusChange: false,
      fetchPolicy: 'network-only',
    }
  );

  // Pause/resume polling when tab visibility changes
  useEffect(() => {
    const canPoll = isEnabled && (!!resolvedAddress || !!resolvedEvmAddress) && !!queryVariables;
    if (!canPoll) return;

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling?.();
      } else {
        startPolling?.(pollIntervalMs);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    handleVisibility();
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopPolling?.();
    };
  }, [isEnabled, resolvedAddress, resolvedEvmAddress, queryVariables, startPolling, stopPolling, pollIntervalMs]);

  useEffect(() => {
    if (error) {
      console.error('Subscription error:', error);
      return;
    }

    // Debug tick log removed

    if (!data?.transfers || (!resolvedAddress && !resolvedEvmAddress)) return;

    // Map transfers to UI format - wrap in edge structure for mapper compatibility
    // Use a minimal runtime shape to avoid fragment masking type friction
    const rawTransfers = (data.transfers ?? []) as Array<{
      id: string;
      amount: string;
      timestamp: string;
      success: boolean;
      type: string;
      signedData?: unknown;
      extrinsicHash?: string | null;
      from: { id: string };
      to: { id: string };
      token: { id: string; name: string };
    }>;
    const transferEdges = rawTransfers.map((transfer) => ({ node: transfer }));
    const uiTransfers = ensureUniqueTransfers(
      sortTransfersByTimestamp(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mapTransfersToUiTransfers(transferEdges as any, resolvedAddress ?? resolvedEvmAddress ?? undefined)
      )
    );

    if (uiTransfers.length === 0) return;

    // Detect and notify only truly new transfers (first call primes and returns [])
    const newTransfers = detectorRef.current.detectNew(uiTransfers);
    const readyNewTransfers = newTransfers;

    // Always reconcile the cache with the latest polled top list to ensure
    // newest transfers appear even on the first tick (when detector primes)
    if (PAGINATION_CONFIG.SUB_PREPEND_WITHOUT_REFETCH && !isHasuraExplorerMode) {
      const baseWhere = buildTransferWhereFilter({ resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw });
      const orderBy = buildTransferOrderBy() as unknown as TransfersMinQueryQueryVariables['orderBy'];

      // Use the raw polled list as prepend candidates (already newest-first)
      const candidates = rawTransfers;
      // Cover timing races between address resolution variants by updating multiple where shapes.
      // When both addresses are resolved, baseWhere already covers both — skip redundant variants.
      const whereVariantsRaw: Array<Record<string, unknown>> = baseWhere ? [baseWhere] : [];
      if (!(resolvedAddress && resolvedEvmAddress)) {
        const w1 = buildTransferWhereFilter({ resolvedAddress, resolvedEvmAddress: null, direction, minReefRaw, maxReefRaw });
        const w2 = buildTransferWhereFilter({ resolvedAddress: null, resolvedEvmAddress, direction, minReefRaw, maxReefRaw });
        if (w1) whereVariantsRaw.push(w1);
        if (w2) whereVariantsRaw.push(w2);
      }
      const seenWhere = new Set<string>();
      const whereVariants = whereVariantsRaw.filter((w) => {
        const key = JSON.stringify(w);
        if (seenWhere.has(key)) return false;
        seenWhere.add(key);
        return true;
      });

      for (const where of whereVariants) {
        // Debug cache.reconcile prepend log removed
        try {
          client.cache.updateQuery<TransfersMinQueryQuery, TransfersMinQueryQueryVariables>(
            {
              query: PAGINATED_TRANSFERS_QUERY as unknown as TypedDocumentNode<TransfersMinQueryQuery, TransfersMinQueryQueryVariables>,
              variables: {
                first: PAGINATION_CONFIG.API_FETCH_PAGE_SIZE,
                where,
                orderBy,
              },
            },
            (prev) => {
              if (!prev?.transfersConnection) return prev;
              const existingEdges = prev.transfersConnection.edges ?? [];
              const existingIds = new Set<string>();
              for (const e of existingEdges) {
                const id = (e as { node?: { id?: string } })?.node?.id;
                if (id) existingIds.add(id);
              }
              // Build edges to prepend for candidates not yet present
              const prependEdges = candidates
                .filter((node) => !existingIds.has(node.id))
                .map((node) => ({
                  __typename: 'TransferEdge' as const,
                  node: {
                    __typename: 'Transfer' as const,
                    ...(node as Record<string, unknown>),
                    token: {
                      __typename: 'VerifiedContract' as const,
                      id: (node as { token?: { id?: string } })?.token?.id,
                      name: (node as { token?: { name?: string } })?.token?.name,
                      contractData: null, // satisfy selection set
                    },
                  },
                }));

              if (prependEdges.length === 0) return prev; // no changes

              const seen = new Set<string>();
              const resultEdges: typeof existingEdges = [];
              // Prepend new edges first
              for (const e of prependEdges) {
                const id = (e as { node?: { id?: string } })?.node?.id;
                if (!id) continue;
                if (!seen.has(id)) {
                  seen.add(id);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  resultEdges.push(e as any);
                }
              }
              // Then keep existing edges in order, skipping duplicates
              for (const e of existingEdges) {
                const id = (e as { node?: { id?: string } })?.node?.id;
                if (!id) {
                  resultEdges.push(e);
                  continue;
                }
                if (!seen.has(id)) {
                  seen.add(id);
                  resultEdges.push(e);
                }
              }
              // Preserve already loaded pages: keep at least existing length, with a floor at API page size.
              const max = Math.max(existingEdges.length, PAGINATION_CONFIG.API_FETCH_PAGE_SIZE);
              const cappedEdges = resultEdges.slice(0, max);
              return {
                ...prev,
                transfersConnection: {
                  ...prev.transfersConnection,
                  edges: cappedEdges,
                },
              };
            }
          );
        } catch (e) {
          console.error('[sub] updateQuery failed', e);
        }
      }

      // Fire notifications after cache is consistent so UI can anchor to the new id immediately
      for (const t of readyNewTransfers) {
        onNewTransfer(t);
      }
    } else {
      if (readyNewTransfers.length === 0) return;
      // Fallback: refetch the first page to let merge policy replace edges
      // Debug refetch log removed
      void client
        .refetchQueries({
          include: [
            PAGINATED_TRANSFERS_QUERY as unknown as TypedDocumentNode<TransfersMinQueryQuery, TransfersMinQueryQueryVariables>,
          ],
        })
        .then(() => {
          for (const t of readyNewTransfers) {
            onNewTransfer(t);
          }
        })
        .catch(() => {
          // Even if refetch fails, still surface the notification so user sees activity
          for (const t of readyNewTransfers) {
            onNewTransfer(t);
          }
        });
    }
    return undefined;
  }, [data, error, onNewTransfer, resolvedAddress, resolvedEvmAddress, client, direction, minReefRaw, maxReefRaw]);
}
