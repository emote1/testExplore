import { isValidEvmAddressFormat } from '@/utils/address-helpers';
import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Table,
  PaginationState,
  SortingState,
} from '@tanstack/react-table';
import { useTransactionDataWithBlocks } from './use-transaction-data-with-blocks';
import { useSwapEvents } from './use-swap-events';
import { transactionColumns } from '../components/transaction-columns';
import { type UiTransfer } from '../data/transfer-mapper';
import { PAGINATION_CONFIG } from '../constants/pagination';
import { ApolloError, useApolloClient, type ApolloClient, type NormalizedCacheObject } from '@apollo/client';
import { useTokenUsdPrices, type TokenInput } from '@/hooks/use-token-usd-prices';
import { useReefPrice } from '@/hooks/use-reef-price';
import { USDC_ID_SET, USDC_SESSION_SET, MRD_ID_SET, MRD_SESSION_SET, isUsdcId, isMrdId } from '@/tokens/token-ids';
import { isReefToken } from '@/utils/token-helpers';
import { useEnsureLoaded } from './use-ensure-loaded';
import { usePageCount } from './use-page-count';
import { useFastWindow } from './use-fast-window';
import { useAnchor } from './use-anchor';
import { useTokenBootstrap } from './use-token-bootstrap';
import { useTransactionFilter } from './use-transaction-filter';
import { useTransactionFilterStore } from '../stores/use-transaction-filter-store';

const addressPageMemory = new Map<string, number>();

// Debug flag to trace pagination math; enable only with VITE_TX_PAGINATION_DEBUG=1|true
const DEBUG_TX_PAGINATION = (import.meta.env.VITE_TX_PAGINATION_DEBUG === '1'
  || import.meta.env.VITE_TX_PAGINATION_DEBUG === 'true');

function dbg(...args: unknown[]) {
  if (!DEBUG_TX_PAGINATION) return;
  console.debug('[TxPagination]', ...args);
}

export interface TanstackTransactionAdapterReturn {
  table: Table<UiTransfer>;
  isLoading: boolean;
  error?: ApolloError | Error;
  totalCount?: number;
  loadedCount: number;
  loadedCountsByType: { incoming: number; outgoing: number; swap: number };
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
  /** Which of the known tokens are present in the loaded dataset */
  availableTokens: { reef: boolean; usdc: boolean; mrd: boolean };
}

/**
 * Adapts transaction data for TanStack Table using Zustand filter store.
 * Calculated raw values are passed from the component to avoid redundant parsing logic.
 */
export function useTanstackTransactionAdapter(
  address: string,
  appliedMinRaw: string | null,
  appliedMaxRaw: string | null,
  appliedTokenMinRaw: string | null,
  appliedTokenMaxRaw: string | null,
  strictServerTokenFilter: boolean = false,
  isActive: boolean = true,
): TanstackTransactionAdapterReturn {
  const direction = useTransactionFilterStore(state => state.direction);
  const tokenFilter = useTransactionFilterStore(state => state.tokenFilter);
  const txType = useTransactionFilterStore(state => state.txType);

  const swapOnly = txType === 'swap';
  const apollo = useApolloClient();

  // Enforce strict server token filter by default for USDC/MRD and custom 0x tokens
  const enforceStrict = (tokenFilter === 'usdc' || tokenFilter === 'mrd' || isValidEvmAddressFormat(tokenFilter));
  const effectiveStrict = enforceStrict || strictServerTokenFilter;

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
  const [sorting, setSorting] = useState<SortingState>([]);
  // Track address changes
  const prevAddressRef = useRef(address);
  // Strict server token ids (exact-cased), computed after we have observed data or from input address
  const [serverTokenIds, setServerTokenIds] = useState<string[] | null>(() => {
    if (!effectiveStrict) return null;
    if (tokenFilter === 'usdc') return Array.from(new Set<string>([...USDC_ID_SET, ...USDC_SESSION_SET]));
    if (tokenFilter === 'mrd') return Array.from(new Set<string>([...MRD_ID_SET, ...MRD_SESSION_SET]));
    if (isValidEvmAddressFormat(tokenFilter)) return [tokenFilter];
    return null;
  });
  const [usdcBootstrapDone, setUsdcBootstrapDone] = useState<boolean>(false);
  // Soft fallback: if strict server token filter yields empty page for USDC,
  // temporarily disable server token ids and filter on client to discover ids,
  // then return to strict once ids are known.
  const [softFallbackActive, setSoftFallbackActive] = useState<boolean>(false);
  const [softFallbackAttempted, setSoftFallbackAttempted] = useState<boolean>(false);

  // Use effective server token ids (null when soft fallback is active)
  const effectiveServerTokenIds = softFallbackActive ? null : serverTokenIds;

  // Compute dynamic API page size: when strict token ids are applied and direction is not 'any', use smaller page size
  const apiPageSize = useMemo((): number => {
    let n: number = PAGINATION_CONFIG.API_FETCH_PAGE_SIZE as unknown as number;
    // Swap mode: use smaller pages to reduce payload per request
    if (swapOnly) n = Math.min(n, 20);
    // Token-filtered Swap: align server page size to UI page size to avoid over-fetch
    if (swapOnly && tokenFilter !== 'all') n = Math.min(n, pagination.pageSize);
    if (effectiveServerTokenIds && direction !== 'any') n = Math.min(n, 30);
    return n;
  }, [effectiveServerTokenIds, direction, swapOnly, tokenFilter, pagination.pageSize]);

  // When in soft fallback mode for a specific token, narrow to ERC20 only
  const erc20Only = useMemo(() => {
    return softFallbackActive && (tokenFilter === 'usdc' || tokenFilter === 'mrd' || isValidEvmAddressFormat(tokenFilter));
  }, [softFallbackActive, tokenFilter]);

  // When swapOnly is true, use reef-swap path instead of transfers
  // Disable swap events fetching when not on Swap tab to avoid extra network traffic
  const swapAdapter = useSwapEvents((swapOnly && isActive) ? address : null, apiPageSize, swapOnly && isActive);
  const baseAdapter = useTransactionDataWithBlocks(
    (swapOnly ? null : address),
    apiPageSize,
    direction,
    appliedMinRaw,
    appliedMaxRaw,
    tokenFilter === 'reef',
    effectiveServerTokenIds,
    (effectiveServerTokenIds ? (appliedTokenMinRaw ?? null) : null),
    (effectiveServerTokenIds ? (appliedTokenMaxRaw ?? null) : null),
    erc20Only,
    swapOnly,
    isActive,
  );

  const initialTransactions = useMemo(() => (swapOnly ? (swapAdapter.items || []) : (baseAdapter.transfers || [])), [swapOnly, swapAdapter.items, baseAdapter.transfers]);
  const isLoading = swapOnly ? swapAdapter.loading : baseAdapter.loading;
  const error = swapOnly ? (swapAdapter.error as ApolloError | Error | undefined) : baseAdapter.error;
  const fetchMore = swapOnly ? swapAdapter.fetchMore : baseAdapter.fetchMore;
  const hasNextPage = swapOnly ? swapAdapter.hasMore : baseAdapter.hasMore;
  const totalCount = swapOnly ? swapAdapter.totalCount : baseAdapter.totalCount;
  const fetchWindow = baseAdapter.fetchWindow;

  useTokenBootstrap({
    effectiveStrict,
    tokenFilter,
    enforceStrict,
    isLoading,
    initialTransactions,
    serverTokenIds,
    setServerTokenIds,
    softFallbackActive,
    setSoftFallbackActive,
    softFallbackAttempted,
    setSoftFallbackAttempted,
    apollo: apollo as ApolloClient<NormalizedCacheObject>,
    usdcBootstrapDone,
    setUsdcBootstrapDone,
    dbg,
  });

  const filteredTransactions = useTransactionFilter({
    initialTransactions,
    tokenFilter,
    tokenMinRaw: appliedTokenMinRaw,
    tokenMaxRaw: appliedTokenMaxRaw,
    softFallbackActive,
    serverTokenIds,
    swapOnly,
  });

  const loadedCount = useMemo(() => (filteredTransactions || []).length, [filteredTransactions]);

  const loadedCountsByType = useMemo(() => {
    const acc = { incoming: 0, outgoing: 0, swap: 0 };
    const list = filteredTransactions || [];
    for (const t of list) {
      const tx = t as UiTransfer;
      if (tx.method === 'swap' || tx.type === 'SWAP') {
        acc.swap += 1;
        continue;
      }
      const ty = String(tx.type || '').toUpperCase();
      if (ty === 'INCOMING') acc.incoming += 1;
      else if (ty === 'OUTGOING') acc.outgoing += 1;
    }
    return acc;
  }, [filteredTransactions]);

  // Expose presence of specific tokens in the currently loaded dataset for dynamic UI options
  const availableTokens = useMemo(() => {
    const list = initialTransactions || [];
    if (list.length === 0) return { reef: false, usdc: false, mrd: false };

    let reef = false, usdc = false, mrd = false;
    for (const t of list) {
      const tx = t as UiTransfer;
      // direct token
      if (!reef) reef = isReefToken(tx.token);
      if (!usdc) usdc = isUsdcId(tx.token?.id);
      if (!mrd) mrd = isMrdId(tx.token?.id);
      // swap legs
      if (tx.swapInfo) {
        const s = tx.swapInfo.sold?.token;
        const b = tx.swapInfo.bought?.token;
        if (!reef) reef = isReefToken(s) || isReefToken(b);
        if (!usdc) usdc = isUsdcId(s?.id) || isUsdcId(b?.id);
        if (!mrd) mrd = isMrdId(s?.id) || isMrdId(b?.id);
      }
      if (reef && usdc && mrd) break;
    }
    return { reef, usdc, mrd };
  }, [initialTransactions]);

  // Apollo cache is the single source of truth; pages are merged by typePolicies

  // Reset page on filter/view change (direction, token filter, swap view)
  useEffect(() => {
    // reset page on filter change to keep behavior
    setPagination(p => ({ ...p, pageIndex: 0 }));
  }, [direction, appliedMinRaw, appliedMaxRaw, tokenFilter, swapOnly]);

  // Disable client sorting entirely; server provides ordering when needed
  useEffect(() => {
    setSorting([]);
  }, [appliedMinRaw, appliedMaxRaw, tokenFilter]);

  // On address change after initial mount, set page to remembered index for that address,
  // or reset to page 1 (index 0) if first time seeing this address.
  // Use layout effect to avoid a paint with the old page index.
  useLayoutEffect(() => {
    if (prevAddressRef.current === address) return; // skip on initial mount
    const remembered = addressPageMemory.get(address);
    const nextIdx = (typeof remembered === 'number' && Number.isFinite(remembered) && remembered >= 0)
      ? Math.floor(remembered)
      : 0;
    setPagination(p => ({ ...p, pageIndex: nextIdx }));
  }, [address]);

  const { newItemsCount, showNewItems } = useAnchor({
    address,
    direction,
    minReefRaw: appliedMinRaw,
    maxReefRaw: appliedMaxRaw,
    tokenFilter,
    initialTransactions,
    pageIndex: pagination.pageIndex,
    dbg,
  });

  // Allow temporarily inflating pageCount to avoid TanStack setPageIndex clamping
  const [pageCountOverride, setPageCountOverride] = useState<number>(0);

  // Reset any temporary overrides when address changes
  useEffect(() => {
    setPageCountOverride(0);
  }, [address]);

  // Fast offset-window mode (extracted)
  const { fastModeActive, fastPageData, isFastLoading } = useFastWindow({
    tokenFilter,
    swapOnly,
    pagination,
    fetchWindow,
    newItemsCount,
    address,
  });

  // After effects ran, record current address to detect changes on next commit
  useEffect(() => {
    prevAddressRef.current = address;
  }, [address]);

  // Persist current page index for this address so switching back restores it
  useEffect(() => {
    if (!address) return;
    addressPageMemory.set(address, pagination.pageIndex);
  }, [address, pagination.pageIndex]);

  const { hasExactTotal, pageCount } = usePageCount({
    pagination,
    tokenFilter,
    swapOnly,
    totalCount,
    newItemsCount,
    initialTransactions,
    filteredTransactions,
    hasNextPage,
    pageCountOverride,
    strictServerActive: (!swapOnly && tokenFilter !== 'all' && Array.isArray(effectiveServerTokenIds) && effectiveServerTokenIds.length > 0),
  });

  const dataForCurrentPage = useMemo(() => {
    if (fastModeActive && fastPageData) {
      return fastPageData;
    }
    const { pageIndex, pageSize } = pagination;
    // Non-swap views are filtered if tokenFilter != 'all' or Swap tab is active
    const isFiltered = (tokenFilter !== 'all') || swapOnly;
    const start = (isFiltered ? 0 : newItemsCount) + pageIndex * pageSize;
    const end = start + pageSize;
    return (filteredTransactions || []).slice(start, end);
  }, [pagination, filteredTransactions, tokenFilter, swapOnly, newItemsCount, fastModeActive, fastPageData]);

  // Derive token set for pricing on the current page and fetch USD prices
  const tokensForPrices = useMemo(() => {
    const out: TokenInput[] = [];
    const seen = new Set<string>();
    const pushTok = (tok?: { id?: string; decimals?: number; name?: string } | null) => {
      if (!tok) return;
      const id = (tok.id || '').toLowerCase();
      if (!id) return;
      const decimals = typeof tok.decimals === 'number' ? tok.decimals : 18;
      if (decimals === 0) return; // NFTs
      if ((tok.name === 'REEF') && decimals === 18) return; // REEF priced separately
      if (seen.has(id)) return;
      seen.add(id);
      out.push({ id, decimals });
    };
    for (const t of (dataForCurrentPage || [])) {
      const tx = t as UiTransfer;
      pushTok(tx.token);
      if (tx.swapInfo) {
        pushTok(tx.swapInfo.sold?.token);
        pushTok(tx.swapInfo.bought?.token);
      }
    }
    return out;
  }, [dataForCurrentPage]);
  const { pricesById } = useTokenUsdPrices(tokensForPrices);
  const { price: reefPrice } = useReefPrice();
  const reefUsd = reefPrice?.usd ?? undefined;

  // Trace current page window indices and ids
  useEffect(() => {
    if (!DEBUG_TX_PAGINATION) return;
    const { pageIndex, pageSize } = pagination;
    const isFiltered = tokenFilter !== 'all' || swapOnly;
    const start = (isFiltered ? 0 : newItemsCount) + pageIndex * pageSize;
    const end = start + pageSize;
    const items = (filteredTransactions || []).slice(start, end);
    const first = items[0]?.id;
    const last = items[items.length - 1]?.id;
    dbg('page window', {
      pageIndex,
      pageSize,
      newItemsCount,
      start,
      end,
      totalLoaded: (filteredTransactions || []).length,
      count: items.length,
      first,
      last,
    });
  }, [pagination, newItemsCount, filteredTransactions, tokenFilter, swapOnly]);

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

  // Guards used by isPageLoading/ensureLoaded
  const inFlightEnsureRef = useRef(false);
  const ensureSeqRef = useRef(0);
  const ensureMaxedRef = useRef(false);

  // Derive per-page loading progress (0..1) for UI deep jumps
  const { isPageLoading, pageLoadProgress } = useMemo(() => {
    if (fastModeActive) {
      return { isPageLoading: isFastLoading, pageLoadProgress: isFastLoading ? 0 : 1 };
    }
    const { pageIndex, pageSize } = pagination;
    const isFiltered = (tokenFilter !== 'all') || swapOnly;
    const itemsLoaded = swapOnly
      ? (initialTransactions || []).length
      : (isFiltered ? (filteredTransactions || []).length : (initialTransactions || []).length);

    // If base query is still loading, show spinner
    if (isLoading) return { isPageLoading: true, pageLoadProgress: 0 };

    // If base query finished and there are no items at all, don't show spinner
    if (itemsLoaded === 0) return { isPageLoading: false, pageLoadProgress: 0 };

    const desiredStart = (isFiltered ? 0 : newItemsCount) + pageIndex * pageSize;
    const desiredEnd = desiredStart + pageSize;

    // Filtered modes (token filter or swapOnly): show gradual progress toward a ladder window like All-mode
    if (isFiltered) {
      // If there's no next page anymore, treat as final and don't show spinner even if the page window isn't full
      if (!hasNextPage) {
        const currentCount = dataForCurrentPage.length;
        const p = Math.max(0, Math.min(1, currentCount / pageSize));
        return { isPageLoading: false, pageLoadProgress: p };
      }
      // If ensureLoaded is not fetching and attempts are exhausted, stop spinner to avoid hanging state
      if (!inFlightEnsureRef.current && ensureMaxedRef.current) {
        const currentCount = dataForCurrentPage.length;
        const p = Math.max(0, Math.min(1, currentCount / pageSize));
        return { isPageLoading: false, pageLoadProgress: p };
      }
      const ladderPages = Math.max(1, PAGINATION_CONFIG.NON_FAST_LADDER_UI_PAGES || 1);
      const requiredToTargetEnd = Math.max(1, (pageIndex + ladderPages) * pageSize);
      const pipelineProgress = Math.max(0, Math.min(1, itemsLoaded / requiredToTargetEnd));
      const fullyLoaded = itemsLoaded >= desiredEnd;
      return { isPageLoading: !fullyLoaded, pageLoadProgress: fullyLoaded ? 1 : pipelineProgress };
    }

    // When there is no next page (All mode but end reached), treat as final
    if (!hasNextPage) {
      if (itemsLoaded <= desiredStart) return { isPageLoading: false, pageLoadProgress: 0 };
      const currentCount = dataForCurrentPage.length;
      const p = Math.max(0, Math.min(1, currentCount / pageSize));
      return { isPageLoading: false, pageLoadProgress: p };
    }

    // When there are more pages (All mode), reflect progress toward a ladder window
    const loadedFromBaseline = Math.max(0, itemsLoaded - newItemsCount);
    const ladderPages = Math.max(1, PAGINATION_CONFIG.NON_FAST_LADDER_UI_PAGES || 1);
    const requiredToTargetEnd = Math.max(1, (pageIndex + ladderPages) * pageSize);
    const pipelineProgress = Math.max(0, Math.min(1, loadedFromBaseline / requiredToTargetEnd));

    const fullyLoaded = itemsLoaded >= desiredEnd;
    return { isPageLoading: !fullyLoaded, pageLoadProgress: fullyLoaded ? 1 : pipelineProgress };
  }, [pagination, initialTransactions, filteredTransactions, tokenFilter, swapOnly, hasNextPage, newItemsCount, dataForCurrentPage.length, fastModeActive, isFastLoading, isLoading]);

  // Auto-clamp to the last available page when there is no next page and current page start is beyond loaded items
  useEffect(() => {
    const isFiltered = tokenFilter !== 'all' || swapOnly;
    if (!isFiltered) return;
    if (hasNextPage) return;
    const itemsLoaded = (filteredTransactions || []).length;
    if (itemsLoaded === 0) return;
    const { pageIndex, pageSize } = pagination;
    const desiredStart = pageIndex * pageSize; // filtered views have no newItemsCount offset
    if (desiredStart < itemsLoaded) return;
    const lastIndex = Math.max(0, Math.ceil(itemsLoaded / pageSize) - 1);
    if (pageIndex > lastIndex) setPagination(p => ({ ...p, pageIndex: lastIndex }));
  }, [pagination, filteredTransactions, hasNextPage, tokenFilter, swapOnly]);

  const table = useReactTable({
    data: dataForCurrentPage,
    columns: transactionColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount,
    autoResetPageIndex: false,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    meta: { pricesById, reefUsd, addTransaction: () => {}, disableTimestampSorting: true, disableAmountSorting: true },
  });

  // Guards and state for sequential ensureLoaded and prefetch
  // (inFlightEnsureRef/ensureSeqRef/ensureMaxedRef are declared above to satisfy early usage)
  const prefetchIdleIdRef = useRef<number | undefined>(undefined);
  const prefetchTimerRef = useRef<number | undefined>(undefined);
  const lastPrefetchedAtCountRef = useRef<number | undefined>(undefined);
  const lastPrefetchedAtPageRef = useRef<number | undefined>(undefined);
  const prevPageIndexRef = useRef<number>(pagination.pageIndex);

  // Ensure enough items are loaded for the current page; supports deep page jumps.
  useEnsureLoaded(
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
    },
    { inFlightEnsureRef, ensureSeqRef, ensureMaxedRef },
  );

  // Idle prefetch next API page (when current page is fully loaded), pause on hidden tab
  useEffect(() => {
    if (fastModeActive) return; // no idle prefetch in fast mode (single request per page)
    if (swapOnly) return; // avoid duplicate prefetch in reef-swap mode
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

    const win = window as Window & {
      requestIdleCallback?: (callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const schedule = () => {
      if (document.hidden) return;
      lastPrefetchedAtCountRef.current = itemsLoaded;
      lastPrefetchedAtPageRef.current = pagination.pageIndex;
      // Fire and forget
      dbg('prefetch: scheduling next API page', { forPageIndex: pagination.pageIndex, itemsLoaded });
      fetchMore().catch(() => {});
    };

    if (typeof win.requestIdleCallback === 'function') {
      prefetchIdleIdRef.current = win.requestIdleCallback(schedule, { timeout: 1000 });
    } else {
      prefetchTimerRef.current = window.setTimeout(schedule, 300);
    }

    const onVisibility = () => {
      if (!document.hidden) return;
      if (prefetchIdleIdRef.current && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(prefetchIdleIdRef.current);
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
      if (prefetchIdleIdRef.current && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(prefetchIdleIdRef.current);
        prefetchIdleIdRef.current = undefined;
      }
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = undefined;
      }
    };
  }, [initialTransactions, hasNextPage, pagination.pageIndex, pagination.pageSize, fetchMore, newItemsCount, fastModeActive, swapOnly]);

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
    // For filtered views (excluding swapOnly) or when exact total is known, override is unnecessary — clear it
    if ((tokenFilter !== 'all' && !swapOnly) || hasExactTotal) {
      if (pageCountOverride) setPageCountOverride(0);
      return;
    }
    // Otherwise, clear once heuristic catches up (All mode)
    const itemsLoaded = (initialTransactions || []).length;
    const pagesLoaded = itemsLoaded > 0 ? Math.ceil(itemsLoaded / pagination.pageSize) : 0;
    const computed = hasNextPage ? pagesLoaded + 1 : pagesLoaded;
    if (pageCountOverride && computed >= pageCountOverride) {
      setPageCountOverride(0);
    }
  }, [tokenFilter, swapOnly, hasExactTotal, initialTransactions, pagination.pageSize, hasNextPage, pageCountOverride]);

  const goToPage = useCallback((idx: number) => {
    const rawTarget = Math.max(0, Math.floor(idx));
    const size = pagination.pageSize;
    const isFilteredMode = (tokenFilter !== 'all') || swapOnly;

    // Prevent rapid forward nav while ensureLoaded is fetching for filtered/swap views
    if (isFilteredMode && inFlightEnsureRef.current && rawTarget > pagination.pageIndex) {
      dbg('goToPage: forward nav ignored during in-flight ensureLoaded', { rawTarget });
      return;
    }

    // If we know exact total, clamp strictly
    if (typeof totalCount === 'number' && Number.isFinite(totalCount)) {
      const effectiveTotal = Math.max(0, totalCount - (newItemsCount || 0));
      const lastIndex = Math.max(0, Math.ceil(effectiveTotal / size) - 1);
      let clamped = Math.min(rawTarget, lastIndex);
      if (tokenFilter === 'all' && !hasNextPage) {
        const aggTotal = Math.max(0, (initialTransactions || []).length - (newItemsCount || 0));
        const lastIndexAgg = Math.max(0, Math.ceil(aggTotal / size) - 1);
        clamped = Math.min(clamped, lastIndexAgg);
      }
      setPageCountOverride(0);
      setPagination(p => ({ ...p, pageIndex: clamped }));
      return;
    }

    // When total unknown: if in filtered/swap view and there is no next page, clamp to last existing page
    if (isFilteredMode && !hasNextPage) {
      const itemsLoaded = (filteredTransactions || []).length;
      const lastIndex = Math.max(0, Math.ceil(Math.max(0, itemsLoaded) / size) - 1);
      const clamped = Math.min(rawTarget, lastIndex);
      setPageCountOverride(0);
      setPagination(p => ({ ...p, pageIndex: clamped }));
      return;
    }

    // Otherwise (unknown total and may have next pages), allow deep jump but set a safe override
    const clamped = rawTarget;
    const minForCurrent = clamped + 1;
    const applyOverride = (tokenFilter === 'all') || (swapOnly && tokenFilter === 'all');
    const minForNext = ((applyOverride && hasNextPage) ? clamped + 2 : minForCurrent);
    if (applyOverride) setPageCountOverride(prev => Math.max(prev || 0, minForNext));
    else setPageCountOverride(0);
    setPagination(p => ({ ...p, pageIndex: clamped }));
  }, [hasNextPage, totalCount, pagination.pageSize, newItemsCount, tokenFilter, swapOnly, filteredTransactions, initialTransactions, pagination.pageIndex]);

  return {
    table,
    isLoading,
    error,
    totalCount,
    loadedCount,
    loadedCountsByType,
    newItemsCount,
    showNewItems,
    goToPage,
    isPageLoading,
    pageLoadProgress,
    hasExactTotal,
    fastModeActive,
    availableTokens,
  };
}
