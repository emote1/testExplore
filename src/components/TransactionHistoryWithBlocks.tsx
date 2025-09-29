import React from 'react';
import { Loader2, AlertTriangle, ArrowDownRight, ArrowUpRight, Award } from 'lucide-react';
import { useTanstackTransactionAdapter } from '../hooks/useTanstackTransactionAdapter';
import type { UiTransfer } from '../data/transfer-mapper';
import { useTransferSubscription } from '../hooks/useTransferSubscription';
import type { TransactionDirection } from '../utils/transfer-query';
import { isValidEvmAddressFormat, isValidSubstrateAddressFormat } from '../utils/address-helpers';
import { useAddressResolver } from '../hooks/use-address-resolver';
import { formatAmount } from '../utils/formatters';
import { SquidHealthIndicator } from './SquidHealthIndicator';
import { AddressDisplay } from './AddressDisplay';

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
function TransactionsView({ addr }: { addr: string }) {
  const [direction, setDirection] = React.useState<TransactionDirection>('any');
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
  const { table, isLoading, error, showNewItems, goToPage, isPageLoading, pageLoadProgress, hasExactTotal, fastModeActive } = useTanstackTransactionAdapter(addr, direction, appliedMinRaw, appliedMaxRaw, tokenFilter, appliedTokenMinRaw, appliedTokenMaxRaw, false);

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

  
  const [newTransfers, setNewTransfers] = React.useState<string[]>([]);
  const [toastTransfer, setToastTransfer] = React.useState<UiTransfer | null>(null);
  const toastTimerRef = React.useRef<number | undefined>(undefined);

  // --- URL sync (dir, min) --------------------------------------------------
  // Initialize from URL on first mount
  React.useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      const dir = params.get('dir');
      const min = params.get('min');
      const max = params.get('max');
      const tok = params.get('token');
      if (dir === 'incoming' || dir === 'outgoing' || dir === 'any') setDirection(dir as TransactionDirection);
      if (typeof min === 'string' && min.length > 0) setMinReefInput(min);
      if (typeof max === 'string' && max.length > 0) setMaxReefInput(max);
      if (tok === 'reef' || tok === 'usdc' || tok === 'all') setTokenFilter(tok as any);
      else if (typeof tok === 'string' && /^0x[0-9a-fA-F]{40}$/.test(tok)) setTokenFilter(tok);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect changes back to URL (replaceState) when direction/min/max/token changes
  React.useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      // Update dir
      if (direction && direction !== 'any') params.set('dir', direction);
      else params.delete('dir');
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
  }, [direction, debouncedMinReefInput, debouncedMaxReefInput, tokenFilter]);

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

  return (
    <>
      {/* Detailed API health indicator at the top */}
      <div className="mb-3">
        <SquidHealthIndicator />
      </div>
      {/* Direction + Token + Min/Max REEF filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Direction:</span>
          <div className="inline-flex rounded-md shadow-sm border overflow-hidden" role="group">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm ${direction === 'any' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setDirection('any')}
            >All</button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm border-l ${direction === 'incoming' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setDirection('incoming')}
            >Incoming</button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm border-l ${direction === 'outgoing' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setDirection('outgoing')}
            >Outgoing</button>
          </div>
          <span className="ml-4 text-sm text-gray-600">Token:</span>
          <select
            className="ml-2 px-3 py-1.5 text-sm border rounded-md bg-white text-gray-700 hover:bg-gray-50"
            value={tokenFilter}
            onChange={(e) => setTokenFilter(e.target.value)}
            title="Filter by token contract"
          >
            {tokenOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-start gap-6 flex-wrap">
          <div className="flex flex-col">
            <label className="mt-2 mb-1 text-sm text-gray-600" htmlFor="min-reef-input">Min {selectedTokenLabel}:</label>
            <div className="flex items-center gap-2">
              <input
                id="min-reef-input"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 10, 10000"
                value={minReefInput}
                onChange={(e) => setMinReefInput(e.target.value)}
                disabled={isAllMode}
                title={isAllMode ? 'Select a token to enable amount filter' : undefined}
                className={`w-40 px-2 py-1 border rounded-md focus:outline-none focus:ring-2 ${isAllMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : (isMinReefInvalid ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500')}`}
                aria-invalid={isMinReefInvalid}
              />
              {minReefInput ? (
                <button
                  type="button"
                  className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                  onClick={() => setMinReefInput('')}
                >Reset</button>
              ) : null}
            </div>
            {/* Quick presets */}
            <div className="mt-2 flex flex-wrap gap-2">
              {['100', '1000', '10000', '100000'].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${!isReefMode
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : (debouncedMinReefInput === v
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-600'
                      : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50')}`}
                  onClick={() => { if (isReefMode) setMinReefInput(v); }}
                  disabled={!isReefMode}
                >{v === '1000' ? '1k' : v === '10000' ? '10k' : v === '100000' ? '100k' : v}</button>
              ))}
            </div>
            {isMinReefInvalid ? (
              <p className="mt-1 text-xs text-red-600">Введите число с разделителем . или , (до {selectedTokenDecimals} знаков после запятой)</p>
            ) : null}
          </div>
          <div className="flex flex-col">
            <label className="mt-2 mb-1 text-sm text-gray-600" htmlFor="max-reef-input">Max {selectedTokenLabel}:</label>
            <div className="flex items-center gap-2">
              <input
                id="max-reef-input"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 1000, 50000"
                value={maxReefInput}
                onChange={(e) => setMaxReefInput(e.target.value)}
                disabled={isAllMode}
                title={isAllMode ? 'Select a token to enable amount filter' : undefined}
                className={`w-40 px-2 py-1 border rounded-md focus:outline-none focus:ring-2 ${isAllMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : (isMaxReefInvalid ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500')}`}
                aria-invalid={isMaxReefInvalid}
              />
              {maxReefInput ? (
                <button
                  type="button"
                  className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                  onClick={() => setMaxReefInput('')}
                >Reset</button>
              ) : null}
            </div>
            {isMaxReefInvalid ? (
              <p className="mt-1 text-xs text-red-600">Введите число с разделителем . или , (до {selectedTokenDecimals} знаков после запятой)</p>
            ) : null}
          </div>
          {isRangeInvalid ? (
            <div className="mt-3 text-xs text-red-600">Min {selectedTokenLabel} должен быть меньше или равен Max {selectedTokenLabel}</div>
          ) : null}
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-4 p-4 mb-4 text-red-700 bg-red-100 rounded-lg shadow">
          <AlertTriangle className="h-6 w-6" />
          <div>
            <h3 className="font-bold">Error Fetching Transactions</h3>
            <p>{error.message}</p>
          </div>
        </div>
      )}
      {toastTransfer && (
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
      )}
      <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
        <TransactionTableWithTanStack
          table={table}
          isLoading={isLoading}
          newTransfers={newTransfers}
          goToPage={goToPage}
          isPageLoading={isPageLoading}
          pageLoadProgress={pageLoadProgress}
          hasExactTotal={hasExactTotal}
          fastModeActive={fastModeActive}
          emptyHint={emptyHint}
        />
      </React.Suspense>
    </>
  );
}

interface TransactionHistoryWithBlocksProps {
  initialAddress?: string;
}

export function TransactionHistoryWithBlocks({ initialAddress = '' }: TransactionHistoryWithBlocksProps) {
  const [viewMode, setViewMode] = React.useState<'transactions' | 'nfts' | 'rewards' | 'balances'>('transactions');
  const [address, setAddress] = React.useState(initialAddress);
  const [submittedAddress, setSubmittedAddress] = React.useState(initialAddress);

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
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Transaction History</h1>
        <p className="text-gray-600 mb-6">
          Enter a Reef address to view its transaction history.
        </p>

                <form onSubmit={handleSubmit} className="flex items-center gap-4 mb-6 p-4 bg-white rounded-lg shadow">
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
          <div className="flex mb-4 border-b">
            <button
              className={`px-4 py-2 -mb-px font-semibold border-b-2 ${
                viewMode === 'transactions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setViewMode('transactions')}
            >
              Transactions
            </button>
            <button
              className={`px-4 py-2 -mb-px font-semibold border-b-2 ${
                viewMode === 'nfts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setViewMode('nfts')}
              data-testid="tab-nfts"
            >
              NFTs
            </button>
            <button
              className={`px-4 py-2 -mb-px font-semibold border-b-2 ${
                viewMode === 'rewards'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setViewMode('rewards')}
              data-testid="tab-rewards"
            >
              <span className="inline-flex items-center gap-2"><Award className="h-4 w-4" /> Rewards</span>
            </button>
            <button
              className={`px-4 py-2 -mb-px font-semibold border-b-2 ${
                viewMode === 'balances'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setViewMode('balances')}
              data-testid="tab-balances"
            >
              Balances
            </button>
          </div>
        )}

        {submittedAddress ? (
          viewMode === 'transactions' ? (
            <TransactionsView addr={submittedAddress} />
          ) : viewMode === 'nfts' ? (
            <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              <NftGallery address={submittedAddress} enableOwnerInfinite={enableOwnerInfiniteFlag} />
            </React.Suspense>
          ) : viewMode === 'balances' ? (
            <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              <BalancesTable address={submittedAddress} />
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
