import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, ApolloError } from '@apollo/client';
import { PAGINATED_TRANSFERS_QUERY } from '../data/transfers';
import type { TransfersFeeQueryQuery as TransfersFeeQuery, TransfersFeeQueryQueryVariables as TransfersFeeQueryVariables } from '../types/graphql-generated';
import { mapTransfersToUiTransfers, type UiTransfer } from '../data/transfer-mapper';
import { useAddressResolver } from './use-address-resolver';


export interface UseTransactionDataReturn {
  transfers: UiTransfer[];
  loading: boolean;
  error?: ApolloError | Error;
  hasMore: boolean;
  fetchMore: () => void;
  totalCount: number;
}

export function useTransactionDataWithBlocks(
  accountAddress: string | null | undefined,
  limit: number
): UseTransactionDataReturn {

  const { resolveAddress } = useAddressResolver();
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  useEffect(() => {
    if (!accountAddress) {
      setResolvedAddress(null);
      return;
    }

    const resolveAndSet = async () => {
      setIsResolvingAddress(true);
      try {
        const evmAddress = await resolveAddress(accountAddress);
        setResolvedAddress(evmAddress);
      } catch (error) {
        console.error('Failed to resolve address:', error);
        setResolvedAddress(null); // Set to null on error to prevent invalid queries
      }
      finally {
        setIsResolvingAddress(false);
      }
    };

    resolveAndSet();
  }, [accountAddress, resolveAddress]);

  const { data, loading, error, fetchMore: apolloFetchMore } = 
    useQuery<TransfersFeeQuery, TransfersFeeQueryVariables>(PAGINATED_TRANSFERS_QUERY, {
      variables: {
        first: limit,
        where: {
          OR: [
            { from: { id_eq: resolvedAddress } },
            { to: { id_eq: resolvedAddress } },
          ],
        },
        orderBy: 'timestamp_DESC',
      },
      skip: !resolvedAddress,
      notifyOnNetworkStatusChange: true,
    });

  const uiTransfers = useMemo(() => {
    const edges = data?.transfersConnection.edges || [];
    if (edges.length === 0) {
      return [];
    }

    const mapped = mapTransfersToUiTransfers(edges, resolvedAddress);
    return mapped;
  }, [data, resolvedAddress]);

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
    totalCount: data?.transfersConnection.totalCount || 0,
  };
}
