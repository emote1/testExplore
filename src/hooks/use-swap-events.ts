import { useEffect, useState, useCallback, useRef } from 'react';
import type { UiTransfer } from '@/data/transfer-mapper';
import { reefSwapClient } from '@/reef-swap-client';
import { POOL_EVENTS_CONNECTION_DOCUMENT } from '@/data/reef-swap';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { useAddressResolver } from './use-address-resolver';

export interface UseSwapEventsReturn {
  items: UiTransfer[];
  loading: boolean;
  error?: Error;
  hasMore: boolean;
  fetchMore: () => Promise<void>;
}


export function useSwapEvents(address: string | null, pageSize: number, enabled: boolean = true): UseSwapEventsReturn {
  const client = reefSwapClient as ApolloClient<NormalizedCacheObject>;
  const { resolveEvmAddress } = useAddressResolver();
  const [items, setItems] = useState<UiTransfer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [after, setAfter] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [resolvedUser, setResolvedUser] = useState<string>(address || '');
  const initInFlightRef = useRef(false);
  const fetchMoreInFlightRef = useRef(false);
  const initKeyRef = useRef<string | null>(null);

  const isEvmAddr = (s?: string | null) => !!s && /^0x[0-9a-fA-F]{40}$/.test(String(s));

  // Resolve substrate to EVM address (reef-swap uses EVM addresses)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!address) { if (!cancelled) setResolvedUser(''); return; }
        const evm = await resolveEvmAddress(address);
        if (!cancelled) setResolvedUser(evm || address);
      } catch {
        if (!cancelled) setResolvedUser(address || '');
      }
    })();
    return () => { cancelled = true; };
  }, [address, resolveEvmAddress]);

  const fetchPage = useCallback(async (afterCursor: string | null) => {
    if (!enabled) {
      return { page: [] as UiTransfer[], pageInfo: { hasNextPage: false, endCursor: null as string | null } };
    }
    // Use the adapter-provided pageSize directly (can be 20 in swap-only mode)
    const first = Math.min(100, Math.max(pageSize, 15));
    if (!isEvmAddr(resolvedUser)) {
      return { page: [] as UiTransfer[], pageInfo: { hasNextPage: false, endCursor: null as string | null } };
    }
    const { data } = await client.query({
      query: POOL_EVENTS_CONNECTION_DOCUMENT,
      variables: { first, after: afterCursor, addr: resolvedUser },
      fetchPolicy: 'no-cache',
    });
    const edges = (data?.poolEventsConnection?.edges ?? []) as Array<{ node: any; cursor: string }>;
    // Aggregate two legs of the same swap into a single UI row by base id or (blockHeight,indexInBlock)
    const groups = new Map<string, {
      key: string;
      from: string;
      to: string;
      token1: { id: string; name: string; decimals: number };
      token2: { id: string; name: string; decimals: number };
      blockHeight: number;
      indexInBlock: number;
      timestamp?: string | number | null;
      seen: number;
      hasInputs: boolean;
      // Explicit sold/bought tracking inferred from inputs/outputs
      soldIndex?: 1 | 2; // 1 -> token1, 2 -> token2
      boughtIndex?: 1 | 2;
      soldBI: bigint;
      boughtBI: bigint;
      // Legacy accumulators (kept for fallback when inputs are missing)
      a1BI: bigint; // corresponds to token2
      a2BI: bigint; // corresponds to token1
    }>();
    for (const e of edges) {
      const n = e?.node;
      if (!n || String(n?.type) !== 'Swap') continue;
      const from = String(n?.senderAddress || '');
      const to = String(n?.toAddress || '');
      // Prefer grouping by id base: strip the last numeric segment (…-00001, …-00002) -> same swap
      const rawId = String(n?.id || '');
      const m = /^(.+)-\d+$/.exec(rawId);
      const key = m ? m[1] : `${n?.blockHeight}-${n?.indexInBlock}`;
      const token1 = n?.pool?.token1;
      const token2 = n?.pool?.token2;
      if (!token1 || !token2) continue;
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          from,
          to,
          token1: { id: token1.id, name: token1.name, decimals: token1.decimals },
          token2: { id: token2.id, name: token2.name, decimals: token2.decimals },
          blockHeight: Number(n?.blockHeight || 0),
          indexInBlock: Number(n?.indexInBlock || 0),
          timestamp: (n as any)?.timestamp ?? null,
          seen: 0,
          hasInputs: false,
          soldIndex: undefined,
          boughtIndex: undefined,
          soldBI: 0n,
          boughtBI: 0n,
          a1BI: 0n,
          a2BI: 0n,
        };
        groups.set(key, g);
      }
      // preserve first observed from/to, but if empty, try to fill from subsequent legs
      if (!g.from && from) g.from = from;
      if (!g.to && to) g.to = to;
      if (!g.timestamp && (n as any)?.timestamp) g.timestamp = (n as any).timestamp;
      g.seen += 1;
      // Prefer explicit input fields when available.
      // amountIn1 -> input of token1, amountIn2 -> input of token2
      // amount1  -> output of token1, amount2  -> output of token2 (per reef-explorer schema)
      const bi = (x: any): bigint => { try { const v = BigInt(String(x ?? '0')); return v < 0n ? -v : v; } catch { return 0n; } };
      const in1 = bi(n?.amountIn1);
      const in2 = bi(n?.amountIn2);
      const out1 = bi(n?.amount1);
      const out2 = bi(n?.amount2);
      if (in1 > 0n || in2 > 0n) {
        g.hasInputs = true;
        if (in1 > 0n) {
          // Sold token1 for token2
          g.soldIndex = 1; if (in1 > g.soldBI) g.soldBI = in1;
          g.boughtIndex = 2; if (out2 > g.boughtBI) g.boughtBI = out2;
        } else {
          // Sold token2 for token1
          g.soldIndex = 2; if (in2 > g.soldBI) g.soldBI = in2;
          g.boughtIndex = 1; if (out1 > g.boughtBI) g.boughtBI = out1;
        }
        // Keep legacy accumulators for compatibility
        if (out2 > g.a1BI) g.a1BI = out2; // token2 output when token1 input
        if (out1 > g.a2BI) g.a2BI = out1; // token1 output when token2 input
      } else {
        // Fallback for older schemas without inputs: treat amount1/amount2 as outputs
        try {
          if (n?.amount1 !== undefined && n?.amount1 !== null) {
            const a = bi(n.amount1);
            if (a > g.boughtBI) { g.boughtIndex = 1; g.boughtBI = a; }
            if (a > g.a1BI) g.a1BI = a; // legacy
          }
        } catch {}
        try {
          if (n?.amount2 !== undefined && n?.amount2 !== null) {
            const a = bi(n.amount2);
            if (a > g.boughtBI) { g.boughtIndex = 2; g.boughtBI = a; }
            if (a > g.a2BI) g.a2BI = a; // legacy
          }
        } catch {}
      }
    }
    // No legacy hydration: rely on amountIn*/amount* present in reef-swap schema

    const page = Array.from(groups.values()).map(g => {
      // Prefer explicit sold/bought when inputs were present; else fallback to legacy accumulators
      const soldIdx: 1 | 2 = (g.soldIndex ?? (g.boughtIndex === 1 ? 2 : 1)) as 1 | 2;
      const boughtIdx: 1 | 2 = (g.boughtIndex ?? (soldIdx === 1 ? 2 : 1)) as 1 | 2;
      const soldAmt = (g.hasInputs ? g.soldBI : (soldIdx === 1 ? g.a2BI : g.a1BI)).toString();
      const boughtAmt = (g.hasInputs ? g.boughtBI : (boughtIdx === 2 ? g.a1BI : g.a2BI)).toString();
      const soldTok = soldIdx === 1 ? g.token1 : g.token2;
      const boughtTok = boughtIdx === 2 ? g.token2 : g.token1;

      const t: UiTransfer = {
        id: `${g.key}:swap`,
        from: g.from,
        to: g.to,
        type: 'SWAP',
        method: 'swap',
        amount: boughtAmt,
        isNft: false,
        tokenId: null,
        token: { id: boughtTok.id, name: boughtTok.name, decimals: boughtTok.decimals },
        timestamp: (g.timestamp ?? String(g.blockHeight)) as any,
        success: true,
        extrinsicHash: '',
        feeAmount: '0',
        swapInfo: {
          sold:   { amount: soldAmt,   token: { id: soldTok.id,   name: soldTok.name,   decimals: soldTok.decimals } },
          bought: { amount: boughtAmt, token: { id: boughtTok.id, name: boughtTok.name, decimals: boughtTok.decimals } },
        },
      };
      return t;
    });
    const pageInfoRaw = (data?.poolEventsConnection?.pageInfo ?? {}) as { hasNextPage?: boolean; endCursor?: string | null };
    const nextHas = !!pageInfoRaw?.hasNextPage && (edges.length >= first);
    return { page, pageInfo: { hasNextPage: nextHas, endCursor: pageInfoRaw?.endCursor ?? null } };
  }, [client, pageSize, resolvedUser]);

  // initial load: run once per (resolvedUser,pageSize); scan up to 5 pages to fill one UI page
  useEffect(() => {
    if (!enabled) return;
    if (!resolvedUser) return;
    const key = `${String(resolvedUser).toLowerCase()}|${pageSize}`;
    if (initKeyRef.current === key || initInFlightRef.current) return;
    initInFlightRef.current = true;
    initKeyRef.current = key;
    let cancelled = false;
    setItems([]);
    setAfter(null);
    setHasMore(false);
    setError(undefined);
    setLoading(true);
    if (!isEvmAddr(resolvedUser)) {
      setLoading(false);
      // Important: reset init flags so effect can rerun after resolver maps Substrate->EVM
      initInFlightRef.current = false;
      initKeyRef.current = null;
      return;
    }
    (async () => {
      const MAX_PAGES = 3; // fewer pages for faster initial load
      let curAfter: string | null = null;
      const map = new Map<string, UiTransfer>();
      let lastInfo: { hasNextPage?: boolean; endCursor?: string | null } = {};
      try {
        for (let i = 0; i < MAX_PAGES; i++) {
          const { page, pageInfo } = await fetchPage(curAfter);
          for (const x of page) {
            const prev = map.get(x.id);
            if (!prev) { map.set(x.id, x); continue; }
            try {
              const s = (prev.swapInfo?.sold?.amount ?? '0');
              const b = (prev.swapInfo?.bought?.amount ?? '0');
              const s2 = (x.swapInfo?.sold?.amount ?? '0');
              const b2 = (x.swapInfo?.bought?.amount ?? '0');
              const abs = (v: string) => { try { const bi = BigInt(String(v)); return bi < 0n ? -bi : bi; } catch { return 0n; } };
              const sold = (abs(s2) > abs(s) ? abs(s2) : abs(s)).toString();
              const bought = (abs(b2) > abs(b) ? abs(b2) : abs(b)).toString();
              prev.swapInfo!.sold.amount = sold;
              prev.swapInfo!.bought.amount = bought;
              prev.amount = bought;
            } catch { /* ignore merge errors */ }
          }
          lastInfo = pageInfo;
          curAfter = pageInfo.endCursor ?? null;
          if (map.size >= pageSize || !pageInfo.hasNextPage) break;
        }
        setItems(Array.from(map.values()));
        setAfter(lastInfo.endCursor ?? null);
        setHasMore(!!lastInfo.hasNextPage);
      } catch (e: any) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) { setLoading(false); initInFlightRef.current = false; }
      }
    })();
    return () => { cancelled = true; };
  }, [resolvedUser, pageSize, fetchPage]);

  const fetchMore = useCallback(async () => {
    if (!enabled) return;
    if (!hasMore) return;
    if (fetchMoreInFlightRef.current) return;
    fetchMoreInFlightRef.current = true;
    setLoading(true);
    try {
      const { page, pageInfo } = await fetchPage(after);
      setItems(prev => {
        const map = new Map<string, UiTransfer>();
        for (const p of (Array.isArray(prev) ? prev : [])) map.set(p.id, { ...p });
        for (const x of page) {
          const prevItem = map.get(x.id);
          if (!prevItem) { map.set(x.id, x); continue; }
          try {
            const s = (prevItem.swapInfo?.sold?.amount ?? '0');
            const b = (prevItem.swapInfo?.bought?.amount ?? '0');
            const s2 = (x.swapInfo?.sold?.amount ?? '0');
            const b2 = (x.swapInfo?.bought?.amount ?? '0');
            const sAbs = (() => { try { const v = BigInt(String(s)); return v < 0n ? -v : v; } catch { return 0n; } })();
            const s2Abs = (() => { try { const v = BigInt(String(s2)); return v < 0n ? -v : v; } catch { return 0n; } })();
            const bAbs = (() => { try { const v = BigInt(String(b)); return v < 0n ? -v : v; } catch { return 0n; } })();
            const b2Abs = (() => { try { const v = BigInt(String(b2)); return v < 0n ? -v : v; } catch { return 0n; } })();
            const sold = (s2Abs > sAbs ? s2Abs : sAbs).toString();
            const bought = (b2Abs > bAbs ? b2Abs : bAbs).toString();
            prevItem.swapInfo!.sold.amount = sold;
            prevItem.swapInfo!.bought.amount = bought;
            prevItem.amount = bought;
          } catch { /* ignore merge errors */ }
        }
        return Array.from(map.values());
      });
      setAfter(pageInfo.endCursor);
      setHasMore(pageInfo.hasNextPage);
    } catch (e: any) {
      setError(e as Error);
    } finally {
      setLoading(false);
      fetchMoreInFlightRef.current = false;
    }
  }, [after, hasMore, fetchPage, resolvedUser]);

  // Background idle scan: top-up until we have one UI page or run out of data (hard cap)
  useEffect(() => {
    if (!enabled) return;
    if (!hasMore) return;
    if ((items?.length || 0) >= pageSize) return;
    let cancelled = false;
    let attempts = 0;
    const winAny: any = typeof window !== 'undefined' ? window : {};
    const schedule = () => {
      if (cancelled) return;
      if (fetchMoreInFlightRef.current) return;
      if (!hasMore) return;
      if (attempts >= 10) return; // cap background scans
      attempts += 1;
      fetchMore().catch(() => {});
    };
    let idleId: number | undefined;
    let timerId: number | undefined;
    if (typeof winAny.requestIdleCallback === 'function') {
      idleId = winAny.requestIdleCallback(schedule, { timeout: 300 });
    } else {
      timerId = window.setTimeout(schedule, 100);
    }
    return () => {
      cancelled = true;
      if (idleId && typeof winAny.cancelIdleCallback === 'function') winAny.cancelIdleCallback(idleId);
      if (timerId) clearTimeout(timerId);
    };
  }, [items?.length, pageSize, hasMore, fetchMore]);

  return { items, loading, error, hasMore, fetchMore };
}
