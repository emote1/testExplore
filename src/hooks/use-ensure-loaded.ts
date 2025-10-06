import { useEffect, type MutableRefObject } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import { PAGINATION_CONFIG } from '../constants/pagination';
import type { UiTransfer } from '../data/transfer-mapper';

interface EnsureLoadedArgs {
  fastModeActive: boolean;
  swapOnly: boolean;
  pagination: PaginationState;
  initialTransactions?: UiTransfer[] | null;
  filteredTransactions?: UiTransfer[] | null;
  tokenFilter: string;
  hasNextPage: boolean;
  fetchMore: () => Promise<void>;
  newItemsCount: number;
  dbg?: (...args: any[]) => void;
}

interface EnsureLoadedRefs {
  inFlightEnsureRef: MutableRefObject<boolean>;
  ensureSeqRef: MutableRefObject<number>;
  ensureMaxedRef: MutableRefObject<boolean>;
}

export function useEnsureLoaded(
  {
    fastModeActive,
    swapOnly,
    pagination,
    initialTransactions,
    filteredTransactions,
    tokenFilter,
    hasNextPage,
    fetchMore,
    newItemsCount,
    dbg,
  }: EnsureLoadedArgs,
  { inFlightEnsureRef, ensureSeqRef, ensureMaxedRef }: EnsureLoadedRefs,
) {
  useEffect(() => {
    if (fastModeActive) return; // skip sequential ensure loop in fast mode
    // Optimization: for Swap + token-filtered views that clearly fit into a single page, skip ensure loop
    if (swapOnly && tokenFilter !== 'all') {
      const items = (filteredTransactions || []).length;
      const singlePage = !hasNextPage && items <= pagination.pageSize;
      if (singlePage && pagination.pageIndex === 0) return;
    }
    let cancelled = false;
    const seq = (ensureSeqRef.current = (ensureSeqRef.current ?? 0) + 1);
    ensureMaxedRef.current = false;

    async function run() {
      if (inFlightEnsureRef.current) return; // Avoid overlapping runs

      const { pageIndex, pageSize } = pagination;
      const ladderPages = swapOnly ? 1 : Math.max(1, PAGINATION_CONFIG.NON_FAST_LADDER_UI_PAGES || 1);
      const isFilteredMode = (tokenFilter !== 'all') || swapOnly;
      const requiredCount = isFilteredMode
        ? (pageIndex + ladderPages) * pageSize
        : (newItemsCount + (pageIndex + ladderPages) * pageSize);

      let attempts = 0;
      const maxAttempts = (PAGINATION_CONFIG.MAX_SEQUENTIAL_FETCH_PAGES || 20);
      dbg?.('ensureLoaded: start', {
        pageIndex,
        pageSize,
        requiredCount,
        newItemsCount,
        itemsLoaded: isFilteredMode ? (filteredTransactions || []).length : (initialTransactions || []).length,
        hasNextPage,
      });

      while (!cancelled) {
        const itemsLoaded = isFilteredMode ? (filteredTransactions || []).length : (initialTransactions || []).length;
        if (!isFilteredMode) {
          if (!initialTransactions || initialTransactions.length === 0) { dbg?.('ensureLoaded: base query not ready'); break; }
        }
        if (itemsLoaded >= requiredCount) break;
        if (!hasNextPage) break;
        if (attempts >= maxAttempts) break;

        inFlightEnsureRef.current = true;
        try {
          dbg?.('ensureLoaded: fetchMore', { attempt: attempts + 1, itemsLoaded, requiredCount });
          await fetchMore();
        } catch {
          break; // surface errors via error state; stop loop
        } finally {
          inFlightEnsureRef.current = false;
        }
        attempts++;
        if (seq !== ensureSeqRef.current) break; // deps changed, abandon
      }

      ensureMaxedRef.current = (attempts >= maxAttempts) || !hasNextPage;
      dbg?.('ensureLoaded: end', { attempts, maxed: ensureMaxedRef.current });
    }

    run();

    return () => {
      cancelled = true;
      ensureSeqRef.current = (ensureSeqRef.current ?? 0) + 1; // bump seq to signal abandonment
    };
  }, [fastModeActive, swapOnly, pagination.pageIndex, pagination.pageSize, initialTransactions, filteredTransactions, tokenFilter, hasNextPage, fetchMore, newItemsCount]);
}
