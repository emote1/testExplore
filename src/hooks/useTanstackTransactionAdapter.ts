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
import type { TransactionDirection } from '@/utils/transfer-query';
import { transactionColumns } from '../components/transaction-columns';
import { UiTransfer } from '../data/transfer-mapper';
import { PAGINATION_CONFIG } from '../constants/pagination';
import { ApolloError, useApolloClient, type ApolloClient, type NormalizedCacheObject } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { VERIFIED_CONTRACTS_BY_NAME_QUERY } from '@/data/verified-contracts';
import { useTokenUsdPrices, type TokenInput } from '@/hooks/use-token-usd-prices';
import { useReefPrice } from '@/hooks/use-reef-price';

const addressPageMemory = new Map<string, number>();

// Debug flag to trace pagination math; enable only with VITE_TX_PAGINATION_DEBUG=1|true
const DEBUG_TX_PAGINATION = ((import.meta as any).env?.VITE_TX_PAGINATION_DEBUG === '1'
  || (import.meta as any).env?.VITE_TX_PAGINATION_DEBUG === 'true');
  function dbg(...args: any[]) {
    if (!DEBUG_TX_PAGINATION) return;
    // eslint-disable-next-line no-console
    console.debug('[TxPagination]', ...args);
  }

  // Feature flag: bootstrap USDC ids via verifiedContracts query (disabled by default)
  const ENABLE_USDC_BOOTSTRAP = ((import.meta as any).env?.VITE_ENABLE_USDC_BOOTSTRAP === '1'
    || (import.meta as any).env?.VITE_ENABLE_USDC_BOOTSTRAP === 'true');

  // Local storage helpers to persist discovered ERC20 contract ids between sessions
  const STORAGE_AVAILABLE = typeof window !== 'undefined' && !!window.localStorage;
  const USDC_STORAGE_KEY = 'reef.session.usdc.ids.v1';
  const MRD_STORAGE_KEY = 'reef.session.mrd.ids.v1';
  const IDS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  function loadIds(key: string): string[] {
    try {
      if (!STORAGE_AVAILABLE) return [];
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.ids) || typeof parsed.ts !== 'number') return [];
      if (Date.now() - parsed.ts > IDS_TTL_MS) return [];
      return (parsed.ids as string[]).map(s => String(s).toLowerCase()).filter(Boolean);
    } catch { return []; }
  }
  function saveIds(key: string, ids: Set<string>) {
    try {
      if (!STORAGE_AVAILABLE) return;
      const arr = Array.from(ids);
      window.localStorage.setItem(key, JSON.stringify({ ids: arr, ts: Date.now() }));
    } catch { /* ignore */ }
  }

// --- Module-level token sets to avoid re-allocations per render ---
const USDC_ENV_RAW = (import.meta as any)?.env?.VITE_USDC_CONTRACT_IDS as string | undefined;
const USDC_ENV = (USDC_ENV_RAW || '')
  .split(',')
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean);
const USDC_DEFAULTS = ['0x7922d8785d93e692bb584e659b607fa821e6a91a'];
const USDC_ID_SET = new Set<string>(USDC_ENV.length > 0 ? USDC_ENV : USDC_DEFAULTS);
const USDC_SESSION_SET = new Set<string>();
const isUsdcId = (id?: string) => {
  if (!id) return false;
  const s = String(id).toLowerCase();
  return USDC_ID_SET.has(s) || USDC_SESSION_SET.has(s);
};
// Session-level accumulator for any USDC contract ids observed in data (monotonic, avoids oscillation)

const MRD_ENV_RAW = (import.meta as any)?.env?.VITE_MRD_CONTRACT_IDS as string | undefined;
const MRD_ENV = (MRD_ENV_RAW || '')
  .split(',')
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean);
const MRD_DEFAULTS = ['0x95a2af50040b7256a4b4c405a4afd4dd573da115'];
const MRD_ID_SET = new Set<string>(MRD_ENV.length > 0 ? MRD_ENV : MRD_DEFAULTS);
const MRD_SESSION_SET = new Set<string>();
const isMrdId = (id?: string) => {
  if (!id) return false;
  const s = String(id).toLowerCase();
  return MRD_ID_SET.has(s) || MRD_SESSION_SET.has(s);
};

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
  /** Which of the known tokens are present in the loaded dataset */
  availableTokens: { reef: boolean; usdc: boolean; mrd: boolean };
}

// Token filter supports special keywords 'all' and 'reef', legacy 'usdc',
// and any EVM contract address (0x...).
type TokenFilter = string;

export function useTanstackTransactionAdapter(
  address: string,
  direction: TransactionDirection = 'any',
  minReefRaw?: string | bigint | null,
  maxReefRaw?: string | bigint | null,
  tokenFilter: TokenFilter = 'all',
  tokenMinRaw?: string | null,
  tokenMaxRaw?: string | null,
  strictServerTokenFilter: boolean = false,
  swapOnly: boolean = false,
): TanstackTransactionAdapterReturn {
  const apollo = useApolloClient();
  // Enforce strict server token filter by default for USDC/MRD and custom 0x tokens
  const enforceStrict = (tokenFilter === 'usdc' || tokenFilter === 'mrd' || /^0x[0-9a-fA-F]{40}$/.test(tokenFilter));
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
    const isHex = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);
    if (tokenFilter === 'usdc') return Array.from(new Set<string>([...USDC_ID_SET, ...USDC_SESSION_SET]));
    if (tokenFilter === 'mrd') return Array.from(new Set<string>([...MRD_ID_SET, ...MRD_SESSION_SET]));
    if (isHex(tokenFilter)) return [tokenFilter];
    return null;
  });
  const [usdcBootstrapDone, setUsdcBootstrapDone] = useState<boolean>(false);
  // Soft fallback: if strict server token filter yields empty page for USDC,
  // temporarily disable server token ids and filter on client to discover ids,
  // then return to strict once ids are known.
  const [softFallbackActive, setSoftFallbackActive] = useState<boolean>(false);
  const [softFallbackAttempted, setSoftFallbackAttempted] = useState<boolean>(false);

  // Determine server-side token constraints when strict filter is enabled (computed post-load)
  const isHexAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);
  function arraysEqual(a: string[] | null, b: string[] | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
    return true;
  }

  // Use effective server token ids (null when soft fallback is active)
  const effectiveServerTokenIds = softFallbackActive ? null : serverTokenIds;

  // Compute dynamic API page size: when strict token ids are applied and direction is not 'any', use smaller page size
  const apiPageSize = useMemo((): number => {
    let n: number = PAGINATION_CONFIG.API_FETCH_PAGE_SIZE as unknown as number;
    // Swap mode: use smaller pages to reduce payload per request
    if (swapOnly) n = Math.min(n, 20);
    if (effectiveServerTokenIds && direction !== 'any') n = Math.min(n, 30);
    return n;
  }, [effectiveServerTokenIds, direction, swapOnly]);

  // When in soft fallback mode for a specific token, narrow to ERC20 only
  const erc20Only = useMemo(() => {
    return softFallbackActive && (tokenFilter === 'usdc' || tokenFilter === 'mrd' || isHexAddress(tokenFilter));
  }, [softFallbackActive, tokenFilter]);

  // When swapOnly is true, use reef-swap path instead of transfers
  // Disable swap events fetching when not on Swap tab to avoid extra network traffic
  const swapAdapter = useSwapEvents(swapOnly ? address : null, apiPageSize, swapOnly);
  const baseAdapter = useTransactionDataWithBlocks(
    (swapOnly ? null : address),
    apiPageSize,
    direction,
    minReefRaw,
    maxReefRaw,
    tokenFilter === 'reef',
    effectiveServerTokenIds,
    (effectiveServerTokenIds ? (tokenMinRaw ?? null) : null),
    (effectiveServerTokenIds ? (tokenMaxRaw ?? null) : null),
    erc20Only,
    swapOnly,
  );

  const initialTransactions = useMemo(() => (swapOnly ? (swapAdapter.items || []) : (baseAdapter.transfers || [])), [swapOnly, swapAdapter.items, baseAdapter.transfers]);
  const isLoading = swapOnly ? swapAdapter.loading : baseAdapter.loading;
  const error = swapOnly ? (swapAdapter.error as any) : baseAdapter.error;
  const fetchMore = swapOnly ? swapAdapter.fetchMore : baseAdapter.fetchMore;
  const hasNextPage = swapOnly ? swapAdapter.hasMore : baseAdapter.hasMore;
  const totalCount = swapOnly ? undefined : baseAdapter.totalCount;
  const fetchWindow = baseAdapter.fetchWindow;

  // Reset serverTokenIds when strict filter is off or token group is not supported
  useEffect(() => {
    if (!effectiveStrict || tokenFilter === 'all' || tokenFilter === 'reef') {
      if (!arraysEqual(serverTokenIds, null)) setServerTokenIds(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStrict, tokenFilter]);

  // Hex address: update once on filter change, preserve checksum casing
  useEffect(() => {
    if (!effectiveStrict) return;
    if (!isHexAddress(tokenFilter)) return;
    const next = [tokenFilter];
    const tid = (typeof window !== 'undefined') ? window.setTimeout(() => {
      if (!arraysEqual(serverTokenIds, next)) setServerTokenIds(next);
    }, 150) : undefined;
    return () => { if (typeof window !== 'undefined' && tid) window.clearTimeout(tid); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStrict, tokenFilter]);

  // Seed ids immediately when strict filter is enabled to avoid initial query without tokenIds
  useEffect(() => {
    if (!effectiveStrict) return;
    if (serverTokenIds && serverTokenIds.length > 0) return;
    const isHex = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);
    if (tokenFilter === 'usdc') {
      const next = Array.from(new Set<string>([...USDC_ID_SET, ...USDC_SESSION_SET]));
      if (next.length > 0 && !arraysEqual(serverTokenIds, next)) {
        setServerTokenIds(next);
        if (softFallbackActive) setSoftFallbackActive(false);
      }
    } else if (tokenFilter === 'mrd') {
      const next = Array.from(new Set<string>([...MRD_ID_SET, ...MRD_SESSION_SET]));
      if (next.length > 0 && !arraysEqual(serverTokenIds, next)) {
        setServerTokenIds(next);
        if (softFallbackActive) setSoftFallbackActive(false);
      }
    } else if (isHex(tokenFilter)) {
      const next = [tokenFilter];
      if (!arraysEqual(serverTokenIds, next)) {
        setServerTokenIds(next);
        if (softFallbackActive) setSoftFallbackActive(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStrict, tokenFilter]);

  // On first mount, load persisted session ids
  useEffect(() => {
    const usdc = loadIds(USDC_STORAGE_KEY);
    for (const id of usdc) USDC_SESSION_SET.add(id);
    const mrd = loadIds(MRD_STORAGE_KEY);
    for (const id of mrd) MRD_SESSION_SET.add(id);
  }, []);

  // USDC: use stable, predefined id set (unioned with any session-observed USDC ids) to avoid oscillation
  useEffect(() => {
    if (!effectiveStrict) return;
    if (tokenFilter !== 'usdc') return;
    const next = Array.from(new Set<string>([...USDC_ID_SET, ...USDC_SESSION_SET]));
    const tid = (typeof window !== 'undefined') ? window.setTimeout(() => {
      if (!arraysEqual(serverTokenIds, next)) setServerTokenIds(next);
    }, 150) : undefined;
    return () => { if (typeof window !== 'undefined' && tid) window.clearTimeout(tid); };
  }, [effectiveStrict, tokenFilter, serverTokenIds]);

  // MRD: same logic as USDC
  useEffect(() => {
    if (!effectiveStrict) return;
    if (tokenFilter !== 'mrd') return;
    const next = Array.from(new Set<string>([...MRD_ID_SET, ...MRD_SESSION_SET]));
    const tid = (typeof window !== 'undefined') ? window.setTimeout(() => {
      if (!arraysEqual(serverTokenIds, next)) setServerTokenIds(next);
    }, 150) : undefined;
    return () => { if (typeof window !== 'undefined' && tid) window.clearTimeout(tid); };
  }, [effectiveStrict, tokenFilter, serverTokenIds]);

  // Activate soft fallback when strict USDC/MRD filter returns no items on first load
  useEffect(() => {
    // Disable soft fallback for enforced strict tokens (USDC/MRD/custom 0x)
    if (enforceStrict) {
      if (softFallbackActive) setSoftFallbackActive(false);
      if (softFallbackAttempted) setSoftFallbackAttempted(false);
      return;
    }
    const eligible = (tokenFilter === 'usdc' || tokenFilter === 'mrd');
    if (!effectiveStrict || !eligible) {
      if (softFallbackActive) setSoftFallbackActive(false);
      if (softFallbackAttempted) setSoftFallbackAttempted(false);
      return;
    }
    if (isLoading) return;
    // Включать fallback только после попытки строгого фильтра (когда ids известны)
    if (!serverTokenIds || serverTokenIds.length === 0) return;
    const count = (initialTransactions || []).length;
    if (count === 0 && !softFallbackActive && !softFallbackAttempted) {
      setSoftFallbackActive(true);
      setSoftFallbackAttempted(true);
      if (DEBUG_TX_PAGINATION) console.debug('[ERC20][fallback] activating soft fallback (no items under strict filter)', { tokenFilter });
    }
  }, [effectiveStrict, tokenFilter, isLoading, initialTransactions, softFallbackActive, softFallbackAttempted, serverTokenIds]);

  // Exit soft fallback once we have concrete server token ids (observed via session/bootstrap)
  useEffect(() => {
    if (enforceStrict) { if (softFallbackActive) setSoftFallbackActive(false); return; }
    if (!softFallbackActive) return;
    const eligible = (tokenFilter === 'usdc' || tokenFilter === 'mrd');
    if (!effectiveStrict || !eligible) { setSoftFallbackActive(false); return; }
    // Exit fallback only after we've actually observed ids on the page (session sets filled)
    const discovered = tokenFilter === 'usdc' ? (USDC_SESSION_SET.size > 0) : (MRD_SESSION_SET.size > 0);
    if (discovered) {
      setSoftFallbackActive(false);
      if (DEBUG_TX_PAGINATION) console.debug('[ERC20][fallback] discovered ids via session, returning to strict mode');
    }
  }, [softFallbackActive, effectiveStrict, tokenFilter, initialTransactions, enforceStrict]);

  // Bootstrap USDC ids by querying verified contracts by name once when strict filter is enabled
  useEffect(() => {
    if (!effectiveStrict) { setUsdcBootstrapDone(false); return; }
    if (tokenFilter !== 'usdc') { setUsdcBootstrapDone(false); return; }
    if (usdcBootstrapDone) return;
    // Only attempt bootstrap if feature is enabled AND strict filter явно не дал результатов (soft fallback активен)
    if (!ENABLE_USDC_BOOTSTRAP) { setUsdcBootstrapDone(true); return; }
    if (!softFallbackActive) return; // запускать только когда строгий фильтр ничего не вернул
    // Если уже нашли id в этой сессии — пропускаем
    if (USDC_SESSION_SET.size > 0) { setUsdcBootstrapDone(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const names = ['USDC', 'USDC.e', 'USD Coin'];
        const { data } = await (apollo as ApolloClient<NormalizedCacheObject>).query({
          query: VERIFIED_CONTRACTS_BY_NAME_QUERY as unknown as TypedDocumentNode<any, any>,
          variables: { names, needle: 'usdc' },
          fetchPolicy: 'cache-first',
          errorPolicy: 'ignore',
        });
        const list = (data?.verifiedContracts ?? []) as Array<{ id?: string; name?: string }>;
        let added = 0;
        for (const it of list) {
          const id = String(it?.id || '').toLowerCase();
          if (!id) continue;
          if (!USDC_SESSION_SET.has(id)) { USDC_SESSION_SET.add(id); added += 1; }
        }
        if (added > 0 && !cancelled) {
          const next = Array.from(new Set<string>([...USDC_ID_SET, ...USDC_SESSION_SET]));
          if (!arraysEqual(serverTokenIds, next)) setServerTokenIds(next);
        }
      } catch (_e) {
        // ignore, fallback to defaults
      } finally {
        if (!cancelled) setUsdcBootstrapDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveStrict, tokenFilter, apollo, usdcBootstrapDone, softFallbackActive]);

  // Observe current page for any tokens named USDC (including synonyms and swap legs) and extend session set
  useEffect(() => {
    if (!effectiveStrict) return;
    if (tokenFilter !== 'usdc') return;
    const list = initialTransactions || [];
    let added = 0;
    const nameSynonyms = new Set(['usdc', 'usdc.e', 'usd coin']);
    for (const t of list) {
      const tok = (t as any)?.token as { id?: string; name?: string } | undefined;
      const addIf = (maybe?: { id?: string; name?: string }) => {
        const id = (maybe?.id || '').toLowerCase();
        if (!id) return;
        const nm = (maybe?.name || '').toString().toLowerCase();
        if (nm && nameSynonyms.has(nm) && !USDC_SESSION_SET.has(id)) { USDC_SESSION_SET.add(id); added += 1; }
      };
      if (tok) addIf(tok);
      const s = (t as any)?.swapInfo;
      if (s) { addIf(s.sold?.token); addIf(s.bought?.token); }
    }
    if (added > 0) {
      const next = Array.from(new Set<string>([...USDC_ID_SET, ...USDC_SESSION_SET]));
      if (!arraysEqual(serverTokenIds, next)) setServerTokenIds(next);
      saveIds(USDC_STORAGE_KEY, USDC_SESSION_SET);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStrict, tokenFilter, initialTransactions]);

  // Observe current page for MRD tokens (case-insensitive) and extend session set
  useEffect(() => {
    if (!effectiveStrict) return;
    if (tokenFilter !== 'mrd') return;
    const list = initialTransactions || [];
    let added = 0;
    const nameSynonyms = new Set(['mrd']);
    for (const t of list) {
      const tok = (t as any)?.token as { id?: string; name?: string } | undefined;
      const addIf = (maybe?: { id?: string; name?: string }) => {
        const id = (maybe?.id || '').toLowerCase();
        if (!id) return;
        const nm = (maybe?.name || '').toString().toLowerCase();
        if (nm && nameSynonyms.has(nm) && !MRD_SESSION_SET.has(id)) { MRD_SESSION_SET.add(id); added += 1; }
      };
      if (tok) addIf(tok);
      const s = (t as any)?.swapInfo;
      if (s) { addIf(s.sold?.token); addIf(s.bought?.token); }
    }
    if (added > 0) {
      const next = Array.from(new Set<string>([...MRD_ID_SET, ...MRD_SESSION_SET]));
      if (!arraysEqual(serverTokenIds, next)) setServerTokenIds(next);
      saveIds(MRD_STORAGE_KEY, MRD_SESSION_SET);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStrict, tokenFilter, initialTransactions]);

  // Client-side filter
  // - In Swap tab (swapOnly=true): include only swap rows
  // - In All transactions: exclude swap rows (show only direct transfers)
  const filteredTransactions = useMemo(() => {
    const all = initialTransactions || [];
    const list = swapOnly
      ? all.filter(t => (t as any).method === 'swap' || (t as any).type === 'SWAP')
      : all.filter(t => (t as any).method !== 'swap' && (t as any).type !== 'SWAP');
    if (tokenFilter === 'all') return list;

    const isReef = (tok?: { name?: string; decimals?: number }) => !!tok && tok.name === 'REEF' && (tok.decimals ?? 18) === 18;

    const isAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);
    const addrLower = isAddress(tokenFilter) ? tokenFilter.toLowerCase() : undefined;

    const minRaw = tokenMinRaw != null && tokenMinRaw !== '' ? BigInt(String(tokenMinRaw)) : null;
    const maxRaw = tokenMaxRaw != null && tokenMaxRaw !== '' ? BigInt(String(tokenMaxRaw)) : null;
    const passesAmt = (amt: bigint): boolean => {
      if (minRaw !== null && amt < minRaw) return false;
      if (maxRaw !== null && amt > maxRaw) return false;
      return true;
    };

    // Name-based fallback when strict server ids are not yet known or soft fallback is active
    const useNameFallback = softFallbackActive || !serverTokenIds || serverTokenIds.length === 0;
    const usdcNameSynonyms = new Set(['usdc', 'usdc.e', 'usd coin']);
    const isUsdcByName = (tok?: { name?: string | null }) => {
      const nm = (tok?.name || '').toString().toLowerCase();
      return !!nm && usdcNameSynonyms.has(nm);
    };

    return list.filter(t => {
      // Helper to test a token match and range against a transfer or swap legs
      if (tokenFilter === 'reef') {
        if (t.method === 'swap' && t.swapInfo) {
          const soldAmt = (t.swapInfo.sold as any).amountBI ?? BigInt(t.swapInfo.sold.amount || '0');
          const boughtAmt = (t.swapInfo.bought as any).amountBI ?? BigInt(t.swapInfo.bought.amount || '0');
          const soldOk = isReef(t.swapInfo.sold.token) && (!minRaw && !maxRaw ? true : passesAmt(soldAmt));
          const boughtOk = isReef(t.swapInfo.bought.token) && (!minRaw && !maxRaw ? true : passesAmt(boughtAmt));
          return soldOk || boughtOk;
        }
        if (!isReef(t.token)) return false;
        const amt = (t as any).amountBI ?? BigInt(t.amount || '0');
        return (!minRaw && !maxRaw) ? true : passesAmt(amt);
      }
      if (tokenFilter === 'usdc') {
        if (t.method === 'swap' && t.swapInfo) {
          const soldAmt = (t.swapInfo.sold as any).amountBI ?? BigInt(t.swapInfo.sold.amount || '0');
          const boughtAmt = (t.swapInfo.bought as any).amountBI ?? BigInt(t.swapInfo.bought.amount || '0');
          const soldOk = (isUsdcId(t.swapInfo.sold.token.id) || (useNameFallback && isUsdcByName(t.swapInfo.sold.token))) && (!minRaw && !maxRaw ? true : passesAmt(soldAmt));
          const boughtOk = (isUsdcId(t.swapInfo.bought.token.id) || (useNameFallback && isUsdcByName(t.swapInfo.bought.token))) && (!minRaw && !maxRaw ? true : passesAmt(boughtAmt));
          return soldOk || boughtOk;
        }
        if (!(isUsdcId(t.token.id) || (useNameFallback && isUsdcByName((t as any).token)))) return false;
        const amt = (t as any).amountBI ?? BigInt(t.amount || '0');
        return (!minRaw && !maxRaw) ? true : passesAmt(amt);
      }
      if (addrLower) {
        if (t.method === 'swap' && t.swapInfo) {
          const soldAmt = (t.swapInfo.sold as any).amountBI ?? BigInt(t.swapInfo.sold.amount || '0');
          const boughtAmt = (t.swapInfo.bought as any).amountBI ?? BigInt(t.swapInfo.bought.amount || '0');
          const soldOk = String(t.swapInfo.sold.token.id || '').toLowerCase() === addrLower && (!minRaw && !maxRaw ? true : passesAmt(soldAmt));
          const boughtOk = String(t.swapInfo.bought.token.id || '').toLowerCase() === addrLower && (!minRaw && !maxRaw ? true : passesAmt(boughtAmt));
          return soldOk || boughtOk;
        }
        if (String(t.token.id || '').toLowerCase() !== addrLower) return false;
        const amt = (t as any).amountBI ?? BigInt(t.amount || '0');
        return (!minRaw && !maxRaw) ? true : passesAmt(amt);
      }
      return true;
    });
  }, [initialTransactions, tokenFilter, tokenMinRaw, tokenMaxRaw, softFallbackActive, serverTokenIds, swapOnly]);

  // Expose presence of specific tokens in the currently loaded dataset for dynamic UI options
  const availableTokens = useMemo(() => {
    const list = initialTransactions || [];
    if (list.length === 0) return { reef: false, usdc: false, mrd: false };

    const isReef = (tok?: { name?: string; decimals?: number }) => !!tok && tok.name === 'REEF' && (tok.decimals ?? 18) === 18;

    // Use module-level helpers for USDC/MRD id checks

    let reef = false, usdc = false, mrd = false;
    for (const t of list) {
      // direct token
      if (!reef) reef = isReef((t as any).token);
      if (!usdc) usdc = isUsdcId((t as any)?.token?.id);
      if (!mrd) mrd = isMrdId((t as any)?.token?.id);
      // swap legs
      if ((t as any)?.swapInfo) {
        const s = (t as any).swapInfo.sold?.token;
        const b = (t as any).swapInfo.bought?.token;
        if (!reef) reef = isReef(s) || isReef(b);
        if (!usdc) usdc = isUsdcId(s?.id) || isUsdcId(b?.id);
        if (!mrd) mrd = isMrdId(s?.id) || isMrdId(b?.id);
      }
      if (reef && usdc && mrd) break;
    }
    return { reef, usdc, mrd };
  }, [initialTransactions]);

  // Apollo cache is the single source of truth; pages are merged by typePolicies

  // Virtual shift anchor: keep view stable when new items prepend
  const [anchorFirstId, setAnchorFirstId] = useState<string | undefined>(undefined);
  // Reset anchor when address changes
  useEffect(() => {
    dbg('anchor: reset due to address change', { address });
    setAnchorFirstId(undefined);
  }, [address]);

  // Reset anchor and page index when direction or min/max REEF or token filter changes
  useEffect(() => {
    dbg('anchor: reset due to direction/min/max/token change', { direction, minReefRaw, maxReefRaw, tokenFilter });
    setAnchorFirstId(undefined);
    setPagination(p => ({ ...p, pageIndex: 0 }));
  }, [direction, minReefRaw, maxReefRaw, tokenFilter]);

  // Disable client sorting entirely; server provides ordering when needed
  useEffect(() => {
    setSorting([]);
  }, [minReefRaw, maxReefRaw, tokenFilter]);

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
  // Disabled for filtered views to avoid inconsistencies
  const fastModeActive = useMemo(() => {
    return (tokenFilter === 'all' && !swapOnly) && !!PAGINATION_CONFIG.ENABLE_FAST_OFFSET_MODE && (pagination.pageIndex >= PAGINATION_CONFIG.FAST_OFFSET_MODE_THRESHOLD_PAGES);
  }, [pagination.pageIndex, tokenFilter, swapOnly]);

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

  // All view now excludes swaps server-side, so it can rely on exact total like REEF
  const hasExactTotal = useMemo(
    () => ((((tokenFilter === 'all') && !swapOnly) || tokenFilter === 'reef') && typeof totalCount === 'number' && Number.isFinite(totalCount)),
    [totalCount, tokenFilter, swapOnly]
  );
  const pageCount = useMemo(() => {
    // Prefer exact total if available; adjust for virtual anchor shift
    const size = pagination.pageSize;
    const effectiveTotal = hasExactTotal
      ? Math.max(0, (totalCount as number))
      : undefined;

    if (hasExactTotal) {
      const computed = Math.ceil((effectiveTotal ?? 0) / size);
      // If we're in All mode and have reached the end (no next page),
      // clamp to the number of aggregated UI rows actually loaded to avoid phantom pages
      let adjusted = computed;
      if (tokenFilter === 'all' && !hasNextPage) {
        const aggTotal = Math.max(0, (initialTransactions || []).length - (newItemsCount || 0));
        const aggPages = Math.ceil(aggTotal / size);
        adjusted = Math.min(computed, Math.max(aggPages, pagination.pageIndex + 1));
      }
      // Never report less than the current page (prevents transient shrink)
      return Math.max(adjusted, pagination.pageIndex + 1);
    }

    // Fallback heuristic
    if (swapOnly) {
      // Treat Swap-only like All-mode for navigation with phantom next page
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

  const dataForCurrentPage = useMemo(() => {
    if (fastModeActive && fastPageData) {
      return fastPageData;
    }
    const { pageIndex, pageSize } = pagination;
    // Treat non-swap views as filtered: we exclude SWAP rows from All/Incoming/Outgoing
    const isFiltered = (tokenFilter !== 'all') || swapOnly || true;
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
      pushTok((t as any)?.token);
      if ((t as any)?.swapInfo) {
        pushTok((t as any).swapInfo.sold?.token);
        pushTok((t as any).swapInfo.bought?.token);
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
  }, [pagination.pageIndex, pagination.pageSize, newItemsCount, filteredTransactions, tokenFilter, swapOnly]);

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
    // Treat non-swap views as filtered
    const isFiltered = (tokenFilter !== 'all') || swapOnly || true;
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
  }, [pagination.pageIndex, pagination.pageSize, filteredTransactions, hasNextPage, tokenFilter, swapOnly]);

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
  useEffect(() => {
    if (fastModeActive) return; // skip sequential ensure loop in fast mode
    // Run ensureLoaded for swapOnly too, to pull more reef-swap pages when user navigates
    let cancelled = false;
    const seq = (ensureSeqRef.current = (ensureSeqRef.current ?? 0) + 1);
    ensureMaxedRef.current = false;

    async function run() {
      // Avoid overlapping runs
      if (inFlightEnsureRef.current) return;

      const { pageIndex, pageSize } = pagination;
      const ladderPages = swapOnly ? 1 : Math.max(1, PAGINATION_CONFIG.NON_FAST_LADDER_UI_PAGES || 1);
      // Treat non-swap views as filtered
      const isFilteredMode = (tokenFilter !== 'all') || swapOnly || true;
      // For filtered/swap views, we need enough FILTERED rows to fill the target window
      const requiredCount = isFilteredMode
        ? (pageIndex + ladderPages) * pageSize
        : (newItemsCount + (pageIndex + ladderPages) * pageSize);
      let attempts = 0;
      const maxAttempts = (PAGINATION_CONFIG.MAX_SEQUENTIAL_FETCH_PAGES || 20);
      dbg('ensureLoaded: start', {
        pageIndex,
        pageSize,
        requiredCount,
        newItemsCount,
        itemsLoaded: isFilteredMode ? (filteredTransactions || []).length : (initialTransactions || []).length,
        hasNextPage,
      });

      // Loop while we need more items and we can fetch more
      while (!cancelled) {
        const itemsLoaded = isFilteredMode ? (filteredTransactions || []).length : (initialTransactions || []).length;
        // For swapOnly/filtered views allow fetching even when base list is empty
        if (!isFilteredMode) {
          if (!initialTransactions || initialTransactions.length === 0) { dbg('ensureLoaded: base query not ready'); break; }
        }
        if (itemsLoaded >= requiredCount) break;
        if (!hasNextPage) break;
        if (attempts >= maxAttempts) break;

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

      ensureMaxedRef.current = (attempts >= maxAttempts) || !hasNextPage;
      dbg('ensureLoaded: end', { attempts, maxed: ensureMaxedRef.current });
    }

    run();

    return () => {
      cancelled = true;
      // bump seq to signal abandonment to any in-flight run
      ensureSeqRef.current = (ensureSeqRef.current ?? 0) + 1;
    };
  }, [pagination.pageIndex, pagination.pageSize, initialTransactions, filteredTransactions, tokenFilter, swapOnly, hasNextPage, fetchMore, newItemsCount, fastModeActive]);

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
    // Treat non-swap views as filtered
    const isFilteredMode = (tokenFilter !== 'all') || swapOnly || true;

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
    const minForNext = ((((tokenFilter === 'all') || swapOnly) && hasNextPage) ? clamped + 2 : minForCurrent);
    if ((tokenFilter === 'all') || swapOnly) setPageCountOverride(prev => Math.max(prev || 0, minForNext));
    else setPageCountOverride(0);
    setPagination(p => ({ ...p, pageIndex: clamped }));
  }, [hasNextPage, totalCount, pagination.pageSize, newItemsCount, tokenFilter, swapOnly, filteredTransactions, initialTransactions]);

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
    availableTokens,
  };
}
