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
    pageSize: 10, // Must match page size in the data hook
  });

  const {
    transactions: mappedTransactions,
    isLoading,
    isFetching,
    error,
    fetchMore,
    hasNextPage,
    totalCount,
  } = useTransactionDataWithBlocks(address, 50);

  const [newSubscribedTransfers, setNewSubscribedTransfers] = useState<UiTransfer[]>([]);

  const combinedData = useMemo(() => {
    const mappedIds = new Set((mappedTransactions || []).map(t => t.id));
    const uniqueNewSubscribed = newSubscribedTransfers.filter(t => !mappedIds.has(t.id));
    return [...uniqueNewSubscribed, ...mappedTransactions];
  }, [newSubscribedTransfers, mappedTransactions]);

  const pageCount = useMemo(() => {
    if (!totalCount) return 0;
    // Adjust total count for new items from subscription
    const total = totalCount + (combinedData.length - mappedTransactions.length);
    return Math.ceil(total / pagination.pageSize);
  }, [totalCount, pagination.pageSize, combinedData.length, mappedTransactions.length]);

  const dataForCurrentPage = useMemo(() => {
    const { pageIndex, pageSize } = pagination;
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return combinedData.slice(start, end);
  }, [pagination, combinedData]);

  const addTransaction = useCallback((newTransaction: UiTransfer) => {
    setNewSubscribedTransfers(prevData => [newTransaction, ...prevData]);
  }, []);

  const meta = useMemo(() => ({
    addTransaction,
  }), [addTransaction]);

  const tableState = useMemo(() => ({
    pagination,
  }), [pagination]);

  const table = useReactTable({
    data: dataForCurrentPage,
    meta,
    columns: transactionColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount,
    state: tableState,
    onPaginationChange: setPagination,
  });

  // Effect to fetch more data when the user paginates to a page for which we don't have data.
  useEffect(() => {
    const itemsLoaded = mappedTransactions.length;
    const currentPageFirstItemIndex = pagination.pageIndex * pagination.pageSize;

    // If the number of loaded items is less than or equal to the index of the first item
    // on the page the user is trying to view, we need to fetch more data.
    if (itemsLoaded <= currentPageFirstItemIndex && hasNextPage && !isLoading) {
      fetchMore();
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    mappedTransactions.length,
    hasNextPage,
    isLoading,
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
