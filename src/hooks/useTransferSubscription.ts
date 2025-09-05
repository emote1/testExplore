import { useRef, useEffect, useMemo, useState } from 'react';
import { useQuery, useApolloClient } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { mapTransfersToUiTransfers, type UiTransfer } from '../data/transfer-mapper';
import type {
  TransferOrderByInput,
  TransfersPollingQueryQuery,
  TransfersPollingQueryQueryVariables,
  TransfersFeeQueryQuery,
  TransfersFeeQueryQueryVariables,
} from '@/gql/graphql';
import { TRANSFERS_POLLING_QUERY, PAGINATED_TRANSFERS_QUERY } from '../data/transfers';
import { fetchFeesByExtrinsicHashes, getCachedFee } from '../data/transfers';
import { PAGINATION_CONFIG } from '../constants/pagination';
import { useAddressResolver } from './use-address-resolver';
import { buildTransferWhereFilter } from '@/utils/transfer-query';
import { createNewItemDetector } from '@/utils/transfer-new-items';

const MAX_SEEN_IDS = 200;

interface UseTransferSubscriptionProps {
  address: string | null;
  onNewTransfer: (transfer: UiTransfer) => void;
  isEnabled: boolean;
}

export function useTransferSubscription({
  address,
  onNewTransfer,
  isEnabled,
}: UseTransferSubscriptionProps) {
  const detectorRef = useRef(createNewItemDetector<UiTransfer>({ key: (t) => t.id, max: MAX_SEEN_IDS }));
  const [feesByHash, setFeesByHash] = useState<Record<string, string>>({});
  const client = useApolloClient();
  const { resolveAddress, resolveEvmAddress } = useAddressResolver();
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
        const [nativeId, evm] = await Promise.all([
          resolveAddress(address),
          resolveEvmAddress(address),
        ]);
        if (!cancelled) {
          setResolvedAddress(nativeId);
          setResolvedEvmAddress(evm);
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
  }, [address, resolveAddress, resolveEvmAddress]);

  const queryVariables = useMemo(() => {
    const where = buildTransferWhereFilter({ resolvedAddress, resolvedEvmAddress });
    if (!where) return null;

    return {
      where,
      orderBy: ['timestamp_DESC', 'id_DESC'] as TransferOrderByInput[],
      offset: 0,
      limit: PAGINATION_CONFIG.SUBSCRIPTION_FETCH_SIZE,
    };
  }, [resolvedAddress, resolvedEvmAddress]);

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
    setFeesByHash({});
  }, [address, resolvedAddress, resolvedEvmAddress]);


  const { data, error, startPolling, stopPolling } = useQuery<TransfersPollingQueryQuery, TransfersPollingQueryQueryVariables>(
    TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode<TransfersPollingQueryQuery, TransfersPollingQueryQueryVariables>,
    {
      variables: queryVariables as TransfersPollingQueryQueryVariables,
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

    // Lightweight debug: observe polling ticks and resolution state
    try {
      const transfersCount = (data as any)?.transfers?.length ?? 0;
      console.info('[sub] tick', { count: transfersCount, hasResolved: !!resolvedAddress || !!resolvedEvmAddress });
    } catch {}

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
    const uiTransfers = mapTransfersToUiTransfers(transferEdges as unknown as (any | null)[], resolvedAddress ?? resolvedEvmAddress ?? undefined);

    try {
      console.info('[sub] ui mapped', { uiCount: uiTransfers.length });
    } catch {}

    // Pre-fetch fees only for those without inline fee from signedData
    const missing = uiTransfers
      .filter(t => t.extrinsicHash && (!t.feeAmount || t.feeAmount === '0'))
      .map(t => t.extrinsicHash!)
      .filter(h => feesByHash[h] === undefined && getCachedFee(h) === undefined);
    let cancelled = false;
    if (missing.length > 0) {
      fetchFeesByExtrinsicHashes(client as ApolloClient<NormalizedCacheObject>, missing)
        .then(map => { if (!cancelled) setFeesByHash(prev => ({ ...prev, ...map })); })
        .catch(e => console.warn('[fees][sub] batch fetch failed', e));
      // no need to block notifications
    }

    if (uiTransfers.length === 0) return;

    // Detect and notify only truly new transfers (first call primes and returns [])
    const newTransfers = detectorRef.current.detectNew(uiTransfers);
    try {
      console.info('[sub] detectNew', { newCount: newTransfers.length, ids: newTransfers.map(t => t.id) });
    } catch {}
    const readyNewTransfers = newTransfers.map((transfer) => {
      const fee = transfer.extrinsicHash ? (feesByHash[transfer.extrinsicHash] ?? getCachedFee(transfer.extrinsicHash)) : undefined;
      return { ...transfer, feeAmount: fee ?? transfer.feeAmount };
    });

    // Always reconcile the cache with the latest polled top list to ensure
    // newest transfers appear even on the first tick (when detector primes)
    if (PAGINATION_CONFIG.SUB_PREPEND_WITHOUT_REFETCH) {
      const baseWhere = buildTransferWhereFilter({ resolvedAddress, resolvedEvmAddress });
      const orderBy = ['timestamp_DESC', 'id_DESC'] as TransferOrderByInput[];

      // Use the raw polled list as prepend candidates (already newest-first)
      const candidates = rawTransfers;
      // Cover timing races between address resolution variants by updating multiple where shapes.
      const whereVariantsRaw = [
        baseWhere,
        buildTransferWhereFilter({ resolvedAddress, resolvedEvmAddress: null }),
        buildTransferWhereFilter({ resolvedAddress: null, resolvedEvmAddress }),
      ].filter(Boolean) as Array<Record<string, unknown>>;
      const seenWhere = new Set<string>();
      const whereVariants = whereVariantsRaw.filter((w) => {
        const key = JSON.stringify(w);
        if (seenWhere.has(key)) return false;
        seenWhere.add(key);
        return true;
      });

      for (const where of whereVariants) {
        try {
          console.info('[sub] cache.reconcile prepend', {
            candCount: candidates.length,
            vars: { first: PAGINATION_CONFIG.API_FETCH_PAGE_SIZE, where, orderBy },
          });
        } catch {}
        try {
          client.cache.updateQuery<TransfersFeeQueryQuery, TransfersFeeQueryQueryVariables>(
            {
              query: PAGINATED_TRANSFERS_QUERY as unknown as TypedDocumentNode<TransfersFeeQueryQuery, TransfersFeeQueryQueryVariables>,
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
                const id = (e as any)?.node?.id as string | undefined;
                if (id) existingIds.add(id);
              }
              // Build edges to prepend for candidates not yet present
              const prependEdges = candidates
                .filter((node) => !existingIds.has(node.id))
                .map((node) => ({
                  __typename: 'TransferEdge' as const,
                  node: {
                    __typename: 'Transfer' as const,
                    ...(node as any),
                    token: {
                      __typename: 'VerifiedContract' as const,
                      id: (node as any)?.token?.id,
                      name: (node as any)?.token?.name,
                      contractData: null, // satisfy selection set
                    },
                  },
                }));

              if (prependEdges.length === 0) return prev; // no changes

              const seen = new Set<string>();
              const resultEdges: typeof existingEdges = [];
              // Prepend new edges first
              for (const e of prependEdges) {
                const id = (e as any)?.node?.id as string | undefined;
                if (!id) continue;
                if (!seen.has(id)) {
                  seen.add(id);
                  resultEdges.push(e as (typeof existingEdges)[number]);
                }
              }
              // Then keep existing edges in order, skipping duplicates
              for (const e of existingEdges) {
                const id = (e as any)?.node?.id as string | undefined;
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
      // Fallback: refetch the first page to let merge policy replace edges
      try {
        console.info('[sub] refetch list after new transfers');
      } catch {}
      void client
        .refetchQueries({
          include: [
            PAGINATED_TRANSFERS_QUERY as unknown as TypedDocumentNode<TransfersFeeQueryQuery, TransfersFeeQueryQueryVariables>,
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
    return () => { cancelled = true; };
  }, [data, error, onNewTransfer, resolvedAddress, resolvedEvmAddress, client, feesByHash]);
}
