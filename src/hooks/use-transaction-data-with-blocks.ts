import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { useQuery, ApolloError, NetworkStatus, useLazyQuery } from '@apollo/client';
import { PAGINATED_TRANSFERS_QUERY, FEE_EVENTS_QUERY } from '../data/transfers';
import { TransfersQueryQuery, FeeEventsQueryQuery } from '../types/graphql-generated';
import { UiTransfer, mapTransfersToUiTransfers } from '../data/transfer-mapper';

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

const ORDER_BY_TIMESTAMP_DESC = ['timestamp_DESC'];

export function useTransactionDataWithBlocks(
  accountAddress: string | null,
  limit: number,
): UseTransactionDataReturn {
  const variables = useMemo(() => {
    if (!accountAddress) return undefined;
    return {
      first: limit,
      after: null,
      orderBy: ORDER_BY_TIMESTAMP_DESC,
      where: {
        OR: [
          { from: { id_eq: accountAddress } },
          { to: { id_eq: accountAddress } },
        ],
      },
    };
  }, [limit, accountAddress]);

  const { data, loading, error, fetchMore: apolloFetchMore, networkStatus } = useQuery<TransfersQueryQuery>(
    PAGINATED_TRANSFERS_QUERY,
    {
      variables,
      skip: !accountAddress || !variables,
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
      notifyOnNetworkStatusChange: true,
    },
  );

  const [fees, setFees] = useState<Record<string, string>>({});
  const [loadFees, { data: feeData }] = useLazyQuery<FeeEventsQueryQuery>(FEE_EVENTS_QUERY);

  useEffect(() => {
    if (data?.transfersConnection?.edges) {
      const extrinsicHashes = [
        ...new Set(
          data.transfersConnection.edges
            .map(edge => edge.node.extrinsicHash)
            .filter((hash): hash is string => !!hash),
        ),
      ];

      if (extrinsicHashes.length > 0) {
        loadFees({
          variables: {
            orderBy: ['timestamp_DESC'],
            where: {
              section_eq: 'transactionpayment',
              method_eq: 'TransactionFeePaid',
              extrinsic: { hash_in: extrinsicHashes },
            },
          },
        });
      }
    }
  }, [data, loadFees]);

  useEffect(() => {
    if (feeData?.eventsConnection?.edges) {
      const newFees = feeData.eventsConnection.edges.reduce(
        (acc: Record<string, string>, edge) => {
          const event = edge.node;
          if (event?.extrinsic?.hash && Array.isArray(event.data) && event.data.length >= 2) {
            const feeAmount = event.data[1]?.toString();
            if (feeAmount) {
              acc[event.extrinsic.hash] = feeAmount;
            }
          }
          return acc;
        },
        {},
      );

      if (Object.keys(newFees).length > 0) {
        setFees(prevFees => ({ ...prevFees, ...newFees }));
      }
    }
  }, [feeData]);

  const baseTransactions = useMemo(() => {
    if (!data?.transfersConnection?.edges) return EMPTY_TRANSACTIONS;
    return mapTransfersToUiTransfers(data.transfersConnection.edges, accountAddress);
  }, [data, accountAddress]);

  const transactions = useMemo(() => {
    if (Object.keys(fees).length === 0) {
      return baseTransactions;
    }
    return baseTransactions.map(tx => {
      const feeAmount = fees[tx.hash];
      if (feeAmount) {
        return { ...tx, feeAmount };
      }
      return tx;
    });
  }, [baseTransactions, fees]);

  const pageInfoRef = useRef(data?.transfersConnection?.pageInfo);
  pageInfoRef.current = data?.transfersConnection?.pageInfo;

  const hasNextPage = data?.transfersConnection?.pageInfo?.hasNextPage || false;

  const fetchMore = useCallback(() => {
    const currentPageInfo = pageInfoRef.current;
    if (!currentPageInfo?.hasNextPage || !currentPageInfo?.endCursor) return;

    apolloFetchMore({
      variables: {
        after: currentPageInfo.endCursor,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult?.transfersConnection) return prev;

        type Edge = typeof prev.transfersConnection.edges[0];
        const existingIds = new Set(prev.transfersConnection.edges.map((e: Edge) => e.node.id));
        const newEdges = fetchMoreResult.transfersConnection.edges.filter((e: Edge) => !existingIds.has(e.node.id));

        if (newEdges.length === 0) {
          return {
            ...prev,
            transfersConnection: {
              ...prev.transfersConnection,
              pageInfo: {
                ...fetchMoreResult.transfersConnection.pageInfo,
                hasNextPage: false,
              },
            },
          };
        }

        return {
          ...prev,
          transfersConnection: {
            ...prev.transfersConnection,
            pageInfo: fetchMoreResult.transfersConnection.pageInfo,
            edges: [
              ...prev.transfersConnection.edges,
              ...newEdges,
            ],
          },
        };
      },
    });
  }, [apolloFetchMore]);

  return {
    transactions,
    isLoading: loading && networkStatus !== NetworkStatus.fetchMore,
    isFetching: networkStatus === NetworkStatus.fetchMore,
    error,
    fetchMore,
    hasNextPage,
    totalCount: data?.transfersConnection?.totalCount || 0,
  };
}
