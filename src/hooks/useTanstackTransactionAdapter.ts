import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  Table,
  PaginationState,
} from '@tanstack/react-table';
import { useTransactionDataWithBlocks } from './use-transaction-data-with-blocks';
import { transactionColumns } from '../components/transaction-columns';
import { UiTransfer } from '../data/transfer-mapper';
import { PAGINATION_CONFIG } from '../constants/pagination';
import { ApolloError } from '@apollo/client';

export interface TanstackTransactionAdapterReturn {
  table: Table<UiTransfer>;
  isLoading: boolean;
  error?: ApolloError | Error;
  addTransaction: (newTransaction: UiTransfer) => void;
}

export function useTanstackTransactionAdapter(
  address: string,
): TanstackTransactionAdapterReturn {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE,
  });

  const {
    transfers: initialTransactions,
    loading: isLoading,
    error,
    fetchMore,
    hasMore: hasNextPage,
    totalCount,
  } = useTransactionDataWithBlocks(address, PAGINATION_CONFIG.API_FETCH_PAGE_SIZE);

  const [allTransactions, setAllTransactions] = useState<UiTransfer[]>(initialTransactions || []);

  useEffect(() => {
    // When the initial transactions from the query change (e.g., new address search),
    // reset the allTransactions state. We combine the new initial list with any
    // transactions that might have come from the subscription in the meantime.
    setAllTransactions(currentSubscribed => {
      const initialIds = new Set((initialTransactions || []).map(t => t.id));
      const uniqueSubscribed = currentSubscribed.filter(t => !initialIds.has(t.id));
      return [...uniqueSubscribed, ...(initialTransactions || [])];
    });
  }, [initialTransactions]);


  const addTransaction = useCallback((newTransaction: UiTransfer) => {
    setAllTransactions(currentTransactions => {
      if (currentTransactions.some(t => t.id === newTransaction.id)) {
        return currentTransactions;
      }
      return [newTransaction, ...currentTransactions];
    });
  }, []);

  const pageCount = useMemo(() => {
    if (totalCount === 0) return 0;
    return Math.ceil(totalCount / pagination.pageSize);
  }, [totalCount, pagination.pageSize]);

  const dataForCurrentPage = useMemo(() => {
    const { pageIndex, pageSize } = pagination;
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return allTransactions.slice(start, end);
  }, [pagination, allTransactions]);

  const table = useReactTable({
    data: dataForCurrentPage,
    columns: transactionColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount,
    state: { pagination },
    onPaginationChange: setPagination,
  });

  useEffect(() => {
    const itemsLoaded = allTransactions.length;
    const currentPageFirstItemIndex = pagination.pageIndex * pagination.pageSize;

    // Fetch more if we are near the end of the currently loaded data and a next page exists.
    if (itemsLoaded > 0 && itemsLoaded - currentPageFirstItemIndex < pagination.pageSize && hasNextPage && !isLoading) {
      fetchMore();
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    allTransactions.length,
    hasNextPage,
    isLoading,
    fetchMore,
  ]);

  return {
    table,
    isLoading,
    error,
    addTransaction,
  };
}
