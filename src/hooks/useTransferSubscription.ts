import { useRef, useEffect, useMemo, useState } from 'react';
import { useQuery, useApolloClient } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { mapTransfersToUiTransfers, type UiTransfer } from '../data/transfer-mapper';
import type { TransferOrderByInput, TransfersPollingQueryQuery, TransfersPollingQueryQueryVariables } from '@/gql/graphql';
import { TRANSFERS_POLLING_QUERY, PAGINATED_TRANSFERS_QUERY } from '../data/transfers';
import { fetchFeesByExtrinsicHashes, getCachedFee } from '../data/transfers';
import { PAGINATION_CONFIG } from '../constants/pagination';
import { useAddressResolver } from './use-address-resolver';

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
  const seenTransferIds = useRef<Set<string>>(new Set());
  const lastSeenTimestamp = useRef<string | null>(null);
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
    const orClauses: any[] = [];
    if (resolvedAddress) {
      orClauses.push({ from: { id_eq: resolvedAddress } });
      orClauses.push({ to: { id_eq: resolvedAddress } });
    }
    if (resolvedEvmAddress) {
      orClauses.push({ fromEvmAddress_eq: resolvedEvmAddress });
      orClauses.push({ toEvmAddress_eq: resolvedEvmAddress });
    }
    if (orClauses.length === 0) return null;

    return {
      where: {
        OR: orClauses,
      },
      orderBy: ['timestamp_DESC'] as TransferOrderByInput[],
      offset: 0,
      limit: PAGINATION_CONFIG.SUBSCRIPTION_FETCH_SIZE,
    };
  }, [resolvedAddress, resolvedEvmAddress]);

  // Clear tracking when address (input) or resolved values change
  useEffect(() => {
    seenTransferIds.current.clear();
    lastSeenTimestamp.current = null;
    setFeesByHash({});
  }, [address, resolvedAddress, resolvedEvmAddress]);

  const { data, error } = useQuery<TransfersPollingQueryQuery, TransfersPollingQueryQueryVariables>(
    TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode<TransfersPollingQueryQuery, TransfersPollingQueryQueryVariables>,
    {
      variables: queryVariables as TransfersPollingQueryQueryVariables,
      skip: !isEnabled || (!resolvedAddress && !resolvedEvmAddress) || !queryVariables,
      pollInterval: isEnabled ? PAGINATION_CONFIG.POLLING_INTERVAL_MS : 0,
      notifyOnNetworkStatusChange: false,
    }
  );

  useEffect(() => {
    if (error) {
      console.error('Subscription error:', error);
      return;
    }

    if (!data?.transfers || (!resolvedAddress && !resolvedEvmAddress)) return;

    // Map transfers to UI format - wrap in edge structure for mapper compatibility
    const transferEdges = data.transfers.map((transfer: TransfersPollingQueryQuery['transfers'][0]) => ({ node: transfer }));
    const uiTransfers = mapTransfersToUiTransfers(transferEdges, resolvedAddress ?? resolvedEvmAddress ?? undefined);

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

    // If this is the first load, just remember the latest timestamp without triggering notifications
    if (lastSeenTimestamp.current === null) {
      lastSeenTimestamp.current = uiTransfers[0]?.timestamp || null;
      uiTransfers.forEach(transfer => {
        seenTransferIds.current.add(transfer.id);
      });
      return;
    }

    // Notify for any transfer we haven't seen yet. Rely on seenTransferIds to prevent duplicates.
    let hasNew = false;
    uiTransfers.forEach(transfer => {
      const isNewTransfer = !seenTransferIds.current.has(transfer.id);
      
      if (isNewTransfer) {
        seenTransferIds.current.add(transfer.id);
        const fee = transfer.extrinsicHash ? (feesByHash[transfer.extrinsicHash] ?? getCachedFee(transfer.extrinsicHash)) : undefined;
        onNewTransfer({ ...transfer, feeAmount: fee ?? transfer.feeAmount });
        hasNew = true;
        
        // Track latest timestamp (not used for gating anymore, but useful for debugging/telemetry)
        if (!lastSeenTimestamp.current || transfer.timestamp > lastSeenTimestamp.current) {
          lastSeenTimestamp.current = transfer.timestamp;
        }
      }
    });
    // Ensure the paginated connection query reflects latest data in the table
    if (hasNew) {
      // Fire-and-forget; we don't need to await in this effect
      void client.refetchQueries({ include: [PAGINATED_TRANSFERS_QUERY] });
    }
    return () => { cancelled = true; };
  }, [data, error, onNewTransfer, resolvedAddress, resolvedEvmAddress, client, feesByHash]);
}
