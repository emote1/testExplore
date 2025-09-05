import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
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

// In-memory per-address page index memory for the current session
const addressPageMemory = new Map<string, number>();

// Debug flag to trace pagination math without polluting production logs
const DEBUG_TX_PAGINATION = (import.meta as any).env?.DEV
  || (import.meta as any).env?.VITE_TX_PAGINATION_DEBUG === '1'
  || (import.meta as any).env?.VITE_TX_PAGINATION_DEBUG === 'true';
function dbg(...args: any[]) {
  if (!DEBUG_TX_PAGINATION) return;
  // eslint-disable-next-line no-console
  console.debug('[TxPagination]', ...args);
}

export interface TanstackTransactionAdapterReturn {
  table: Table<UiTransfer>;
  isLoading: boolean;
  error?: ApolloError | Error;
  newItemsCount: number;
  showNewItems: (anchorId?: string) => void;
  /**
   * Programmatically jump to a specific page index without TanStack clamping.
   * Accepts zero-based page index.
   */
  goToPage: (pageIndex: number) => void;
  /** Whether the current UI page is still loading (sequential fetch in progress or pending) */
  isPageLoading: boolean;
  /** Current page loading progress in 0..1 (only meaningful when isPageLoading=true) */
  pageLoadProgress: number;
  /** Whether totalCount is known exactly (not heuristic) */
  hasExactTotal: boolean;
  /** Whether fast offset-window mode is active for current page index */
  fastModeActive: boolean;
}

export function useTanstackTransactionAdapter(
  address: string,
): TanstackTransactionAdapterReturn {
  // Allow initial page jump via URL params (?page=6 or ?p=6) for E2E and deep-links.
  const initialPageIndex = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('page') ?? params.get('p') ?? params.get('pageIndex');
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    } catch {
      return 0;
    }
  }, []);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: initialPageIndex,
    pageSize: PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE,
  });
  // Track address changes
  const prevAddressRef = useRef(address);

  const {
    transfers: initialTransactions,
    loading: isLoading,
    error,
    fetchMore,
    hasMore: hasNextPage,
    totalCount,
    fetchWindow,
  } = useTransactionDataWithBlocks(address, PAGINATION_CONFIG.API_FETCH_PAGE_SIZE);

  // Apollo cache is the single source of truth; pages are merged by typePolicies

  // Virtual shift anchor: keep view stable when new items prepend
  const [anchorFirstId, setAnchorFirstId] = useState<string | undefined>(undefined);
  // Reset anchor when address changes
  useEffect(() => {
    dbg('anchor: reset due to address change', { address });
    setAnchorFirstId(undefined);
  }, [address]);

  // On address change after initial mount, set page to remembered index for that address,
  // or reset to page 1 (index 0) if first time seeing this address.
  // Use layout effect to avoid a paint with the old page index.
  useLayoutEffect(() => {
    if (prevAddressRef.current === address) return; // skip on initial mount
    const remembered = addressPageMemory.get(address);
    const nextIdx = Number.isFinite(remembered as any) && (remembered as number) >= 0
      ? Math.floor(remembered as number)
      : 0;
    setPagination(p => ({ ...p, pageIndex: nextIdx }));
  }, [address]);
  // Initialize anchor to current first id once data is available
  useEffect(() => {
    if (!anchorFirstId && initialTransactions && initialTransactions.length > 0) {
      const id = initialTransactions[0]!.id;
      dbg('anchor: init to current first id', { id });
      setAnchorFirstId(id);
    }
  }, [anchorFirstId, initialTransactions]);
  // If anchor is no longer found (e.g., cache reset), re-anchor to current first
  useEffect(() => {
    if (!initialTransactions || initialTransactions.length === 0) return;
    if (!anchorFirstId) return;
    const missing = initialTransactions.findIndex(t => t.id === anchorFirstId) === -1;
    if (!missing) return;
    if (pagination.pageIndex === 0) {
      const id = initialTransactions[0]!.id;
      dbg('anchor: not found on page 1, re-anchor to current first', { prev: anchorFirstId, next: id });
      setAnchorFirstId(id);
    } else {
      dbg('anchor: not found on deep page, keep previous anchor (stability)');
    }
  }, [initialTransactions, anchorFirstId, pagination.pageIndex]);
  // Track index of anchor and freeze newItemsCount on deep pages if anchor disappears
  const anchorIndex = useMemo(() => {
    if (!initialTransactions || initialTransactions.length === 0) return -1;
    if (!anchorFirstId) return -1;
    return initialTransactions.findIndex(t => t.id === anchorFirstId);
  }, [initialTransactions, anchorFirstId]);
  const lastKnownNewItemsCountRef = useRef(0);
  useEffect(() => {
    if (anchorIndex >= 0) {
      lastKnownNewItemsCountRef.current = anchorIndex;
    }
  }, [anchorIndex]);
  // Number of new items prepended since anchor was set
  const newItemsCount = useMemo(() => {
    if (!anchorFirstId) return 0;
    if (anchorIndex >= 0) return anchorIndex;
    // Anchor missing: keep previous offset on deep pages, reset on page 1
    return pagination.pageIndex > 0 ? lastKnownNewItemsCountRef.current : 0;
  }, [anchorFirstId, anchorIndex, pagination.pageIndex]);

  // Log when newItemsCount changes
  useEffect(() => {
    if (!DEBUG_TX_PAGINATION) return;
    const firstId = initialTransactions && initialTransactions[0] ? initialTransactions[0].id : undefined;
    dbg('newItemsCount updated', { newItemsCount, anchorFirstId, firstId });
  }, [newItemsCount, anchorFirstId, initialTransactions]);
  const showNewItems = useCallback((anchorId?: string) => {
    if (anchorId) {
      setAnchorFirstId(anchorId);
      return;
    }
    // Fallback: if we don't know the newest id yet, try to use current first id; otherwise clear.
    if (initialTransactions && initialTransactions.length > 0) {
      setAnchorFirstId(initialTransactions[0]!.id);
    } else {
      setAnchorFirstId(undefined);
    }
  }, [initialTransactions]);

  // If user is on page 1, always reveal newly prepended items by re-anchoring
  // to the current first id. This avoids a "blink with no change" on the first
  // subscription tick (when the detector is primed and no onNewTransfer fires).
  useEffect(() => {
    if (pagination.pageIndex !== 0) return; // only auto-reveal on page 1
    if (newItemsCount <= 0) return; // nothing new to reveal
    if (!initialTransactions || initialTransactions.length === 0) return;
    const id = initialTransactions[0]!.id;
    dbg('anchor: auto re-anchor on page 1 to reveal new items', { id, newItemsCount });
    setAnchorFirstId(id);
  }, [pagination.pageIndex, newItemsCount, initialTransactions]);

  // Allow temporarily inflating pageCount to avoid TanStack setPageIndex clamping
  const [pageCountOverride, setPageCountOverride] = useState<number>(0);

  // Reset any temporary overrides when address changes
  useEffect(() => {
    setPageCountOverride(0);
  }, [address]);

  // Fast offset-window mode: after threshold pages, fetch page window via offset/limit
  const fastModeActive = useMemo(() => {
    return !!PAGINATION_CONFIG.ENABLE_FAST_OFFSET_MODE && (pagination.pageIndex >= PAGINATION_CONFIG.FAST_OFFSET_MODE_THRESHOLD_PAGES);
  }, [pagination.pageIndex]);

  const [fastPageData, setFastPageData] = useState<UiTransfer[] | null>(null);
  const [isFastLoading, setIsFastLoading] = useState<boolean>(false);
  const fastSeqRef = useRef(0);

  useEffect(() => {
    // Clear fast data when leaving fast mode or when address changes
    if (!fastModeActive) {
      setFastPageData(null);
      setIsFastLoading(false);
      return;
    }

    // If address just changed, clear stale fast data and skip this cycle
    if (prevAddressRef.current !== address) {
      setFastPageData(null);
      setIsFastLoading(false);
      return;
    }

    let cancelled = false;
    const seq = ++fastSeqRef.current;
    const { pageIndex, pageSize } = pagination;
    const offset = Math.max(0, (newItemsCount || 0) + pageIndex * pageSize);
    setIsFastLoading(true);
    fetchWindow(offset, pageSize, { fetchFees: false })
      .then((data) => {
        if (cancelled) return;
        if (seq !== fastSeqRef.current) return;
        setFastPageData(data);
      })
      .catch(() => {
        // keep previous data if any; UI will show whatever is available
      })
      .finally(() => {
        if (cancelled) return;
        if (seq !== fastSeqRef.current) return;
        setIsFastLoading(false);
      });

    return () => { cancelled = true; };
  }, [fastModeActive, pagination.pageIndex, pagination.pageSize, newItemsCount, fetchWindow, address]);

  // After effects ran, record current address to detect changes on next commit
  useEffect(() => {
    prevAddressRef.current = address;
  }, [address]);

  // Persist current page index for this address so switching back restores it
  useEffect(() => {
    if (!address) return;
    addressPageMemory.set(address, pagination.pageIndex);
  }, [address, pagination.pageIndex]);

  const hasExactTotal = useMemo(() => typeof totalCount === 'number' && Number.isFinite(totalCount), [totalCount]);
  const pageCount = useMemo(() => {
    // Prefer exact total if available; adjust for virtual anchor shift
    const size = pagination.pageSize;
    const effectiveTotal = hasExactTotal
      ? Math.max(0, (totalCount as number) - (newItemsCount || 0))
      : undefined;

    if (hasExactTotal) {
      const computed = Math.ceil((effectiveTotal ?? 0) / size);
      // Never report less than the current page (prevents transient shrink)
      return Math.max(computed, pagination.pageIndex + 1);
    }

    // Fallback heuristic based on loaded items and hasNextPage
    const itemsLoaded = (initialTransactions || []).length;
    const pagesLoaded = itemsLoaded > 0 ? Math.ceil(itemsLoaded / size) : 0;
    const computed = hasNextPage ? pagesLoaded + 1 : pagesLoaded;

    // Ensure UI supports deep manual jumps while total is unknown: include phantom next page
    const minForCurrent = pagination.pageIndex + 1;
    const minForNext = hasNextPage ? pagination.pageIndex + 2 : minForCurrent;
    const withOverride = Math.max(computed, minForNext, pageCountOverride || 0);
    return withOverride;
  }, [hasExactTotal, totalCount, newItemsCount, initialTransactions, pagination.pageSize, hasNextPage, pagination.pageIndex, pageCountOverride]);

  const dataForCurrentPage = useMemo(() => {
    if (fastModeActive && fastPageData) {
      return fastPageData;
    }
    const { pageIndex, pageSize } = pagination;
    const start = newItemsCount + pageIndex * pageSize;
    const end = start + pageSize;
    return (initialTransactions || []).slice(start, end);
  }, [pagination, initialTransactions, newItemsCount, fastModeActive, fastPageData]);

  // Trace current page window indices and ids
  useEffect(() => {
    if (!DEBUG_TX_PAGINATION) return;
    const { pageIndex, pageSize } = pagination;
    const start = newItemsCount + pageIndex * pageSize;
    const end = start + pageSize;
    const items = (initialTransactions || []).slice(start, end);
    const first = items[0]?.id;
    const last = items[items.length - 1]?.id;
    dbg('page window', {
      pageIndex,
      pageSize,
      newItemsCount,
      start,
      end,
      totalLoaded: (initialTransactions || []).length,
      count: items.length,
      first,
      last,
    });
  }, [pagination.pageIndex, pagination.pageSize, newItemsCount, initialTransactions]);

  // Debug-only: detect duplicate ids in the full source list
  useEffect(() => {
    if (!DEBUG_TX_PAGINATION) return;
    const list = (initialTransactions || []);
    if (list.length === 0) return;
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const t of list) {
      const id = t?.id;
      if (!id) continue;
      if (seen.has(id)) dups.push(id);
      else seen.add(id);
    }
    if (dups.length > 0) {
      const uniq = Array.from(new Set(dups));
      dbg('duplicates detected in source transfers', { total: list.length, duplicateCount: dups.length, examples: uniq.slice(0, 20) });
    }
  }, [initialTransactions]);

  // Debug-only: detect duplicates within the current page slice
  useEffect(() => {
    if (!DEBUG_TX_PAGINATION) return;
    const ids = (dataForCurrentPage || []).map(t => t.id);
    const seen = new Set<string>();
    let dup: string | undefined;
    for (const id of ids) {
      if (seen.has(id)) { dup = id; break; }
      seen.add(id);
    }
    if (dup) {
      dbg('duplicate id within current page window', { pageIndex: pagination.pageIndex, dup, ids });
    }
  }, [dataForCurrentPage, pagination.pageIndex]);

  // Derive per-page loading progress (0..1) for UI deep jumps
  const { isPageLoading, pageLoadProgress } = useMemo(() => {
    if (fastModeActive) {
      return { isPageLoading: isFastLoading, pageLoadProgress: isFastLoading ? 0 : 1 };
    }
    const { pageIndex, pageSize } = pagination;
    const itemsLoaded = (initialTransactions || []).length;
    // base query still pending
    if (itemsLoaded === 0) return { isPageLoading: true, pageLoadProgress: 0 };

    const desiredStart = newItemsCount + pageIndex * pageSize;
    const desiredEnd = desiredStart + pageSize;

    // Jumped beyond the end and there is no more data at all
    if (!hasNextPage && itemsLoaded <= desiredStart) {
      return { isPageLoading: false, pageLoadProgress: 0 };
    }

    // If there is no next page (we are at the tail), treat whatever is in the window as final
    if (!hasNextPage) {
      const currentCount = dataForCurrentPage.length;
      const p = Math.max(0, Math.min(1, currentCount / pageSize));
      return { isPageLoading: false, pageLoadProgress: p };
    }

    // When there are more pages, reflect progress toward a ladder window (e.g., 3 UI pages),
    // even while earlier pages are being fetched.
    const loadedFromBaseline = Math.max(0, itemsLoaded - newItemsCount);
    const ladderPages = Math.max(1, PAGINATION_CONFIG.NON_FAST_LADDER_UI_PAGES || 1);
    const requiredToTargetEnd = Math.max(1, (pageIndex + ladderPages) * pageSize);
    const pipelineProgress = Math.max(0, Math.min(1, loadedFromBaseline / requiredToTargetEnd));

    const fullyLoaded = itemsLoaded >= desiredEnd;
    return { isPageLoading: !fullyLoaded, pageLoadProgress: fullyLoaded ? 1 : pipelineProgress };
  }, [pagination, initialTransactions, hasNextPage, newItemsCount, dataForCurrentPage.length, fastModeActive, isFastLoading]);

  const table = useReactTable({
    data: dataForCurrentPage,
    columns: transactionColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount,
    autoResetPageIndex: false,
    state: { pagination },
    onPaginationChange: setPagination,
  });

  // Guards and state for sequential ensureLoaded and prefetch
  const inFlightEnsureRef = useRef(false);
  const ensureSeqRef = useRef(0);
  const prefetchIdleIdRef = useRef<number | undefined>(undefined);
  const prefetchTimerRef = useRef<number | undefined>(undefined);
  const lastPrefetchedAtCountRef = useRef<number | undefined>(undefined);
  const lastPrefetchedAtPageRef = useRef<number | undefined>(undefined);
  const prevPageIndexRef = useRef<number>(pagination.pageIndex);

  // Ensure enough items are loaded for the current page; supports deep page jumps.
  useEffect(() => {
    if (fastModeActive) return; // skip sequential ensure loop in fast mode
    let cancelled = false;
    const seq = (ensureSeqRef.current = (ensureSeqRef.current ?? 0) + 1);

    async function run() {
      // Avoid overlapping runs
      if (inFlightEnsureRef.current) return;

      const { pageIndex, pageSize } = pagination;
      const ladderPages = Math.max(1, PAGINATION_CONFIG.NON_FAST_LADDER_UI_PAGES || 1);
      const requiredCount = newItemsCount + (pageIndex + ladderPages) * pageSize;
      let attempts = 0;
      dbg('ensureLoaded: start', {
        pageIndex,
        pageSize,
        requiredCount,
        newItemsCount,
        itemsLoaded: (initialTransactions || []).length,
        hasNextPage,
      });

      // Loop while we need more items and we can fetch more
      while (!cancelled) {
        const itemsLoaded = (initialTransactions || []).length;
        if (itemsLoaded === 0) { dbg('ensureLoaded: base query not ready'); break; }
        if (itemsLoaded >= requiredCount) break;
        if (!hasNextPage) break;
        if (attempts >= PAGINATION_CONFIG.MAX_SEQUENTIAL_FETCH_PAGES) break;

        inFlightEnsureRef.current = true;
        try {
          dbg('ensureLoaded: fetchMore', { attempt: attempts + 1, itemsLoaded, requiredCount });
          await fetchMore();
        } catch {
          break; // surface errors via error state; stop loop
        } finally {
          inFlightEnsureRef.current = false;
        }
        attempts++;

        // If deps changed, abandon this run to avoid racing
        if (seq !== ensureSeqRef.current) break;
      }

      dbg('ensureLoaded: end', { attempts });
    }

    run();

    return () => {
      cancelled = true;
      // bump seq to signal abandonment to any in-flight run
      ensureSeqRef.current = (ensureSeqRef.current ?? 0) + 1;
    };
  }, [pagination.pageIndex, pagination.pageSize, initialTransactions, hasNextPage, fetchMore, newItemsCount, fastModeActive]);

  // Idle prefetch next API page (when current page is fully loaded), pause on hidden tab
  useEffect(() => {
    if (fastModeActive) return; // no idle prefetch in fast mode (single request per page)
    if (typeof document === 'undefined') return;
    if (document.hidden) return; // do not prefetch when hidden
    if (pagination.pageIndex === 0) return; // no idle prefetch on first page

    const itemsLoaded = (initialTransactions || []).length;
    const ladderPages = Math.max(1, PAGINATION_CONFIG.NON_FAST_LADDER_UI_PAGES || 1);
    const requiredCount = newItemsCount + (pagination.pageIndex + ladderPages) * pagination.pageSize;

    // Preconditions: have items, current page fully loaded, can fetch more, and not in ensure loop
    if (itemsLoaded === 0) return;
    if (itemsLoaded < requiredCount) return;
    if (!hasNextPage) return;
    if (inFlightEnsureRef.current) return;
    if (lastPrefetchedAtCountRef.current === itemsLoaded) return; // already prefetched for this size
    if (lastPrefetchedAtPageRef.current === pagination.pageIndex) return; // only once per current page

    // Only prefetch when navigating forward (Next or deeper jump), not on Previous
    const prevIndex = prevPageIndexRef.current ?? 0;
    const isForwardNav = pagination.pageIndex >= prevIndex;
    if (!isForwardNav) return;

    const winAny = window as any;
    const schedule = () => {
      if (document.hidden) return;
      lastPrefetchedAtCountRef.current = itemsLoaded;
      lastPrefetchedAtPageRef.current = pagination.pageIndex;
      // Fire and forget
      dbg('prefetch: scheduling next API page', { forPageIndex: pagination.pageIndex, itemsLoaded });
      fetchMore().catch(() => {});
    };

    if (typeof winAny.requestIdleCallback === 'function') {
      prefetchIdleIdRef.current = winAny.requestIdleCallback(schedule, { timeout: 1000 });
    } else {
      prefetchTimerRef.current = window.setTimeout(schedule, 300);
    }

    const onVisibility = () => {
      if (!document.hidden) return;
      if (prefetchIdleIdRef.current && typeof winAny.cancelIdleCallback === 'function') {
        winAny.cancelIdleCallback(prefetchIdleIdRef.current);
        prefetchIdleIdRef.current = undefined;
      }
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = undefined;
      }
      dbg('prefetch: cancelled due to tab hidden');
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (prefetchIdleIdRef.current && typeof winAny.cancelIdleCallback === 'function') {
        winAny.cancelIdleCallback(prefetchIdleIdRef.current);
        prefetchIdleIdRef.current = undefined;
      }
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = undefined;
      }
    };
  }, [initialTransactions, hasNextPage, pagination.pageIndex, pagination.pageSize, fetchMore, newItemsCount, fastModeActive]);

  // Track last page index to detect forward/backward navigation for prefetch guard
  useEffect(() => {
    prevPageIndexRef.current = pagination.pageIndex;
  }, [pagination.pageIndex]);

  // Sync page index into URL; when on first page, remove the query to avoid sticky deep links
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      if (pagination.pageIndex > 0) {
        params.set('page', String(pagination.pageIndex));
      } else {
        params.delete('page');
        params.delete('p');
        params.delete('pageIndex');
      }
      const search = params.toString();
      const newUrl = `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
      window.history.replaceState({}, '', newUrl);
    } catch {
      // no-op in non-browser environments
    }
  }, [pagination.pageIndex]);

  // Clear override once real computed count has caught up
  useEffect(() => {
    // If exact total is known, override is unnecessary — clear it
    if (typeof totalCount === 'number' && Number.isFinite(totalCount)) {
      if (pageCountOverride) setPageCountOverride(0);
      return;
    }
    // Otherwise, clear once heuristic catches up
    const itemsLoaded = (initialTransactions || []).length;
    const pagesLoaded = itemsLoaded > 0 ? Math.ceil(itemsLoaded / pagination.pageSize) : 0;
    const computed = hasNextPage ? pagesLoaded + 1 : pagesLoaded;
    if (pageCountOverride && computed >= pageCountOverride) {
      setPageCountOverride(0);
    }
  }, [initialTransactions, pagination.pageSize, hasNextPage, pageCountOverride, totalCount]);

  const goToPage = useCallback((idx: number) => {
    const rawTarget = Math.max(0, Math.floor(idx));
    // If we know the exact last page, clamp to it (adjusted for anchor)
    let clamped = rawTarget;
    if (typeof totalCount === 'number' && Number.isFinite(totalCount)) {
      const size = pagination.pageSize;
      const effectiveTotal = Math.max(0, totalCount - (newItemsCount || 0));
      const lastIndex = Math.max(0, Math.ceil(effectiveTotal / size) - 1);
      clamped = Math.min(rawTarget, lastIndex);
    }

    // Inflate override so TanStack won't clamp the next render when total is unknown
    const minForCurrent = clamped + 1;
    const minForNext = hasNextPage ? clamped + 2 : minForCurrent;
    setPageCountOverride(prev => Math.max(prev || 0, minForNext));
    // Directly set pagination to bypass table's clamping
    setPagination(p => ({ ...p, pageIndex: clamped }));
  }, [hasNextPage, totalCount, pagination.pageSize, newItemsCount]);

  return {
    table,
    isLoading,
    error,
    newItemsCount,
    showNewItems,
    goToPage,
    isPageLoading,
    pageLoadProgress,
    hasExactTotal,
    fastModeActive,
  };
}
