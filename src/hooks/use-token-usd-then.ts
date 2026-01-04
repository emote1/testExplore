import { useEffect, useMemo, useState } from 'react';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { reefSwapClient } from '@/reef-swap-client';
import { NEAREST_SWAP_FOR_TOKEN_DOCUMENT } from '@/data/reef-swap';
import { useReefPriceHistory } from '@/hooks/use-reef-price-history';
import { TtlCache } from '@/data/ttl-cache';

export interface UseTokenUsdThenInput {
  tokenId?: string | null;
  decimals?: number | null;
  blockHeight?: number | null;
  extrinsicIndex?: number | null;
  timestamp?: string | number | null;
}

export interface UseTokenUsdThenResult {
  usdThenPerUnit: number | null;
  loading: boolean;
  error?: Error;
}

const cache = new TtlCache<number>({
  namespace: 'reef:token-usd-then',
  defaultTtlMs: 6 * 60 * 60 * 1000,
  persist: true,
  maxSize: 5000,
});

function toDayUTC(ms: number): string { return new Date(ms).toISOString().slice(0, 10); }

function toFloat(amount: unknown, decimals: number): number {
  try {
    const s = String(amount ?? '0');
    if (!/^-?\d+$/.test(s)) return 0;
    const bi = BigInt(s);
    if (decimals <= 0) return Number(bi);
    const div = 10n ** BigInt(decimals);
    const ip = bi / div; const fp = (bi % div).toString().padStart(decimals, '0');
    return parseFloat(`${ip}.${fp}`);
  } catch { return 0; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reefPerTokenFromEvent(ev: any, reefIsToken1: boolean): number | null {
  const a1 = toFloat(ev?.amount1, Number(ev?.pool?.token1?.decimals ?? 18));
  const a2 = toFloat(ev?.amount2, Number(ev?.pool?.token2?.decimals ?? 18));
  const in1 = toFloat(ev?.amountIn1, Number(ev?.pool?.token1?.decimals ?? 18));
  const in2 = toFloat(ev?.amountIn2, Number(ev?.pool?.token2?.decimals ?? 18));
  // Determine direction using non-zero inputs
  if (reefIsToken1) {
    // TOKEN -> REEF (in2, out1)
    if (in2 > 0 && a1 > 0) return a1 / in2; // REEF per TOKEN
    // REEF -> TOKEN (in1, out2)
    if (in1 > 0 && a2 > 0) return in1 / a2; // REEF per TOKEN
  } else {
    // TOKEN -> REEF (in1, out2)
    if (in1 > 0 && a2 > 0) return a2 / in1;
    // REEF -> TOKEN (in2, out1)
    if (in2 > 0 && a1 > 0) return in2 / a1;
  }
  // Fallback using amounts only (less reliable)
  if (reefIsToken1 && a1 > 0 && a2 > 0) return a1 / a2;
  if (!reefIsToken1 && a2 > 0 && a1 > 0) return a2 / a1;
  return null;
}

export function useTokenUsdThenFromSwap({ tokenId, decimals, blockHeight, extrinsicIndex, timestamp }: UseTokenUsdThenInput): UseTokenUsdThenResult {
  const token = (tokenId || '').toLowerCase();
  const dec = Math.max(0, Number(decimals ?? 18));
  const { history } = useReefPriceHistory('max');
  const [usdThen, setUsdThen] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const bh = Number(blockHeight);
  const ex = Number(extrinsicIndex);

  const dayKey = useMemo(() => {
    if (timestamp == null) return null;
    const ms = (() => { try { const t = Date.parse(String(timestamp)); return Number.isFinite(t) ? t : NaN; } catch { return NaN; } })();
    return Number.isFinite(ms) ? toDayUTC(ms) : null;
  }, [timestamp]);

  const cacheKey = useMemo(() => {
    return token && dayKey ? `${token}:${dayKey}` : null;
  }, [token, dayKey]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setError(undefined);
        if (!token || token.length !== 42) { setUsdThen(null); return; }
        if (!dayKey || !history || typeof history[dayKey] !== 'number') { setUsdThen(null); return; }
        const reefUsdThen = history[dayKey]!;
        // Cache first
        if (cacheKey) {
          const c = cache.get(cacheKey);
          if (typeof c === 'number') { setUsdThen(c); return; }
        }
        // Need block/idx for strict cutoff; if missing, use a high idx at given block or skip
        const validBh = Number.isFinite(bh) ? Math.trunc(bh) : undefined;
        const validEx = Number.isFinite(ex) ? Math.trunc(ex) : 9999;
        if (validBh == null) { setUsdThen(null); return; }
        const client = reefSwapClient as ApolloClient<NormalizedCacheObject>;
        const { data } = await client.query({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          query: NEAREST_SWAP_FOR_TOKEN_DOCUMENT as any,
          variables: { reef: '0x0000000000000000000000000000000001000000', token, bh: validBh, ex: validEx },
          fetchPolicy: 'network-only',
        });
        const edge = (data?.poolEventsConnection?.edges ?? [])[0];
        const ev = edge?.node;
        if (!ev) { setUsdThen(null); return; }
        const token1Id = (ev?.pool?.token1?.id || '').toLowerCase();
        const reefIsToken1 = token1Id === '0x0000000000000000000000000000000001000000';
        const rpt = reefPerTokenFromEvent(ev, reefIsToken1);
        if (rpt == null || !(rpt > 0)) { setUsdThen(null); return; }
        const usdPerToken = rpt * reefUsdThen;
        if (!Number.isFinite(usdPerToken) || !(usdPerToken > 0)) { setUsdThen(null); return; }
        if (!cancelled) {
          setUsdThen(usdPerToken);
          if (cacheKey) cache.set(cacheKey, usdPerToken);
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (!cancelled) { setUsdThen(null); setError(e instanceof Error ? e : new Error('usd then lookup failed')); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    // Reset loading and value then run
    setUsdThen(null);
    setLoading(true);
    run();
    return () => { cancelled = true; };
  }, [token, dec, bh, ex, dayKey, history, cacheKey]);

  return { usdThenPerUnit: usdThen, loading, error } as const;
}
