import { useCallback, useState } from 'react';
import { PAGINATION_CONFIG } from '../constants/pagination';

// --- Abstracted Types ---
// These types are independent of any specific table library.

/**
 * Represents the state of pagination.
 */
export interface AppPaginationState {
  pageIndex: number;
  pageSize: number;
}

/**
 * Represents the state of sorting. An array of objects, each specifying a column and direction.
 */
export type AppSortingState = { id: string; desc: boolean }[];

// --- Hook Return Type ---

/**
 * Describes the return shape of the usePaginationAndSorting hook, using abstracted types.
 */
export interface PaginationAndSorting {
  pagination: AppPaginationState;
  setPagination: React.Dispatch<React.SetStateAction<AppPaginationState>>;
  sorting: AppSortingState;
  setSorting: React.Dispatch<React.SetStateAction<AppSortingState>>;
  reset: () => void;
}

// --- Hook Implementation ---

const defaultInitialPagination: AppPaginationState = {
  pageIndex: 0,
  pageSize: PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE,
};

/**
 * A custom hook to manage the state for pagination and sorting.
 * It is decoupled from any specific UI table library.
 * @param initialPagination Optional initial state for pagination.
 * @param initialSorting Optional initial state for sorting.
 */
export function usePaginationAndSorting(
  initialPagination?: Partial<AppPaginationState>,
  initialSorting?: AppSortingState
): PaginationAndSorting {
  const [pagination, setPagination] = useState<AppPaginationState>({
    ...defaultInitialPagination,
    ...initialPagination,
  });

  const [sorting, setSorting] = useState<AppSortingState>(initialSorting ?? []);

  const reset = useCallback(() => {
    setPagination({
      ...defaultInitialPagination,
      ...initialPagination,
    });
    setSorting(initialSorting ?? []);
  }, [initialPagination, initialSorting]);

  return {
    pagination,
    setPagination,
    sorting,
    setSorting,
    reset,
  };
}
