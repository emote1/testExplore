import { useEffect, useRef } from 'react';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { UiTransfer } from '@/data/transfer-mapper';
import { VERIFIED_CONTRACTS_BY_NAME_QUERY } from '@/data/verified-contracts';
import {
  USDC_ID_SET,
  USDC_SESSION_SET,
  MRD_ID_SET,
  MRD_SESSION_SET,
  loadIds,
  saveIds,
  USDC_STORAGE_KEY,
  MRD_STORAGE_KEY,
} from '@/tokens/token-ids';

interface Args {
  effectiveStrict: boolean;
  tokenFilter: string;
  enforceStrict: boolean;
  isLoading: boolean;
  initialTransactions?: UiTransfer[] | null;
  serverTokenIds: string[] | null;
  setServerTokenIds: (val: string[] | null) => void;
  softFallbackActive: boolean;
  setSoftFallbackActive: (val: boolean) => void;
  softFallbackAttempted: boolean;
  setSoftFallbackAttempted: (val: boolean) => void;
  apollo: ApolloClient<NormalizedCacheObject>;
  usdcBootstrapDone: boolean;
  setUsdcBootstrapDone: (val: boolean) => void;
  dbg?: (...args: unknown[]) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENABLE_USDC_BOOTSTRAP = ((import.meta as any).env?.VITE_ENABLE_USDC_BOOTSTRAP === '1'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  || (import.meta as any).env?.VITE_ENABLE_USDC_BOOTSTRAP === 'true');

function arraysEqual(a: string[] | null, b: string[] | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

const isHexAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

export function useTokenBootstrap({
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
  apollo,
  usdcBootstrapDone,
  setUsdcBootstrapDone,
  dbg,
}: Args) {
  // Use refs to track current state values for comparison in effects without adding them to dependencies.
  // This prevents infinite loops when state updates are based on current state.
  const serverTokenIdsRef = useRef(serverTokenIds);
  useEffect(() => {
    serverTokenIdsRef.current = serverTokenIds;
  }, [serverTokenIds]);

  const usdcBootstrapDoneRef = useRef(usdcBootstrapDone);
  useEffect(() => {
    usdcBootstrapDoneRef.current = usdcBootstrapDone;
  }, [usdcBootstrapDone]);

  // Reset serverTokenIds when strict filter is off or token group is not supported
  useEffect(() => {
    if (!effectiveStrict || tokenFilter === 'all' || tokenFilter === 'reef') {
      if (serverTokenIdsRef.current !== null) {
        setServerTokenIds(null);
      }
    }
  }, [effectiveStrict, tokenFilter, setServerTokenIds]);

  // Hex address: update once on filter change, preserve checksum casing
  useEffect(() => {
    if (!effectiveStrict) return;
    if (!isHexAddress(tokenFilter)) return;
    const next = [tokenFilter];
    const tid = (typeof window !== 'undefined') ? window.setTimeout(() => {
      if (!arraysEqual(serverTokenIdsRef.current, next)) {
        setServerTokenIds(next);
      }
    }, 150) : undefined;
    return () => { if (typeof window !== 'undefined' && tid) window.clearTimeout(tid); };
  }, [effectiveStrict, tokenFilter, setServerTokenIds]);

  // Seed ids immediately when strict filter is enabled to avoid initial query without tokenIds
  useEffect(() => {
    if (!effectiveStrict) return;
    if (serverTokenIdsRef.current && serverTokenIdsRef.current.length > 0) return;
    if (tokenFilter === 'usdc') {
      const next = Array.from(new Set<string>([...USDC_ID_SET, ...USDC_SESSION_SET]));
      if (next.length > 0 && !arraysEqual(serverTokenIdsRef.current, next)) {
        setServerTokenIds(next);
        if (softFallbackActive) setSoftFallbackActive(false);
      }
    } else if (tokenFilter === 'mrd') {
      const next = Array.from(new Set<string>([...MRD_ID_SET, ...MRD_SESSION_SET]));
      if (next.length > 0 && !arraysEqual(serverTokenIdsRef.current, next)) {
        setServerTokenIds(next);
        if (softFallbackActive) setSoftFallbackActive(false);
      }
    } else if (isHexAddress(tokenFilter)) {
      const next = [tokenFilter];
      if (!arraysEqual(serverTokenIdsRef.current, next)) {
        setServerTokenIds(next);
        if (softFallbackActive) setSoftFallbackActive(false);
      }
    }
  }, [effectiveStrict, tokenFilter, softFallbackActive, setServerTokenIds, setSoftFallbackActive]);

  // On first mount, load persisted session ids
  useEffect(() => {
    const usdc = loadIds(USDC_STORAGE_KEY);
    for (const id of usdc) USDC_SESSION_SET.add(id);
    const mrd = loadIds(MRD_STORAGE_KEY);
    for (const id of mrd) MRD_SESSION_SET.add(id);
  }, []);

  // USDC/MRD: update server ids if session set changes (observed via page rows)
  useEffect(() => {
    if (!effectiveStrict) return;
    if (tokenFilter !== 'usdc' && tokenFilter !== 'mrd') return;
    const next = tokenFilter === 'usdc' 
      ? Array.from(new Set<string>([...USDC_ID_SET, ...USDC_SESSION_SET]))
      : Array.from(new Set<string>([...MRD_ID_SET, ...MRD_SESSION_SET]));
    const tid = (typeof window !== 'undefined') ? window.setTimeout(() => {
      if (!arraysEqual(serverTokenIdsRef.current, next)) {
        setServerTokenIds(next);
      }
    }, 150) : undefined;
    return () => { if (typeof window !== 'undefined' && tid) window.clearTimeout(tid); };
  }, [effectiveStrict, tokenFilter, setServerTokenIds]);

  // Activate soft fallback when strict USDC/MRD filter returns no items on first load
  useEffect(() => {
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
    if (!serverTokenIdsRef.current || serverTokenIdsRef.current.length === 0) return;
    const count = (initialTransactions || []).length;
    if (count === 0 && !softFallbackActive && !softFallbackAttempted) {
      setSoftFallbackActive(true);
      setSoftFallbackAttempted(true);
      if (dbg) dbg('[ERC20][fallback] activating soft fallback (no items under strict filter)', { tokenFilter });
    }
  }, [effectiveStrict, tokenFilter, isLoading, initialTransactions, softFallbackActive, softFallbackAttempted, enforceStrict, setSoftFallbackActive, setSoftFallbackAttempted, dbg]);

  // Exit soft fallback once we have concrete server token ids
  useEffect(() => {
    if (enforceStrict) {
      if (softFallbackActive) setSoftFallbackActive(false);
      return;
    }
    if (!softFallbackActive) return;
    const eligible = (tokenFilter === 'usdc' || tokenFilter === 'mrd');
    if (!effectiveStrict || !eligible) {
      setSoftFallbackActive(false);
      return;
    }
    const discovered = tokenFilter === 'usdc' ? (USDC_SESSION_SET.size > 0) : (MRD_SESSION_SET.size > 0);
    if (discovered) {
      setSoftFallbackActive(false);
      if (dbg) dbg('[ERC20][fallback] discovered ids via session, returning to strict mode');
    }
  }, [softFallbackActive, effectiveStrict, tokenFilter, enforceStrict, setSoftFallbackActive, dbg]);

  // Bootstrap USDC ids
  useEffect(() => {
    if (!effectiveStrict || tokenFilter !== 'usdc') {
      if (usdcBootstrapDoneRef.current) setUsdcBootstrapDone(false);
      return;
    }
    if (usdcBootstrapDoneRef.current) return;
    if (!ENABLE_USDC_BOOTSTRAP) {
      setUsdcBootstrapDone(true);
      return;
    }
    if (!softFallbackActive) return;
    if (USDC_SESSION_SET.size > 0) {
      setUsdcBootstrapDone(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const names = ['USDC', 'USDC.e', 'USD Coin'];
        const { data } = await (apollo as ApolloClient<NormalizedCacheObject>).query({
          query: VERIFIED_CONTRACTS_BY_NAME_QUERY as unknown as TypedDocumentNode,
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
          if (!arraysEqual(serverTokenIdsRef.current, next)) {
            setServerTokenIds(next);
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setUsdcBootstrapDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveStrict, tokenFilter, apollo, softFallbackActive, setUsdcBootstrapDone, setServerTokenIds]);

  // Observe current page for tokens and extend session sets
  useEffect(() => {
    if (!effectiveStrict) return;
    if (tokenFilter !== 'usdc' && tokenFilter !== 'mrd') return;
    const list = initialTransactions || [];
    let added = 0;
    const isUsdc = tokenFilter === 'usdc';
    const nameSynonyms = isUsdc ? new Set(['usdc', 'usdc.e', 'usd coin']) : new Set(['mrd']);
    const sessionSet = isUsdc ? USDC_SESSION_SET : MRD_SESSION_SET;
    const storageKey = isUsdc ? USDC_STORAGE_KEY : MRD_STORAGE_KEY;
    const idSet = isUsdc ? USDC_ID_SET : MRD_ID_SET;
    for (const t of list) {
      const addIf = (maybe?: { id?: string; name?: string }) => {
        const id = (maybe?.id || '').toLowerCase();
        if (!id) return;
        const nm = (maybe?.name || '').toString().toLowerCase();
        if (nm && nameSynonyms.has(nm) && !sessionSet.has(id)) { sessionSet.add(id); added += 1; }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      addIf((t as any)?.token);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = (t as any)?.swapInfo;
      if (s) { addIf(s.sold?.token); addIf(s.bought?.token); }
    }
    if (added > 0) {
      const next = Array.from(new Set<string>([...idSet, ...sessionSet]));
      if (!arraysEqual(serverTokenIdsRef.current, next)) {
        setServerTokenIds(next);
      }
      saveIds(storageKey, sessionSet);
    }
  }, [effectiveStrict, tokenFilter, initialTransactions, setServerTokenIds]);
}