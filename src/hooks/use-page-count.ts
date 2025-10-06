import { useMemo } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import type { UiTransfer } from '@/data/transfer-mapper';

interface UsePageCountArgs {
  pagination: PaginationState;
  tokenFilter: string;
  swapOnly: boolean;
  totalCount?: number;
  newItemsCount: number;
  initialTransactions?: UiTransfer[] | null;
  filteredTransactions?: UiTransfer[] | null;
  hasNextPage: boolean;
  pageCountOverride: number;
  /** When true, server query is already strictly filtered by token ids */
  strictServerActive?: boolean;
}

export function usePageCount({
  pagination,
  tokenFilter,
  swapOnly,
  totalCount,
  newItemsCount,
  initialTransactions,
  filteredTransactions,
  hasNextPage,
  pageCountOverride,
  strictServerActive,
}: UsePageCountArgs) {
  const hasExactTotal = useMemo(() => {
    // Swap view with token filter: treat as exact (we compute from filtered list)
    if (swapOnly && tokenFilter !== 'all') return true;
    // Exact from API for All (non-swap) and REEF
    if ((((tokenFilter === 'all') && !swapOnly) || tokenFilter === 'reef') && typeof totalCount === 'number' && Number.isFinite(totalCount)) return true;
    // Exact for filtered token views when server filter is strict and API reports totalCount
    if (!swapOnly && tokenFilter !== 'all' && strictServerActive && typeof totalCount === 'number' && Number.isFinite(totalCount)) return true;
    // For client-side filtered token views: if there is no next page, loaded count is final
    if (!swapOnly && tokenFilter !== 'all' && !hasNextPage) return true;
    // UX improvement: if on first page we loaded less than a full page, treat as exact 1 page
    if (!swapOnly && tokenFilter !== 'all' && (filteredTransactions?.length || 0) < pagination.pageSize && pagination.pageIndex === 0) return true;
    // Swap view + token filtered: if first page underfilled, treat as exact 1 page for clarity
    if (swapOnly && tokenFilter !== 'all' && (filteredTransactions?.length || 0) < pagination.pageSize && pagination.pageIndex === 0) return true;
    return false;
  }, [totalCount, tokenFilter, swapOnly, strictServerActive, hasNextPage, filteredTransactions, pagination.pageSize, pagination.pageIndex]);

  const pageCount = useMemo(() => {
    const size = pagination.pageSize;
    // Compute effective total safely when we consider the total exact
    let effectiveTotal: number | undefined = undefined;
    if (hasExactTotal) {
      if (typeof totalCount === 'number' && Number.isFinite(totalCount)) {
        effectiveTotal = Math.max(0, totalCount);
      } else if (tokenFilter !== 'all') {
        // Client-filtered (including Swap) exact views: use filtered count
        effectiveTotal = Math.max(0, (filteredTransactions || []).length);
      } else {
        effectiveTotal = 0;
      }
    }

    if (hasExactTotal) {
      const computed = Math.ceil((effectiveTotal ?? 0) / size);
      let adjusted = computed;
      if (tokenFilter === 'all' && !hasNextPage) {
        const aggTotal = Math.max(0, (initialTransactions || []).length - (newItemsCount || 0));
        const aggPages = Math.ceil(aggTotal / size);
        adjusted = Math.min(computed, Math.max(aggPages, pagination.pageIndex + 1));
      }
      return Math.max(adjusted, pagination.pageIndex + 1);
    }

    if (swapOnly) {
      if (tokenFilter !== 'all') {
        // Token-filtered Swap: base on filtered list to avoid phantom pages
        const itemsLoaded = (filteredTransactions || []).length;
        const pagesLoaded = itemsLoaded > 0 ? Math.ceil(itemsLoaded / size) : 0;
        const computed = pagesLoaded; // treat as exact based on current filtered items
        return Math.max(computed, pagination.pageIndex + 1);
      }
      const itemsLoadedRaw = Math.max(0, (initialTransactions || []).length - (newItemsCount || 0));
      const pagesLoaded = itemsLoadedRaw > 0 ? Math.ceil(itemsLoadedRaw / size) : 0;
      const computed = hasNextPage ? pagesLoaded + 1 : pagesLoaded;
      const minForCurrent = pagination.pageIndex + 1;
      const minForNext = hasNextPage ? pagination.pageIndex + 2 : minForCurrent;
      const withOverride = Math.max(computed, minForNext, pageCountOverride || 0);
      return withOverride;
    }

    // All/Incoming/Outgoing act like filtered views because swaps are excluded
    const itemsLoaded = (filteredTransactions || []).length;
    const pagesLoaded = itemsLoaded > 0 ? Math.ceil(itemsLoaded / size) : 0;
    const computed = hasNextPage ? pagesLoaded + 1 : pagesLoaded;
    return Math.max(computed, pagination.pageIndex + 1);
  }, [hasExactTotal, totalCount, newItemsCount, initialTransactions, filteredTransactions, tokenFilter, swapOnly, pagination.pageSize, hasNextPage, pagination.pageIndex, pageCountOverride]);

  return { hasExactTotal, pageCount } as const;
}
