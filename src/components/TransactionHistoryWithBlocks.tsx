import React from 'react';
import { Loader2, AlertTriangle, ArrowDownRight, ArrowUpRight, Activity, Coins, Image } from 'lucide-react';
import { useApolloClient } from '@apollo/client';
import { useTanstackTransactionAdapter } from '@/hooks/useTanstackTransactionAdapter';
import type { UiTransfer } from '../data/transfer-mapper';
import { useTransferSubscription } from '../hooks/useTransferSubscription';
import { buildTransferOrderBy, buildTransferWhereFilter, isHasuraExplorerMode, type TransactionDirection, type TransferWhere } from '../utils/transfer-query';
import { isValidEvmAddressFormat, isValidSubstrateAddressFormat } from '../utils/address-helpers';
import { useAddressResolver } from '../hooks/use-address-resolver';
import { formatAmount } from '../utils/formatters';
import { useSquidHealth } from '@/hooks/use-squid-health';
import { AddressDisplay } from './AddressDisplay';
import { useTokenBalances } from '../hooks/use-token-balances';
import { useNftCountByOwner } from '../hooks/use-nft-count-by-owner';
import { useSwapCountPrefetch } from '../hooks/use-swap-count-prefetch';
import { useStakingCountPrefetch } from '../hooks/use-staking-count-prefetch';
import { Badge } from './ui/badge';
import { TRANSFERS_BULK_COUNTS_QUERY } from '../data/transfers';
import { MRD_ID_SET, MRD_SESSION_SET, USDC_ID_SET, USDC_SESSION_SET } from '../tokens/token-ids';
import type { DocumentNode } from 'graphql';
import { TransactionsFilters } from './TransactionsFilters';
import { useTransactionFilterStore, type TxTypeFilter } from '../stores/use-transaction-filter-store';

const txTypeCountsCache = new Map<
  string,
  {
    counts: { all: number | null; incoming: number | null; outgoing: number | null; swap: number | null; staking: number | null };
    updatedAt: number;
  }
>();

const TransactionTableWithTanStack = React.lazy(() =>
  import('./TransactionTableWithTanStack').then(m => ({ default: m.TransactionTableWithTanStack }))
);

const StakingTable = React.lazy(() =>
  import('./StakingTable').then(m => ({ default: m.StakingTable }))
);

const NftGallery = React.lazy(() =>
  import('./NftGallery').then(m => ({ default: m.NftGallery }))
);

const BalancesTable = React.lazy(() =>
  import('./BalancesTable').then(m => ({ default: m.BalancesTable }))
);

// Top-level TransactionsView so it does not remount on each parent render.
function TransactionsView({
  addr,
  onCountsChange,
  isActive,
}: {
  addr: string;
  onCountsChange?: (counts: {
    totalCount?: number;
    loadedCount: number;
    incoming: number;
    outgoing: number;
    swap: number;
  }) => void;
  isActive: boolean;
}) {
  const apolloClient = useApolloClient();
  const { resolveBoth } = useAddressResolver();
  
  const txType = useTransactionFilterStore(state => state.txType);
  const setTxType = useTransactionFilterStore(state => state.setTxType);
  const direction = useTransactionFilterStore(state => state.direction);
  const setDirection = useTransactionFilterStore(state => state.setDirection);
  const tokenFilter = useTransactionFilterStore(state => state.tokenFilter);
  const setTokenFilter = useTransactionFilterStore(state => state.setTokenFilter);
  const minAmountInput = useTransactionFilterStore(state => state.minAmountInput);
  const setMinAmountInput = useTransactionFilterStore(state => state.setMinAmountInput);
  const maxAmountInput = useTransactionFilterStore(state => state.maxAmountInput);
  const setMaxAmountInput = useTransactionFilterStore(state => state.setMaxAmountInput);
  const customDecimals = useTransactionFilterStore(state => state.customDecimals);
  const setCustomDecimals = useTransactionFilterStore(state => state.setCustomDecimals);

  const customDecimalsRef = React.useRef(customDecimals);
  React.useEffect(() => {
    customDecimalsRef.current = customDecimals;
  }, [customDecimals]);

  const MRD_CONTRACT = '0x95a2AF50040B7256a4B4c405a4AfD4DD573DA115';
  const isAllMode = tokenFilter === 'all';
  const isReefMode = tokenFilter === 'reef';
  const isUsdcMode = tokenFilter === 'usdc';
  const isContractMode = React.useMemo(() => /^0x[0-9a-fA-F]{40}$/.test(tokenFilter), [tokenFilter]);

  const [resolvedAddress, setResolvedAddress] = React.useState<string | null>(null);
  const [resolvedEvmAddress, setResolvedEvmAddress] = React.useState<string | null>(null);
  const [isResolvingCounts, setIsResolvingCounts] = React.useState<boolean>(false);

  // Prefetch swap count in background when not on Swap tab (so count is ready when user clicks Swap)
  const prefetchedSwapCount = useSwapCountPrefetch(addr, isActive && txType !== 'swap');

  // Prefetch staking count in background when not on Staking tab
  const prefetchedStakingCount = useStakingCountPrefetch({
    address: resolvedAddress,
    evmAddress: resolvedEvmAddress,
    enabled: isActive && txType !== 'staking',
  });

  // Debounce the raw input to avoid excessive queries while typing
  const [debouncedMinInput, setDebouncedMinInput] = React.useState<string>(minAmountInput);
  const [debouncedMaxInput, setDebouncedMaxInput] = React.useState<string>(maxAmountInput);

  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedMinInput(minAmountInput), 300);
    return () => window.clearTimeout(id);
  }, [minAmountInput]);

  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedMaxInput(maxAmountInput), 300);
    return () => window.clearTimeout(id);
  }, [maxAmountInput]);

  // Helper: parse decimal string to raw bigint string with given decimals
  function parseToRawDecimal(input: string, decimals: number): string | null {
    const s = (input || '').trim().replace(',', '.');
    if (!s) return null;
    if (!/^\d*(?:\.(\d+)?)?$/.test(s)) return null;
    try {
      const [i, f = ''] = s.split('.');
      const intPart = (i || '0').replace(/^0+/, '') || '0';
      const frac = (f || '').padEnd(decimals, '0').slice(0, decimals);
      const bi = BigInt(intPart || '0') * (10n ** BigInt(decimals)) + BigInt(frac || '0');
      if (bi <= 0n) return '0';
      return bi.toString();
    } catch {
      return null;
    }
  }

  // Decide decimals for the currently selected token
  const selectedTokenDecimals = React.useMemo(() => {
    if (isReefMode) return 18;
    if (isUsdcMode) return 6;
    if (isContractMode) {
      const addrLower = tokenFilter.toLowerCase();
      if (typeof customDecimals === 'number') return customDecimals;
      return addrLower === MRD_CONTRACT ? 18 : 18;
    }
    return 18;
  }, [isReefMode, isUsdcMode, isContractMode, tokenFilter, customDecimals]);

  // Raw values for the selected token
  const minTokenRaw = React.useMemo(() => parseToRawDecimal(debouncedMinInput, selectedTokenDecimals), [debouncedMinInput, selectedTokenDecimals]);
  const maxTokenRaw = React.useMemo(() => parseToRawDecimal(debouncedMaxInput, selectedTokenDecimals), [debouncedMaxInput, selectedTokenDecimals]);

  const isMinInvalid = React.useMemo(() => {
    const raw = (minAmountInput || '').trim();
    if (!raw) return false;
    const s = raw.replace(',', '.');
    return !/^\d*(?:\.(\d+)?)?$/.test(s);
  }, [minAmountInput]);

  const isMaxInvalid = React.useMemo(() => {
    const raw = (maxAmountInput || '').trim();
    if (!raw) return false;
    const s = raw.replace(',', '.');
    return !/^\d*(?:\.(\d+)?)?$/.test(s);
  }, [maxAmountInput]);

  const isRangeInvalid = React.useMemo(() => {
    try {
      if (!minTokenRaw || !maxTokenRaw) return false;
      return BigInt(minTokenRaw) > BigInt(maxTokenRaw);
    } catch { return false; }
  }, [minTokenRaw, maxTokenRaw]);

  const hasActiveAmountFilter = React.useMemo(() => {
    const hasMin = !!minTokenRaw && minTokenRaw !== '0';
    const hasMax = !!maxTokenRaw && maxTokenRaw !== '0';
    return hasMin || hasMax;
  }, [minTokenRaw, maxTokenRaw]);

  // Server-side filters apply only for native REEF
  const reefFiltersActive = isReefMode && !isRangeInvalid;
  const appliedMinRaw = reefFiltersActive ? minTokenRaw : null;
  const appliedMaxRaw = reefFiltersActive ? maxTokenRaw : null;

  // Client-side token filters for adapter (REEF/USDC/MRD/contract)
  const tokenFiltersActive = tokenFilter !== 'all' && !isRangeInvalid;
  const appliedTokenMinRaw = tokenFiltersActive ? minTokenRaw : null;
  const appliedTokenMaxRaw = tokenFiltersActive ? maxTokenRaw : null;

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!addr) {
        setResolvedAddress(null);
        setResolvedEvmAddress(null);
        return;
      }
      setIsResolvingCounts(true);
      try {
        const { nativeId, evmAddress } = await resolveBoth(addr);
        if (!active) return;
        setResolvedAddress(nativeId);
        setResolvedEvmAddress(evmAddress);
      } catch {
        if (!active) return;
        setResolvedAddress(null);
        setResolvedEvmAddress(null);
      } finally {
        if (active) setIsResolvingCounts(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [addr, resolveBoth]);

  const {
    table,
    isLoading,
    error,
    showNewItems,
    goToPage,
    isPageLoading,
    pageLoadProgress,
    hasExactTotal,
    fastModeActive,
    totalCount,
    loadedCount,
    loadedCountsByType,
  } = useTanstackTransactionAdapter(
    addr,
    appliedMinRaw,
    appliedMaxRaw,
    appliedTokenMinRaw,
    appliedTokenMaxRaw,
    false,
    isActive
  );

  React.useEffect(() => {
    if (!onCountsChange) return;
    if (isLoading) return;
    const hasKnownCount = typeof totalCount === 'number' || loadedCount > 0;
    if (!hasKnownCount) return;
    // Use prefetched swap count if available and we haven't loaded swap data yet
    const swapCount = loadedCountsByType.swap > 0 
      ? loadedCountsByType.swap 
      : (typeof prefetchedSwapCount === 'number' ? prefetchedSwapCount : 0);
    onCountsChange({
      totalCount,
      loadedCount,
      incoming: loadedCountsByType.incoming,
      outgoing: loadedCountsByType.outgoing,
      swap: swapCount,
    });
  }, [onCountsChange, isLoading, totalCount, loadedCount, loadedCountsByType.incoming, loadedCountsByType.outgoing, loadedCountsByType.swap, prefetchedSwapCount]);

  // After table is ready, try to detect decimals for a custom 0x token from current page rows
  const pageIndex = table.getState().pagination.pageIndex;
  const rowCount = table.getRowModel().rows.length;

  const tableRef = React.useRef(table);
  React.useEffect(() => {
    tableRef.current = table;
  });

  const setCustomDecimalsRef = React.useRef(setCustomDecimals);
  React.useEffect(() => {
    setCustomDecimalsRef.current = setCustomDecimals;
  });

  React.useEffect(() => {
    if (!isContractMode) {
      if (customDecimalsRef.current !== null) setCustomDecimalsRef.current(null);
      return;
    }
    const addrLower = tokenFilter.toLowerCase();
    try {
      const rows = tableRef.current.getRowModel().rows;
      for (const r of rows) {
        const o = r.original;
        if (!o) continue;
        const tryDec = (maybe: UiTransfer | null): number | null => {
          const id = String(maybe?.token?.id || '').toLowerCase();
          const dec = maybe?.token?.decimals;
          if (id === addrLower && typeof dec === 'number' && Number.isFinite(dec)) return dec;
          return null;
        };
        const fromToken = tryDec(o);
        if (fromToken != null) {
          if (customDecimalsRef.current !== fromToken) setCustomDecimalsRef.current(fromToken);
          return;
        }
        const sold = tryDec(o.swapInfo?.sold ? { token: o.swapInfo.sold.token } as UiTransfer : null);
        if (sold != null) {
          if (customDecimalsRef.current !== sold) setCustomDecimalsRef.current(sold);
          return;
        }
        const bought = tryDec(o.swapInfo?.bought ? { token: o.swapInfo.bought.token } as UiTransfer : null);
        if (bought != null) {
          if (customDecimalsRef.current !== bought) setCustomDecimalsRef.current(bought);
          return;
        }
      }
    } catch (e) {
      console.error('Error detecting custom decimals:', e);
    }
  }, [isContractMode, tokenFilter, pageIndex, rowCount]);
  const tokenOptions = React.useMemo(() => {
    const opts: Array<{ label: string; value: string }> = [
      { label: 'All tokens', value: 'all' },
      { label: 'REEF', value: 'reef' },
      { label: 'USDC', value: 'usdc' },
      { label: 'MRD', value: MRD_CONTRACT },
    ];
    // If a custom contract is selected via URL or in state, ensure it appears in options
    if (/^0x[0-9a-fA-F]{40}$/.test(tokenFilter) && !opts.some(o => o.value.toLowerCase() === tokenFilter.toLowerCase())) {
      const short = `${tokenFilter.slice(0, 6)}…${tokenFilter.slice(-4)}`;
      opts.push({ label: `Custom (${short})`, value: tokenFilter.toLowerCase() });
    }
    return opts;
  }, [tokenFilter]);
  const selectedTokenLabel = React.useMemo(() => {
    if (isReefMode) return 'REEF';
    if (isUsdcMode) return 'USDC';
    if (isContractMode) {
      const opt = tokenOptions?.find(o => o.value === tokenFilter);
      return opt?.label || 'TOKEN';
    }
    return 'TOKEN';
  }, [isReefMode, isUsdcMode, isContractMode, tokenFilter, tokenOptions]);

  const emptyHint = React.useMemo(() => {
    if (!hasActiveAmountFilter || isRangeInvalid || tokenFilter === 'all') return undefined;
    if (isLoading || isPageLoading) return undefined;
    const hasMin = !!debouncedMinInput.trim();
    const hasMax = !!debouncedMaxInput.trim();
    if (hasMin && hasMax) return `No ${selectedTokenLabel} transfers in [${debouncedMinInput} .. ${debouncedMaxInput}] — adjust thresholds`;
    if (hasMin) return `No ${selectedTokenLabel} transfers ≥ ${debouncedMinInput} — lower the threshold`;
    if (hasMax) return `No ${selectedTokenLabel} transfers ≤ ${debouncedMaxInput} — lower the threshold`;
    return undefined;
  }, [hasActiveAmountFilter, isRangeInvalid, tokenFilter, debouncedMinInput, debouncedMaxInput, isLoading, isPageLoading, selectedTokenLabel]);

  const errorMessage = React.useMemo(() => {
    if (!error) return null;
    return error instanceof Error ? error.message : String(error);
  }, [error]);

  
  const [newTransfers, setNewTransfers] = React.useState<string[]>([]);
  const [toastTransfer, setToastTransfer] = React.useState<UiTransfer | null>(null);
  const toastTimerRef = React.useRef<number | undefined>(undefined);

  // --- URL sync (type/dir, min/max, token) ----------------------------------
  // Initialize from URL on first mount
  React.useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      const type = params.get('type') as TxTypeFilter | null;
      const dir = params.get('dir') as TransactionDirection | null;
      const min = params.get('min');
      const max = params.get('max');
      const tok = params.get('token');

      if (type === 'swap') setTxType('swap');
      else if (dir === 'incoming' || dir === 'outgoing') setTxType(dir as TxTypeFilter);
      else if (type === 'all') setTxType('all');

      if (dir && (dir === 'incoming' || dir === 'outgoing' || dir === 'any')) {
        setDirection(dir);
      }

      if (typeof min === 'string' && min.length > 0) setMinAmountInput(min);
      if (typeof max === 'string' && max.length > 0) setMaxAmountInput(max);
      if (tok) setTokenFilter(tok);
    } catch (e) {
      console.error('Error parsing URL params:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect changes back to URL (replaceState) when type/dir/min/max/token change
  React.useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      // Update type/dir
      if (txType === 'swap') {
        params.set('type', 'swap');
        params.delete('dir');
      } else {
        params.delete('type');
        if (direction && direction !== 'any') params.set('dir', direction);
        else params.delete('dir');
      }
      // Update min
      if (debouncedMinInput && debouncedMinInput.trim()) params.set('min', debouncedMinInput.trim());
      else params.delete('min');
      // Update max
      if (debouncedMaxInput && debouncedMaxInput.trim()) params.set('max', debouncedMaxInput.trim());
      else params.delete('max');
      // Update token
      if (tokenFilter && tokenFilter !== 'all') params.set('token', tokenFilter);
      else params.delete('token');
      // Clear any page markers to avoid stale pagination when filters change
      params.delete('page');
      params.delete('p');
      params.delete('pageIndex');
      const search = params.toString();
      const newUrl = `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
      window.history.replaceState({}, '', newUrl);
    } catch (e) {
      console.error('Error updating URL params:', e);
    }
  }, [txType, direction, debouncedMinInput, debouncedMaxInput, tokenFilter]);

  const onNewTransfer = React.useCallback((newTransfer: UiTransfer) => {
    if (!newTransfer) return;
    // Highlight newly detected transfer; Apollo cache will bring it via next fetch/page
    setNewTransfers(prev => {
      if (!prev.includes(newTransfer.id)) return [newTransfer.id, ...prev];
      return prev;
    });
    // If пользователь на первой странице — обновим якорь, иначе сохраним текущую позицию
    const isOnFirstPage = table.getState().pagination.pageIndex === 0;
    if (isOnFirstPage) {
      showNewItems(newTransfer.id);
    }

    // Show bottom-right toast with info about the transfer
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = undefined;
    }
    setToastTransfer(newTransfer);
    toastTimerRef.current = window.setTimeout(() => setToastTransfer(null), 6000);

    setTimeout(() => {
      setNewTransfers(prev => prev.filter(id => id !== newTransfer.id));
    }, 10000);
  }, [showNewItems, table]);

  useTransferSubscription({
    address: addr,
    onNewTransfer,
    // Avoid race: start polling only after initial paginated query has loaded
    // so cache.updateQuery can prepend into an existing connection entry
    isEnabled: isActive && !!addr && !isLoading,
    // Keep subscription scope stable to avoid refetch on each UI filter toggle
    // (incoming/outgoing/all). Table filtering still applies on top.
    direction: 'any',
    minReefRaw: null,
    maxReefRaw: null,
  });

  React.useEffect(() => {
    setNewTransfers([]);
    setToastTransfer(null);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = undefined;
    }
  }, [addr]);

  const [typeBadgeCounts, setTypeBadgeCounts] = React.useState<{
    all: number | null;
    incoming: number | null;
    outgoing: number | null;
    swap: number | null;
    staking: number | null;
  }>({ all: null, incoming: null, outgoing: null, swap: null, staking: null });

  const typeCountsCacheKey = React.useMemo(() => {
    const addrKey = (addr || '').trim().toLowerCase();
    const tf = (tokenFilter || '').trim().toLowerCase();
    return [
      addrKey,
      tf,
      String(appliedMinRaw ?? ''),
      String(appliedMaxRaw ?? ''),
      String(appliedTokenMinRaw ?? ''),
      String(appliedTokenMaxRaw ?? ''),
    ].join('|');
  }, [addr, tokenFilter, appliedMinRaw, appliedMaxRaw, appliedTokenMinRaw, appliedTokenMaxRaw]);

  React.useEffect(() => {
    const cached = txTypeCountsCache.get(typeCountsCacheKey)?.counts;
    if (cached) {
      setTypeBadgeCounts(cached);
      return;
    }
    setTypeBadgeCounts({ all: null, incoming: null, outgoing: null, swap: null, staking: null });
  }, [typeCountsCacheKey]);

  React.useEffect(() => {
    if (!typeCountsCacheKey) return;
    const hasAny = Object.values(typeBadgeCounts).some((v) => typeof v === 'number' && Number.isFinite(v));
    if (!hasAny) return;

    txTypeCountsCache.delete(typeCountsCacheKey);
    txTypeCountsCache.set(typeCountsCacheKey, { counts: typeBadgeCounts, updatedAt: Date.now() });
    if (txTypeCountsCache.size > 50) {
      const first = txTypeCountsCache.keys().next().value as string | undefined;
      if (first) txTypeCountsCache.delete(first);
    }
  }, [typeCountsCacheKey, typeBadgeCounts]);

  const currentTypeCount = typeof totalCount === 'number' ? totalCount : loadedCount;

  React.useEffect(() => {
    if (isLoading) return;
    if (!Number.isFinite(currentTypeCount)) return;
    setTypeBadgeCounts((prev) => {
      const prevValue = prev[txType];
      if (typeof prevValue === 'number' && prevValue > 0 && currentTypeCount === 0) return prev;
      return { ...prev, [txType]: currentTypeCount };
    });
  }, [txType, isLoading, currentTypeCount]);

  // Update swap badge from prefetched count (before user clicks Swap tab)
  React.useEffect(() => {
    if (typeof prefetchedSwapCount !== 'number') return;
    if (prefetchedSwapCount <= 0) return;
    setTypeBadgeCounts((prev) => {
      if (typeof prev.swap === 'number' && prev.swap > 0) return prev;
      return { ...prev, swap: prefetchedSwapCount };
    });
  }, [prefetchedSwapCount]);

  // Update staking badge from prefetched count (before user clicks Staking tab)
  React.useEffect(() => {
    if (typeof prefetchedStakingCount !== 'number') return;
    setTypeBadgeCounts((prev) => {
      if (typeof prev.staking === 'number' && prev.staking > 0) return prev;
      return { ...prev, staking: prefetchedStakingCount };
    });
  }, [prefetchedStakingCount]);

  React.useEffect(() => {
    if (isResolvingCounts) return;
    if (!resolvedAddress && !resolvedEvmAddress) return;
    if (!(tokenFilter === 'all' || tokenFilter === 'reef' || tokenFilter === 'usdc' || tokenFilter === 'mrd' || isContractMode)) return;
    let cancelled = false;

    function getTokenCountFilter(): { reefOnly: boolean; tokenIds: string[] | null; tokenMinRaw: string | null; tokenMaxRaw: string | null } {
      if (tokenFilter === 'usdc') {
        return {
          reefOnly: false,
          tokenIds: Array.from(new Set<string>([...USDC_ID_SET, ...USDC_SESSION_SET])),
          tokenMinRaw: appliedTokenMinRaw,
          tokenMaxRaw: appliedTokenMaxRaw,
        };
      }
      if (tokenFilter === 'mrd') {
        return {
          reefOnly: false,
          tokenIds: Array.from(new Set<string>([...MRD_ID_SET, ...MRD_SESSION_SET])),
          tokenMinRaw: appliedTokenMinRaw,
          tokenMaxRaw: appliedTokenMaxRaw,
        };
      }
      if (tokenFilter === 'reef') return { reefOnly: true, tokenIds: null, tokenMinRaw: null, tokenMaxRaw: null };
      if (isContractMode) return { reefOnly: false, tokenIds: [tokenFilter], tokenMinRaw: appliedTokenMinRaw, tokenMaxRaw: appliedTokenMaxRaw };
      return { reefOnly: false, tokenIds: null, tokenMinRaw: null, tokenMaxRaw: null };
    }

    function buildWhere(dir: TransactionDirection): TransferWhere | undefined {
      const tokenCfg = getTokenCountFilter();
      return buildTransferWhereFilter({
        resolvedAddress,
        resolvedEvmAddress,
        direction: dir,
        minReefRaw: appliedMinRaw,
        maxReefRaw: appliedMaxRaw,
        reefOnly: tokenCfg.reefOnly,
        tokenIds: tokenCfg.tokenIds,
        tokenMinRaw: tokenCfg.tokenMinRaw,
        tokenMaxRaw: tokenCfg.tokenMaxRaw,
        excludeSwapLegs: true,
      });
    }

    interface TransfersBulkCountsData {
      all?: { totalCount?: number | null; aggregate?: { count?: number | null } | null } | null;
      incoming?: { totalCount?: number | null; aggregate?: { count?: number | null } | null } | null;
      outgoing?: { totalCount?: number | null; aggregate?: { count?: number | null } | null } | null;
    }
    interface TransfersBulkCountsVars {
      whereAny?: TransferWhere | null;
      whereIncoming?: TransferWhere | null;
      whereOutgoing?: TransferWhere | null;
      orderBy?: unknown;
    }

    const tid = window.setTimeout(async () => {
      const whereAny = buildWhere('any') ?? null;
      const whereIncoming = buildWhere('incoming') ?? null;
      const whereOutgoing = buildWhere('outgoing') ?? null;
      if (!whereAny && !whereIncoming && !whereOutgoing) return;
      let allCount: number | null = null;
      let incomingCount: number | null = null;
      let outgoingCount: number | null = null;
      try {
        const variables: TransfersBulkCountsVars = {
          whereAny,
          whereIncoming,
          whereOutgoing,
        };
        if (!isHasuraExplorerMode) variables.orderBy = buildTransferOrderBy();

        const { data } = await apolloClient.query<TransfersBulkCountsData, TransfersBulkCountsVars>({
          query: TRANSFERS_BULK_COUNTS_QUERY as unknown as DocumentNode,
          variables,
          fetchPolicy: 'no-cache',
        });
        const a = data?.all?.totalCount ?? data?.all?.aggregate?.count;
        const i = data?.incoming?.totalCount ?? data?.incoming?.aggregate?.count;
        const o = data?.outgoing?.totalCount ?? data?.outgoing?.aggregate?.count;
        allCount = (typeof a === 'number' && Number.isFinite(a)) ? a : null;
        incomingCount = (typeof i === 'number' && Number.isFinite(i)) ? i : null;
        outgoingCount = (typeof o === 'number' && Number.isFinite(o)) ? o : null;
      } catch (error) {
        console.error('Error fetching bulk counts:', error);
      }
      if (cancelled) return;
      setTypeBadgeCounts((prev) => ({
        ...prev,
        all: allCount ?? prev.all,
        incoming: incomingCount ?? prev.incoming,
        outgoing: outgoingCount ?? prev.outgoing,
      }));
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [apolloClient, isResolvingCounts, resolvedAddress, resolvedEvmAddress, tokenFilter, isContractMode, appliedMinRaw, appliedMaxRaw, appliedTokenMinRaw, appliedTokenMaxRaw]);

  function getTypeBadge(intent: TxTypeFilter) {
    if (intent === txType) {
      const cached = typeBadgeCounts[intent];
      if (isLoading && typeof cached === 'number' && Number.isFinite(cached)) return cached;
      if (Number.isFinite(currentTypeCount)) {
        if (typeof cached === 'number' && Number.isFinite(cached) && cached > 0 && currentTypeCount === 0) return cached;
        return currentTypeCount;
      }
    }
    return typeBadgeCounts[intent];
  }

  function typeBtnClass(intent: TxTypeFilter) {
    const isActive = txType === intent;
    if (intent === 'incoming') {
      return `rounded-full transition-all duration-300 ${isActive ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'}`;
    }
    if (intent === 'outgoing') {
      return `rounded-full transition-all duration-300 ${isActive ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'}`;
    }
    if (intent === 'swap') {
      return `rounded-full transition-all duration-300 ${isActive ? 'bg-[#2563EB] hover:bg-[#3B82F6] text-white border-[#2563EB] shadow-md shadow-[#2563EB]/20' : 'bg-white text-gray-700 border-gray-200 hover:bg-[#E0F2FE] hover:text-[#2563EB] hover:border-[#3B82F6]/40'}`;
    }
    if (intent === 'staking') {
      return `rounded-full transition-all duration-300 ${isActive ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300'}`;
    }
    return `rounded-full transition-all duration-300 ${isActive ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`;
  }

  const { status: healthStatus } = useSquidHealth({ intervalMs: 30_000, enabled: isActive });
  
  const statusColors = {
    loading: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
    live: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    lagging: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
    stale: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
    down: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  };
  
  const statusLabel = healthStatus === 'loading' ? 'Connecting' : healthStatus === 'live' ? 'Live' : healthStatus === 'lagging' ? 'Lagging' : healthStatus === 'stale' ? 'Stale' : 'Down';
  const colors = statusColors[healthStatus];

  return (
    <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="absolute top-0 left-0 right-0 h-1 data-refresh-shimmer opacity-60" />
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Transaction History</h2>
          <p className="text-sm text-gray-500">All wallet transactions with real-time updates</p>
        </div>
        <Badge variant="secondary" className={`${colors.bg} ${colors.text} border ${colors.border} rounded-full shadow-sm px-3 py-1.5`}>
          <span className="inline-flex items-center gap-2">
            <span className={`w-2 h-2 ${colors.dot} rounded-full ${healthStatus === 'live' || healthStatus === 'loading' ? 'animate-pulse' : ''}`} />
            <span className="text-sm font-medium">{statusLabel} Updates</span>
          </span>
        </Badge>
      </div>
      <TransactionsFilters
        getTypeBadge={getTypeBadge}
        typeBtnClass={typeBtnClass}
        tokenOptions={tokenOptions}
        selectedTokenLabel={selectedTokenLabel}
        selectedTokenDecimals={selectedTokenDecimals}
        isAllMode={isAllMode}
        isReefMode={isReefMode}
        isMinInvalid={isMinInvalid}
        isMaxInvalid={isMaxInvalid}
        isRangeInvalid={isRangeInvalid}
        debouncedMinInput={debouncedMinInput}
      />
      {errorMessage ? (
        <div className="flex items-center gap-4 p-4 mb-4 text-red-700 bg-red-100 rounded-lg shadow">
          <AlertTriangle className="h-6 w-6" />
          <div>
            <h3 className="font-bold">Error Fetching Transactions</h3>
            <p>{errorMessage}</p>
          </div>
        </div>
      ) : null}
      {toastTransfer ? (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm w-[360px] p-4 rounded-lg shadow-lg border ${toastTransfer.type === 'INCOMING' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}
          data-testid="new-transfer-toast"
        >
          <div className="flex items-start gap-3">
            <div className={`rounded-full p-2 ${toastTransfer.type === 'INCOMING' ? 'bg-green-100' : 'bg-red-100'}`}>
              {toastTransfer.type === 'INCOMING' ? (
                <ArrowDownRight className="h-6 w-6" />
              ) : (
                <ArrowUpRight className="h-6 w-6" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1">
                {toastTransfer.type === 'INCOMING' ? 'Incoming' : 'Outgoing'} transfer
              </div>
              <div className="text-lg font-bold mb-1">
                {formatAmount(toastTransfer.amount, toastTransfer.token.decimals, toastTransfer.token.name)}
              </div>
              <div className="text-sm">
                {toastTransfer.type === 'INCOMING' ? (
                  <span>from <AddressDisplay address={toastTransfer.from} /></span>
                ) : (
                  <span>to <AddressDisplay address={toastTransfer.to} /></span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
        {txType === 'staking' ? (
          <StakingTable
            address={resolvedAddress}
            evmAddress={resolvedEvmAddress}
            enabled={isActive}
            onCountChange={(count) => {
              setTypeBadgeCounts((prev) => ({ ...prev, staking: count }));
            }}
          />
        ) : (
          <TransactionTableWithTanStack
            table={table}
            isLoading={isLoading}
            totalCount={totalCount}
            loadedCount={loadedCount}
            newTransfers={newTransfers}
            goToPage={goToPage}
            isPageLoading={isPageLoading}
            pageLoadProgress={pageLoadProgress}
            hasExactTotal={hasExactTotal}
            fastModeActive={fastModeActive}
            emptyHint={emptyHint}
          />
        )}
      </React.Suspense>
    </div>
  );
}

interface TransactionHistoryWithBlocksProps {
  initialAddress?: string;
}

export function TransactionHistoryWithBlocks({ initialAddress = '' }: TransactionHistoryWithBlocksProps) {
  const [viewMode, setViewMode] = React.useState<'transactions' | 'nfts' | 'balances'>('transactions');
  const [address, setAddress] = React.useState(initialAddress);
  const [submittedAddress, setSubmittedAddress] = React.useState(initialAddress);
  const [hasMountedBalances, setHasMountedBalances] = React.useState(false);
  const [hasMountedNfts, setHasMountedNfts] = React.useState(false);

  const [tabCounts, setTabCounts] = React.useState<{ transactions: number | null; holdings: number | null; nfts: number | null }>({
    transactions: null,
    holdings: null,
    nfts: null,
  });

  const [addressError, setAddressError] = React.useState<string | null>(null);
  const { validateAddress, isResolving } = useAddressResolver();

  // Enable owner-based infinite NFTs mode for E2E via URL flag: ?infiniteOwner=1
  const enableOwnerInfiniteFlag = React.useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('infiniteOwner') ?? params.get('ownerInfinite');
      return raw === '1' || raw === 'true' || raw === 'yes';
    } catch (error) {
      console.error('Error parsing URL:', error);
      return false;
    }
  }, []);

  const { totalCount: holdingsTotalCount } = useTokenBalances(submittedAddress, 1);
  const { totalCount: nftsTotalCount } = useNftCountByOwner(submittedAddress);

  React.useEffect(() => {
    if (!submittedAddress) {
      setTabCounts({ transactions: null, holdings: null, nfts: null });
      setHasMountedBalances(false);
      setHasMountedNfts(false);
      return;
    }

    setTabCounts({ transactions: null, holdings: null, nfts: null });
    try {
      void import('./BalancesTable');
      void import('./NftGallery');
    } catch (error) {
      console.error('Error importing components:', error);
    }
  }, [submittedAddress]);

  React.useEffect(() => {
    if (!submittedAddress) return;
    if (viewMode === 'balances') setHasMountedBalances(true);
    if (viewMode === 'nfts') setHasMountedNfts(true);
  }, [submittedAddress, viewMode]);

  React.useEffect(() => {
    if (typeof holdingsTotalCount !== 'number') return;
    setTabCounts((prev) => ({ ...prev, holdings: Number.isFinite(holdingsTotalCount) ? holdingsTotalCount : prev.holdings }));
  }, [holdingsTotalCount]);

  React.useEffect(() => {
    if (typeof nftsTotalCount !== 'number') return;
    setTabCounts((prev) => ({ ...prev, nfts: Number.isFinite(nftsTotalCount) ? nftsTotalCount : prev.nfts }));
  }, [nftsTotalCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = address.trim();
    const isValid = isValidEvmAddressFormat(input) || isValidSubstrateAddressFormat(input);
    if (!isValid) {
      setAddressError('Некорректный адрес');
      // Clear previously submitted address to avoid showing stale NFTs/transactions
      setSubmittedAddress('');
      return;
    }

    setAddressError(null);
    try {
      const exists = await validateAddress(input);
      if (!exists) {
        setAddressError('Адрес не найден в сети Reef');
        setSubmittedAddress('');
        return;
      }
    } catch (error) {
      console.error('Error validating address:', error);
      // Network or resolver error: keep UX predictable and do not submit
      setAddressError('Не удалось проверить адрес. Попробуйте ещё раз.');
      setSubmittedAddress('');
      return;
    }

    // If this is NOT the first submission (adapter already mounted), clear sticky page params
    if (submittedAddress) {
      try {
        const url = new URL(window.location.href);
        const params = url.searchParams;
        params.delete('page');
        params.delete('p');
        params.delete('pageIndex');
        const search = params.toString();
        const newUrl = `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
        window.history.replaceState({}, '', newUrl);
      } catch (e) {
        console.error('Error clearing page params:', e);
      }
    }

    setSubmittedAddress(input);
  };

  const handleCountsChange = React.useCallback((counts: {
    totalCount?: number;
    loadedCount: number;
    incoming: number;
    outgoing: number;
    swap: number;
  }) => {
    const value = typeof counts.totalCount === 'number' ? counts.totalCount : counts.loadedCount;
    setTabCounts((prev) => {
      if (!Number.isFinite(value)) return prev;
      if (typeof counts.totalCount !== 'number' && value === 0 && typeof prev.transactions === 'number' && prev.transactions > 0) return prev;
      if (prev.transactions === value) return prev;
      return { ...prev, transactions: value };
    });
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Transaction History</h1>
          <p className="text-gray-500">
            All wallet transactions with real-time updates
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-4 mb-6 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter Reef address"
            className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="address-input"
          />
          <button
            type="submit"
            disabled={isResolving}
            className="flex items-center justify-center px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            data-testid="search-button"
          >
            {'Search'}
          </button>
        </form>

        {addressError && (
          <div className="flex items-center gap-4 p-3 mb-4 text-yellow-800 bg-yellow-100 rounded" data-testid="address-error">
            <AlertTriangle className="h-5 w-5" />
            <p>{addressError}</p>

          </div>
        )}

        {/* Network-error box moved into TransactionsView context */}

        {submittedAddress && (
          <div className="mb-6 rounded-xl border border-gray-100 bg-slate-50/70 shadow-sm">
            <div className="flex items-stretch">
              <button
                className={`relative flex-1 inline-flex items-center justify-center gap-2 h-14 px-6 text-sm font-medium transition-all duration-200 border-b-[3px] ${
                  viewMode === 'transactions'
                    ? 'bg-white text-blue-600 border-blue-600'
                    : 'bg-transparent text-gray-600 border-transparent hover:text-gray-900'
                } hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-100 hover:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
                onClick={() => setViewMode('transactions')}
              >
                <Activity className="w-4 h-4" />
                Transactions
                <span
                  className={`ml-2 inline-flex items-center justify-center min-w-7 h-5 px-2 text-xs font-semibold rounded-full border ${
                    viewMode === 'transactions' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {tabCounts.transactions ?? '—'}
                </span>
              </button>
              <button
                className={`relative flex-1 inline-flex items-center justify-center gap-2 h-14 px-6 text-sm font-medium transition-all duration-200 border-b-[3px] ${
                  viewMode === 'balances'
                    ? 'bg-white text-blue-600 border-blue-600'
                    : 'bg-transparent text-gray-600 border-transparent hover:text-gray-900'
                } hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-100 hover:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
                onClick={() => setViewMode('balances')}
                data-testid="tab-balances"
              >
                <Coins className="w-4 h-4" />
                Holdings
                <span
                  className={`ml-2 inline-flex items-center justify-center min-w-7 h-5 px-2 text-xs font-semibold rounded-full border ${
                    viewMode === 'balances' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {tabCounts.holdings ?? '—'}
                </span>
              </button>
              <button
                className={`relative flex-1 inline-flex items-center justify-center gap-2 h-14 px-6 text-sm font-medium transition-all duration-200 border-b-[3px] ${
                  viewMode === 'nfts'
                    ? 'bg-white text-blue-600 border-blue-600'
                    : 'bg-transparent text-gray-600 border-transparent hover:text-gray-900'
                } hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-100 hover:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
                onClick={() => setViewMode('nfts')}
                data-testid="tab-nfts"
              >
                <Image className="w-4 h-4" />
                NFTs
                <span
                  className={`ml-2 inline-flex items-center justify-center min-w-7 h-5 px-2 text-xs font-semibold rounded-full border ${
                    viewMode === 'nfts' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {tabCounts.nfts ?? '—'}
                </span>
              </button>
            </div>
          </div>
        )}

        {submittedAddress ? (
          <>
            <div className={viewMode === 'transactions' ? '' : 'hidden'} aria-hidden={viewMode !== 'transactions'}>
              <TransactionsView
                addr={submittedAddress}
                onCountsChange={handleCountsChange}
                isActive={viewMode === 'transactions'}
              />
            </div>

            {(hasMountedNfts || viewMode === 'nfts') ? (
              <div className={viewMode === 'nfts' ? '' : 'hidden'} aria-hidden={viewMode !== 'nfts'}>
                <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                  <NftGallery
                    address={submittedAddress}
                    enableOwnerInfinite={enableOwnerInfiniteFlag}
                    onCountsChange={(count) => {
                      setTabCounts((prev) => {
                        if (!Number.isFinite(count)) return prev;
                        if (typeof prev.nfts === 'number' && prev.nfts >= count) return prev;
                        return { ...prev, nfts: count };
                      });
                    }}
                  />
                </React.Suspense>
              </div>
            ) : null}

            {(hasMountedBalances || viewMode === 'balances') ? (
              <div className={viewMode === 'balances' ? '' : 'hidden'} aria-hidden={viewMode !== 'balances'}>
                <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                  <BalancesTable
                    address={submittedAddress}
                    onCountsChange={(count) => {
                      setTabCounts((prev) => {
                        if (!Number.isFinite(count)) return prev;
                        if (typeof prev.holdings === 'number' && prev.holdings >= count) return prev;
                        return { ...prev, holdings: count };
                      });
                    }}
                  />
                </React.Suspense>
              </div>
            ) : null}

          </>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">Please enter an address to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
