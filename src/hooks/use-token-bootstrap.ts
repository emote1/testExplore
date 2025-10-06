import { useEffect } from 'react';
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
  dbg?: (...args: any[]) => void;
}

const ENABLE_USDC_BOOTSTRAP = ((import.meta as any).env?.VITE_ENABLE_USDC_BOOTSTRAP === '1'
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
  }, [effectiveStrict, tokenFilter, serverTokenIds, setServerTokenIds]);

  // MRD: same logic as USDC
  useEffect(() => {
    if (!effectiveStrict) return;
    if (tokenFilter !== 'mrd') return;
    const next = Array.from(new Set<string>([...MRD_ID_SET, ...MRD_SESSION_SET]));
    const tid = (typeof window !== 'undefined') ? window.setTimeout(() => {
      if (!arraysEqual(serverTokenIds, next)) setServerTokenIds(next);
    }, 150) : undefined;
    return () => { if (typeof window !== 'undefined' && tid) window.clearTimeout(tid); };
  }, [effectiveStrict, tokenFilter, serverTokenIds, setServerTokenIds]);

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
      if (dbg) dbg('[ERC20][fallback] activating soft fallback (no items under strict filter)', { tokenFilter });
    }
  }, [effectiveStrict, tokenFilter, isLoading, initialTransactions, softFallbackActive, softFallbackAttempted, serverTokenIds, enforceStrict, setSoftFallbackActive, setSoftFallbackAttempted, dbg]);

  // Exit soft fallback once we have concrete server token ids (observed via session/bootstrap)
  useEffect(() => {
    if (enforceStrict) { if (softFallbackActive) setSoftFallbackActive(false); return; }
    if (!softFallbackActive) return;
    const eligible = (tokenFilter === 'usdc' || tokenFilter === 'mrd');
    if (!effectiveStrict || !eligible) { setSoftFallbackActive(false); return; }
    const discovered = tokenFilter === 'usdc' ? (USDC_SESSION_SET.size > 0) : (MRD_SESSION_SET.size > 0);
    if (discovered) {
      setSoftFallbackActive(false);
      if (dbg) dbg('[ERC20][fallback] discovered ids via session, returning to strict mode');
    }
  }, [softFallbackActive, effectiveStrict, tokenFilter, initialTransactions, enforceStrict, setSoftFallbackActive, dbg]);

  // Bootstrap USDC ids by querying verified contracts by name once when strict filter is enabled
  useEffect(() => {
    if (!effectiveStrict) { setUsdcBootstrapDone(false); return; }
    if (tokenFilter !== 'usdc') { setUsdcBootstrapDone(false); return; }
    if (usdcBootstrapDone) return;
    if (!ENABLE_USDC_BOOTSTRAP) { setUsdcBootstrapDone(true); return; }
    if (!softFallbackActive) return; // запускать только когда строгий фильтр ничего не вернул
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
  }, [effectiveStrict, tokenFilter, apollo, usdcBootstrapDone, softFallbackActive, setUsdcBootstrapDone, setServerTokenIds, serverTokenIds]);

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
}
