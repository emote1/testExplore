import React from 'react';
import { Loader2, AlertTriangle, ArrowDownRight, ArrowUpRight, Activity, Coins, Image } from 'lucide-react';
import { useApolloClient } from '@apollo/client';
import { useTanstackTransactionAdapter } from '../hooks/useTanstackTransactionAdapter';
import type { UiTransfer } from '../data/transfer-mapper';
import { useTransferSubscription } from '../hooks/useTransferSubscription';
import { buildTransferWhereFilter, type TransactionDirection } from '../utils/transfer-query';
import { isValidEvmAddressFormat, isValidSubstrateAddressFormat } from '../utils/address-helpers';
import { useAddressResolver } from '../hooks/use-address-resolver';
import { formatAmount } from '../utils/formatters';
import { SquidHealthIndicator } from './SquidHealthIndicator';
import { AddressDisplay } from './AddressDisplay';
import { useTokenBalances } from '../hooks/use-token-balances';
import { useNftCountByOwner } from '../hooks/use-nft-count-by-owner';
import { Badge } from './ui/badge';
import { TRANSFERS_BULK_COUNTS_QUERY } from '../data/transfers';
import type { TransferOrderByInput, TransferWhereInput } from '../gql/graphql';
import { MRD_ID_SET, MRD_SESSION_SET, USDC_ID_SET, USDC_SESSION_SET } from '../tokens/token-ids';
import type { DocumentNode } from 'graphql';
import { TransactionsFilters } from './TransactionsFilters';

const txTypeCountsCache = new Map<
  string,
  {
    counts: { all: number | null; incoming: number | null; outgoing: number | null; swap: number | null };
    updatedAt: number;
  }
>();

const TransactionTableWithTanStack = React.lazy(() =>
  import('./TransactionTableWithTanStack').then(m => ({ default: m.TransactionTableWithTanStack }))
);

const NftGallery = React.lazy(() =>
  import('./NftGallery').then(m => ({ default: m.NftGallery }))
);

const RewardsTable = React.lazy(() =>
  import('./RewardsTable').then(m => ({ default: m.RewardsTable }))
);

const BalancesTable = React.lazy(() =>
  import('./BalancesTable').then(m => ({ default: m.BalancesTable }))
);

// Top-level TransactionsView so it does not remount on each parent render.
function TransactionsView({
  addr,
  onCountsChange,
}: {
  addr: string;
  onCountsChange?: (counts: {
    totalCount?: number;
    loadedCount: number;
    incoming: number;
    outgoing: number;
    swap: number;
  }) => void;
}) {
  const apolloClient = useApolloClient();
  const { resolveBoth } = useAddressResolver();
  const [direction, setDirection] = React.useState<TransactionDirection>('any');
  const [txType, setTxType] = React.useState<'all' | 'incoming' | 'outgoing' | 'swap'>('all');
  // tokenFilter supports: 'all' | 'reef' | 'usdc' | <contractAddress>
  const [tokenFilter, setTokenFilter] = React.useState<string>('all');
  const MRD_CONTRACT = '0x95a2AF50040B7256a4B4c405a4AfD4DD573DA115';
  // Shared inputs for amount filter; semantics (REEF/USDC/MRD) depend on tokenFilter
  const [minReefInput, setMinReefInput] = React.useState<string>('');
  const [maxReefInput, setMaxReefInput] = React.useState<string>('');
  const isAllMode = tokenFilter === 'all';
  const isReefMode = tokenFilter === 'reef';
  const isUsdcMode = tokenFilter === 'usdc';
  const isContractMode = React.useMemo(() => /^0x[0-9a-fA-F]{40}$/.test(tokenFilter), [tokenFilter]);
  // Decimals detected for a custom 0x token from current page data
  const [customDecimals, setCustomDecimals] = React.useState<number | null>(null);
  const [resolvedAddress, setResolvedAddress] = React.useState<string | null>(null);
  const [resolvedEvmAddress, setResolvedEvmAddress] = React.useState<string | null>(null);
  const [isResolvingCounts, setIsResolvingCounts] = React.useState<boolean>(false);
  // Debounce the raw input to avoid excessive queries while typing
  const [debouncedMinReefInput, setDebouncedMinReefInput] = React.useState<string>('');
  const [debouncedMaxReefInput, setDebouncedMaxReefInput] = React.useState<string>('');
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedMinReefInput(minReefInput), 300);
    return () => window.clearTimeout(id);
  }, [minReefInput]);
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedMaxReefInput(maxReefInput), 300);
    return () => window.clearTimeout(id);
  }, [maxReefInput]);
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
      // Prefer dynamically detected decimals if available
      if (typeof customDecimals === 'number') return customDecimals;
      // Known MRD contract uses 18 decimals; default to 18 for other contracts (safe fallback)
      return addrLower === MRD_CONTRACT ? 18 : 18;
    }
    return 18;
  }, [isReefMode, isUsdcMode, isContractMode, tokenFilter, customDecimals]);

  // Raw values for the selected token
  const minTokenRaw = React.useMemo(() => parseToRawDecimal(debouncedMinReefInput, selectedTokenDecimals), [debouncedMinReefInput, selectedTokenDecimals]);
  const maxTokenRaw = React.useMemo(() => parseToRawDecimal(debouncedMaxReefInput, selectedTokenDecimals), [debouncedMaxReefInput, selectedTokenDecimals]);
  const isMinReefInvalid = React.useMemo(() => {
    const raw = (minReefInput || '').trim();
    if (!raw) return false;
    const s = raw.replace(',', '.');
    return !/^\d*(?:\.(\d+)?)?$/.test(s);
  }, [minReefInput]);
  const isMaxReefInvalid = React.useMemo(() => {
    const raw = (maxReefInput || '').trim();
    if (!raw) return false;
    const s = raw.replace(',', '.');
    return !/^\d*(?:\.(\d+)?)?$/.test(s);
  }, [maxReefInput]);
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
  const swapOnly = txType === 'swap';

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
  } = useTanstackTransactionAdapter(addr, direction, appliedMinRaw, appliedMaxRaw, tokenFilter, appliedTokenMinRaw, appliedTokenMaxRaw, false, swapOnly);

  React.useEffect(() => {
    if (!onCountsChange) return;
    if (isLoading) return;
    const hasKnownCount = typeof totalCount === 'number' || loadedCount > 0;
    if (!hasKnownCount) return;
    onCountsChange({
      totalCount,
      loadedCount,
      incoming: loadedCountsByType.incoming,
      outgoing: loadedCountsByType.outgoing,
      swap: loadedCountsByType.swap,
    });
  }, [onCountsChange, isLoading, totalCount, loadedCount, loadedCountsByType.incoming, loadedCountsByType.outgoing, loadedCountsByType.swap]);

  // After table is ready, try to detect decimals for a custom 0x token from current page rows
  React.useEffect(() => {
    if (!isContractMode) { setCustomDecimals(null); return; }
    const addrLower = tokenFilter.toLowerCase();
    try {
      const rows: Array<{ original?: any }> = (table?.getRowModel?.().rows ?? []) as any;
      for (const r of rows) {
        const o = r?.original;
        if (!o) continue;
        const tryDec = (maybe: any): number | null => {
          const id = String(maybe?.token?.id || '').toLowerCase();
          const dec = maybe?.token?.decimals;
          if (id === addrLower && typeof dec === 'number' && Number.isFinite(dec)) return dec as number;
          return null;
        };
        const fromToken = tryDec({ token: o?.token });
        if (fromToken != null) { setCustomDecimals(fromToken); return; }
        const sold = tryDec({ token: o?.swapInfo?.sold?.token });
        if (sold != null) { setCustomDecimals(sold); return; }
        const bought = tryDec({ token: o?.swapInfo?.bought?.token });
        if (bought != null) { setCustomDecimals(bought); return; }
      }
      // If not found on this page, keep previous value or null
    } catch {
      // ignore
    }
  }, [isContractMode, tokenFilter, table, (table?.getState?.().pagination?.pageIndex ?? 0), (table?.getRowModel?.().rows?.length ?? 0)]);
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
    const hasMin = !!debouncedMinReefInput.trim();
    const hasMax = !!debouncedMaxReefInput.trim();
    if (hasMin && hasMax) return `No ${selectedTokenLabel} transfers in [${debouncedMinReefInput} .. ${debouncedMaxReefInput}] — adjust thresholds`;
    if (hasMin) return `No ${selectedTokenLabel} transfers ≥ ${debouncedMinReefInput} — lower the threshold`;
    if (hasMax) return `No ${selectedTokenLabel} transfers ≤ ${debouncedMaxReefInput} — lower the threshold`;
    return undefined;
  }, [hasActiveAmountFilter, isRangeInvalid, tokenFilter, debouncedMinReefInput, debouncedMaxReefInput, isLoading, isPageLoading, selectedTokenLabel]);

  const errorMessage = React.useMemo(() => {
    if (!error) return null;
    return String((error as any)?.message || error);
  }, [error]);

  
  const [newTransfers, setNewTransfers] = React.useState<string[]>([]);
  const [toastTransfer, setToastTransfer] = React.useState<UiTransfer | null>(null);
  const toastTimerRef = React.useRef<number | undefined>(undefined);

  // Keep direction in sync with txType
  React.useEffect(() => {
    if (txType === 'incoming' || txType === 'outgoing') setDirection(txType);
    else setDirection('any');
  }, [txType]);

  // --- URL sync (type/dir, min/max, token) ----------------------------------
  // Initialize from URL on first mount
  React.useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      const type = params.get('type');
      const dir = params.get('dir');
      const min = params.get('min');
      const max = params.get('max');
      const tok = params.get('token');
      if (type === 'swap') setTxType('swap');
      else if (dir === 'incoming' || dir === 'outgoing') setTxType(dir as any);
      else setTxType('all');
      if (dir === 'incoming' || dir === 'outgoing' || dir === 'any') setDirection(dir as TransactionDirection);
      if (typeof min === 'string' && min.length > 0) setMinReefInput(min);
      if (typeof max === 'string' && max.length > 0) setMaxReefInput(max);
      if (tok === 'reef' || tok === 'usdc' || tok === 'all') setTokenFilter(tok as any);
      else if (typeof tok === 'string' && /^0x[0-9a-fA-F]{40}$/.test(tok)) setTokenFilter(tok);
    } catch {}
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
      if (debouncedMinReefInput && debouncedMinReefInput.trim()) params.set('min', debouncedMinReefInput.trim());
      else params.delete('min');
      // Update max
      if (debouncedMaxReefInput && debouncedMaxReefInput.trim()) params.set('max', debouncedMaxReefInput.trim());
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
    } catch {}
  }, [txType, direction, debouncedMinReefInput, debouncedMaxReefInput, tokenFilter]);

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
    isEnabled: !!addr && !isLoading,
    direction,
    minReefRaw: appliedMinRaw,
    maxReefRaw: appliedMaxRaw,
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
  }>({ all: null, incoming: null, outgoing: null, swap: null });

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
    setTypeBadgeCounts({ all: null, incoming: null, outgoing: null, swap: null });
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

    function buildWhere(dir: TransactionDirection): TransferWhereInput | undefined {
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
      all?: { totalCount?: number | null } | null;
      incoming?: { totalCount?: number | null } | null;
      outgoing?: { totalCount?: number | null } | null;
    }
    interface TransfersBulkCountsVars {
      whereAny?: TransferWhereInput | null;
      whereIncoming?: TransferWhereInput | null;
      whereOutgoing?: TransferWhereInput | null;
      orderBy: TransferOrderByInput[];
    }

    (async () => {
      const whereAny = buildWhere('any') ?? null;
      const whereIncoming = buildWhere('incoming') ?? null;
      const whereOutgoing = buildWhere('outgoing') ?? null;
      if (!whereAny && !whereIncoming && !whereOutgoing) return;
      let allCount: number | null = null;
      let incomingCount: number | null = null;
      let outgoingCount: number | null = null;
      try {
        const { data } = await apolloClient.query<TransfersBulkCountsData, TransfersBulkCountsVars>({
          query: TRANSFERS_BULK_COUNTS_QUERY as unknown as DocumentNode,
          variables: {
            whereAny,
            whereIncoming,
            whereOutgoing,
            orderBy: ['timestamp_DESC', 'id_DESC'] as TransferOrderByInput[],
          },
          fetchPolicy: 'no-cache',
        });
        const a = data?.all?.totalCount;
        const i = data?.incoming?.totalCount;
        const o = data?.outgoing?.totalCount;
        allCount = (typeof a === 'number' && Number.isFinite(a)) ? a : null;
        incomingCount = (typeof i === 'number' && Number.isFinite(i)) ? i : null;
        outgoingCount = (typeof o === 'number' && Number.isFinite(o)) ? o : null;
      } catch {
        // ignore
      }
      if (cancelled) return;
      setTypeBadgeCounts((prev) => ({
        ...prev,
        all: allCount ?? prev.all,
        incoming: incomingCount ?? prev.incoming,
        outgoing: outgoingCount ?? prev.outgoing,
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [apolloClient, isResolvingCounts, resolvedAddress, resolvedEvmAddress, tokenFilter, isContractMode, appliedMinRaw, appliedMaxRaw, appliedTokenMinRaw, appliedTokenMaxRaw]);

  function getTypeBadge(intent: 'all' | 'incoming' | 'outgoing' | 'swap') {
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

  function typeBtnClass(intent: 'all' | 'incoming' | 'outgoing' | 'swap') {
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
    return `rounded-full transition-all duration-300 ${isActive ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`;
  }

  return (
    <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="absolute top-0 left-0 right-0 h-1 data-refresh-shimmer opacity-60" />
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Transaction History</h2>
          <p className="text-sm text-gray-500">All wallet transactions with real-time updates</p>
        </div>
        <Badge variant="secondary" className="bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-full shadow-sm px-3 py-1.5">
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 bg-[#00BFFF] rounded-full animate-pulse" />
            <span className="text-sm font-medium">Live Updates</span>
          </span>
        </Badge>
      </div>
      {/* Detailed API health indicator */}
      <div className="mb-4">
        <SquidHealthIndicator />
      </div>
      <TransactionsFilters
        txType={txType}
        setTxType={setTxType}
        getTypeBadge={getTypeBadge}
        typeBtnClass={typeBtnClass}
        tokenFilter={tokenFilter}
        tokenOptions={tokenOptions}
        onTokenFilterChange={setTokenFilter}
        selectedTokenLabel={selectedTokenLabel}
        selectedTokenDecimals={selectedTokenDecimals}
        minInput={minReefInput}
        setMinInput={setMinReefInput}
        maxInput={maxReefInput}
        setMaxInput={setMaxReefInput}
        isAllMode={isAllMode}
        isReefMode={isReefMode}
        isMinInvalid={isMinReefInvalid}
        isMaxInvalid={isMaxReefInvalid}
        isRangeInvalid={isRangeInvalid}
        debouncedMinInput={debouncedMinReefInput}
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
      </React.Suspense>
    </div>
  );
}

interface TransactionHistoryWithBlocksProps {
  initialAddress?: string;
}

export function TransactionHistoryWithBlocks({ initialAddress = '' }: TransactionHistoryWithBlocksProps) {
  const [viewMode, setViewMode] = React.useState<'transactions' | 'nfts' | 'rewards' | 'balances'>('transactions');
  const [address, setAddress] = React.useState(initialAddress);
  const [submittedAddress, setSubmittedAddress] = React.useState(initialAddress);

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
    } catch {
      return false;
    }
  }, []);

  const { totalCount: holdingsTotalCount } = useTokenBalances(submittedAddress, 1);
  const { totalCount: nftsTotalCount } = useNftCountByOwner(submittedAddress);

  React.useEffect(() => {
    if (!submittedAddress) {
      setTabCounts({ transactions: null, holdings: null, nfts: null });
      return;
    }

    setTabCounts({ transactions: null, holdings: null, nfts: null });
    try {
      void import('./BalancesTable');
      void import('./NftGallery');
    } catch {
      // ignore
    }
  }, [submittedAddress]);

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
    } catch {
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
      } catch {}
    }

    setSubmittedAddress(input);
  };

  // Subcomponent removed from inline scope; using top-level TransactionsView instead.

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header with Live Updates badge */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Transaction History</h1>
            <p className="text-gray-500">
              All wallet transactions with real-time updates
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">Live Updates</span>
          </div>
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
          viewMode === 'transactions' ? (
            <TransactionsView
              addr={submittedAddress}
              onCountsChange={(counts) => {
                const value = typeof counts.totalCount === 'number' ? counts.totalCount : counts.loadedCount;
                setTabCounts((prev) => {
                  if (!Number.isFinite(value)) return prev;
                  if (typeof counts.totalCount !== 'number' && value === 0 && typeof prev.transactions === 'number' && prev.transactions > 0) return prev;
                  return { ...prev, transactions: value };
                });
              }}
            />
          ) : viewMode === 'nfts' ? (
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
          ) : viewMode === 'balances' ? (
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
          ) : (
            <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              <RewardsTable address={submittedAddress} />
            </React.Suspense>
          )
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">Please enter an address to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
