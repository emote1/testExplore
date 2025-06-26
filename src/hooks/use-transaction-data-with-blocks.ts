import { useMemo, useCallback, useEffect, useState } from 'react';
import { useQuery, useLazyQuery, ApolloError, NetworkStatus } from '@apollo/client';
import {
  TransfersQueryQuery as TransfersQuery,
  TransfersQueryQueryVariables as TransfersQueryVariables,
  ExtrinsicsByIdsQuery,
  TransferOrderByInput,
  ExtrinsicsByIdsQueryVariables,
} from '../types/graphql-generated';
import { UiTransfer, mapTransfersToUiTransfers } from '../data/transfer-mapper';
import { PAGINATED_TRANSFERS_QUERY, EXTRINSICS_BY_IDS_QUERY } from '../data/transfers';

const EMPTY_TRANSACTIONS: UiTransfer[] = [];

export interface UseTransactionDataReturn {
  transactions: UiTransfer[];
  isLoading: boolean;
  isFetching: boolean;
  error?: ApolloError;
  fetchMore: () => void;
  hasNextPage: boolean;
  totalCount: number;
}

const ORDER_BY_TIMESTAMP_DESC: TransferOrderByInput[] = ['timestamp_DESC'];

export function useTransactionDataWithBlocks(
  accountAddress: string | null,
  limit: number,
): UseTransactionDataReturn {
  const {
    data: transfersData,
    loading: transfersLoading,
    error: transfersError,
    fetchMore: apolloFetchMore,
    networkStatus,
  } = useQuery<TransfersQuery, TransfersQueryVariables>(
    PAGINATED_TRANSFERS_QUERY,
    {
      variables: {
        first: limit,
        after: null,
        orderBy: ORDER_BY_TIMESTAMP_DESC,
        where: {
          OR: [
            { from: { id_eq: accountAddress } },
            { to: { id_eq: accountAddress } },
          ],
        },
      },
      skip: !accountAddress,
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
      notifyOnNetworkStatusChange: true,
    },
  );

  const [allExtrinsics, setAllExtrinsics] = useState<ExtrinsicsByIdsQuery['extrinsics']>([]);

  const allExtrinsicIds = useMemo(() => {
    const ids = new Set<string>();
    transfersData?.transfersConnection?.edges.forEach((edge) => {
      if (edge?.node?.extrinsicId) {
        ids.add(edge.node.extrinsicId);
      }
    });
    return Array.from(ids);
  }, [transfersData]);

  const newExtrinsicIds = useMemo(() => {
    const fetchedIds = new Set(allExtrinsics.map((ext) => ext.id));
    return allExtrinsicIds.filter((id) => !fetchedIds.has(id));
  }, [allExtrinsicIds, allExtrinsics]);

  const [fetchExtrinsics, { loading: extrinsicsLoading, error: extrinsicsError }] = useLazyQuery<
    ExtrinsicsByIdsQuery,
    ExtrinsicsByIdsQueryVariables
  >(EXTRINSICS_BY_IDS_QUERY, {
    onCompleted: (data) => {
      if (data?.extrinsics) {
        setAllExtrinsics((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newOnes = data.extrinsics.filter((e) => !existingIds.has(e.id));
          return [...prev, ...newOnes];
        });
      }
    },
  });

  useEffect(() => {
    if (newExtrinsicIds.length > 0) {
      fetchExtrinsics({ variables: { ids: newExtrinsicIds } });
    }
  }, [newExtrinsicIds, fetchExtrinsics]);

  const transactions = useMemo(() => {
    const transferEdges = transfersData?.transfersConnection.edges || [];
    if (!accountAddress) return EMPTY_TRANSACTIONS;
    return mapTransfersToUiTransfers(transferEdges, accountAddress, allExtrinsics);
  }, [transfersData, allExtrinsics, accountAddress]);

  const hasNextPage = transfersData?.transfersConnection?.pageInfo?.hasNextPage || false;

  const fetchMore = useCallback(() => {
    if (!hasNextPage || !transfersData?.transfersConnection?.pageInfo?.endCursor) return;

    apolloFetchMore({
      variables: {
        after: transfersData.transfersConnection.pageInfo.endCursor,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult?.transfersConnection) return prev;
        const newEdges = fetchMoreResult.transfersConnection.edges;
        if (!newEdges || newEdges.length === 0) {
          return {
            ...prev,
            transfersConnection: {
              ...prev.transfersConnection,
              pageInfo: fetchMoreResult.transfersConnection.pageInfo,
            },
          };
        }
        return {
          ...prev,
          transfersConnection: {
            ...prev.transfersConnection,
            pageInfo: fetchMoreResult.transfersConnection.pageInfo,
            edges: [...prev.transfersConnection.edges, ...newEdges],
          },
        };
      },
    });
  }, [apolloFetchMore, hasNextPage, transfersData]);

  const isLoading = (transfersLoading || extrinsicsLoading) && networkStatus !== NetworkStatus.fetchMore;
  const error = transfersError || extrinsicsError;

  return {
    transactions,
    isLoading,
    isFetching: networkStatus === NetworkStatus.fetchMore,
    error,
    fetchMore,
    hasNextPage,
    totalCount: transfersData?.transfersConnection?.totalCount || 0,
  };
}
