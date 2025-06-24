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
import { ApolloError } from '@apollo/client';

export interface TanstackTransactionAdapterReturn {
  table: Table<UiTransfer>;
  isLoading: boolean;
  isFetching: boolean;
  error?: ApolloError;
  addTransaction: (newTransaction: UiTransfer) => void;
}

export function useTanstackTransactionAdapter(
  address: string,
): TanstackTransactionAdapterReturn {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const {
    transactions: initialTransactions,
    isLoading,
    isFetching,
    error,
    fetchMore,
    hasNextPage,
    totalCount,
  } = useTransactionDataWithBlocks(address, 50);

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
    const total = Math.max(totalCount, allTransactions.length);
    return Math.ceil(total / pagination.pageSize);
  }, [totalCount, allTransactions.length, pagination.pageSize]);

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
    const itemsLoaded = initialTransactions.length;
    const currentPageFirstItemIndex = pagination.pageIndex * pagination.pageSize;

    if (itemsLoaded > 0 && itemsLoaded <= currentPageFirstItemIndex && hasNextPage && !isLoading && !isFetching) {
      fetchMore();
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    initialTransactions.length,
    hasNextPage,
    isLoading,
    isFetching,
    fetchMore,
  ]);

  return {
    table,
    isLoading,
    isFetching,
    error,
    addTransaction,
  };
}
