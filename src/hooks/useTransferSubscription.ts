import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { useCallback, useRef, useEffect, useMemo } from 'react';
import type { Transaction } from '../types/transaction-types';
import { mapTransferToTransaction } from '../utils/transfer-mapper';
import { PAGINATION_CONFIG } from '../constants/pagination';

const TRANSFERS_QUERY = gql`
  query RecentTransfers($where: TransferWhereInput, $orderBy: [TransferOrderByInput!]) {
    transfers(where: $where, orderBy: $orderBy, limit: 5) {
      id
      amount
      timestamp
      success
      extrinsicHash
      from {
        id
      }
      to {
        id
      }
      token {
        id
        name
        contractData
      }
    }
  }
`;

interface UseTransferSubscriptionProps {
  nativeAddress: string | null;
  onNewTransaction: (transaction: Transaction) => void;
  isEnabled: boolean;
}

export function useTransferSubscription({
  nativeAddress,
  onNewTransaction,
  isEnabled
}: UseTransferSubscriptionProps) {
  const addedTransactionIds = useRef<Set<string>>(new Set());

  // Clear tracking when address changes
  useEffect(() => {
    addedTransactionIds.current.clear();
  }, [nativeAddress]);

  const processTransfer = useCallback((transfer: any): Transaction | null => {
    if (!transfer) return null;

    // Client-side filtering since we're getting all transfers
    if (nativeAddress !== null) {
      const isRelevant = transfer.from?.id === nativeAddress || transfer.to?.id === nativeAddress;
      if (!isRelevant) {
        return null;
      }
    }

    // Use the reusable mapper utility
    return mapTransferToTransaction(transfer, nativeAddress);
  }, [nativeAddress]);

  // Memoize query variables to prevent unnecessary re-renders
  const queryVariables = useMemo(() => {
    return nativeAddress !== null ? {
      where: {
        OR: [
          { from: { id_eq: nativeAddress } },
          { to: { id_eq: nativeAddress } }
        ]
      },
      orderBy: ['timestamp_DESC' as const]
    } : undefined;
  }, [nativeAddress]);

  // Use polling instead of subscription since server doesn't support Subscription.transfers
  const { data, error } = useQuery(TRANSFERS_QUERY, {
    variables: queryVariables,
    pollInterval: isEnabled ? PAGINATION_CONFIG.POLLING_INTERVAL_MS : 0, // Use configurable polling interval
    skip: !isEnabled || nativeAddress === null, // Skip query if disabled or no address
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true
  });

  // Process new data when it arrives
  useEffect(() => {
    if (!data?.transfers?.length) {
      return;
    }
    
    // Process all transfers
    data.transfers.forEach((transfer: any) => {
      // Check if we've already added this transaction
      if (addedTransactionIds.current.has(transfer.id)) {
        return;
      }
      
      const transaction = processTransfer(transfer);
      
      if (transaction) {
        addedTransactionIds.current.add(transfer.id);
        onNewTransaction(transaction);
      }
    });
  }, [data, processTransfer, onNewTransaction]);

  // Log errors always to ensure tests can verify error handling
  useEffect(() => {
    if (error) {
      console.error('Polling error:', error);
    }
  }, [error]);
  
  // Всегда возвращаем объект с методами, даже если запрос отключен
  return {
    isPolling: isEnabled && nativeAddress !== null
  };
}
