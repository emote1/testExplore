import { useEffect, useMemo, useState } from 'react';
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

  // Apollo cache is the single source of truth; pages are merged by typePolicies

  const pageCount = useMemo(() => {
    if (totalCount === 0) return 0;
    return Math.ceil(totalCount / pagination.pageSize);
  }, [totalCount, pagination.pageSize]);

  const dataForCurrentPage = useMemo(() => {
    const { pageIndex, pageSize } = pagination;
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return (initialTransactions || []).slice(start, end);
  }, [pagination, initialTransactions]);

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
    const itemsLoaded = (initialTransactions || []).length;
    const currentPageFirstItemIndex = pagination.pageIndex * pagination.pageSize;

    // Fetch more if we are near the end of the currently loaded data and a next page exists.
    if (itemsLoaded > 0 && itemsLoaded - currentPageFirstItemIndex < pagination.pageSize && hasNextPage && !isLoading) {
      fetchMore();
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    initialTransactions?.length,
    hasNextPage,
    isLoading,
    fetchMore,
  ]);

  return {
    table,
    isLoading,
    error,
  };
}
