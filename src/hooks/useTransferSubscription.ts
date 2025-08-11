import { useRef, useEffect, useMemo } from 'react';
import { mapTransfersToUiTransfers, type UiTransfer } from '../data/transfer-mapper';
import { useTransfersPollingQueryQuery, type TransferOrderByInput, type TransfersPollingQueryQuery } from '../types/graphql-generated';

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

  const queryVariables = useMemo(() => {
    if (!address) return null;

    return {
      where: {
        OR: [
          { from: { id_eq: address } },
          { to: { id_eq: address } },
        ],
      },
      orderBy: ['timestamp_DESC'] as TransferOrderByInput[],
      offset: 0,
      limit: 10,
    };
  }, [address]);

  // Clear tracking when address changes
  useEffect(() => {
    seenTransferIds.current.clear();
    lastSeenTimestamp.current = null;
  }, [address]);

  const { data, error } = useTransfersPollingQueryQuery({
    variables: queryVariables!,
    skip: !isEnabled || !address,
    pollInterval: isEnabled ? 20000 : 0, // Poll every 20 seconds when enabled (reduced from 5s)
    notifyOnNetworkStatusChange: false,
  });

  useEffect(() => {
    if (error) {
      console.error('Subscription error:', error);
      return;
    }

    if (!data?.transfers || !address) return;

    // Map transfers to UI format - wrap in edge structure for mapper compatibility
    const transferEdges = data.transfers.map((transfer: TransfersPollingQueryQuery['transfers'][0]) => ({ node: transfer }));
    const uiTransfers = mapTransfersToUiTransfers(transferEdges, address);

    if (uiTransfers.length === 0) return;

    // If this is the first load, just remember the latest timestamp without triggering notifications
    if (lastSeenTimestamp.current === null) {
      lastSeenTimestamp.current = uiTransfers[0]?.timestamp || null;
      uiTransfers.forEach(transfer => {
        seenTransferIds.current.add(transfer.id);
      });
      return;
    }

    // Only notify about transfers that are newer than the last seen timestamp
    uiTransfers.forEach(transfer => {
      const isNewTransfer = !seenTransferIds.current.has(transfer.id) && 
                            transfer.timestamp > (lastSeenTimestamp.current || '');
      
      if (isNewTransfer) {
        seenTransferIds.current.add(transfer.id);
        onNewTransfer(transfer);
        
        // Update the latest timestamp
        if (!lastSeenTimestamp.current || transfer.timestamp > lastSeenTimestamp.current) {
          lastSeenTimestamp.current = transfer.timestamp;
        }
      }
    });
  }, [data, error, onNewTransfer, address]);
}
