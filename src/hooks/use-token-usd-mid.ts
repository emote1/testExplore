import { useEffect, useMemo, useState } from 'react';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { reefSwapClient } from '@/reef-swap-client';
import { reefExplorerClient } from '@/reef-explorer-client';
import { BLOCK_BY_TIME_BEFORE_DOCUMENT, BLOCK_BY_TIME_AFTER_DOCUMENT } from '@/data/explorer-blocks';
import {
  NEAREST_SWAP_FOR_TOKEN_BY_TIME_DOCUMENT,
  NEAREST_SWAP_FOR_TOKEN_BY_TIME_AFTER_DOCUMENT,
  NEAREST_SWAP_FOR_TOKEN_DOCUMENT,
  NEAREST_SWAP_FOR_TOKEN_BY_BLOCK_AFTER_DOCUMENT,
  NEAREST_SWAP_FOR_TOKEN_WINDOW_BEFORE_DOCUMENT,
  NEAREST_SWAP_FOR_TOKEN_WINDOW_AFTER_DOCUMENT,
} from '@/data/reef-swap';
import { useReefPriceHistory } from '@/hooks/use-reef-price-history';
import { TtlCache } from '@/data/ttl-cache';

export interface UseTokenUsdMidInput {
  tokenId?: string | null;
  decimals?: number | null;
  tradeTimestamp?: string | number | null; // original trade time
  horizonDays?: number; // default 7
}

export interface UseTokenUsdMidResult {
  usdMidPerUnit: number | null;
  loading: boolean;
  error?: Error;
}

const cache = new TtlCache<number>({
  namespace: 'reef:token-usd-mid',
  defaultTtlMs: 6 * 60 * 60 * 1000,
  persist: true,
  maxSize: 5000,
});

const REEF_ID = '0x0000000000000000000000000000000001000000';
const DAY_MS = 24 * 60 * 60 * 1000;
const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
// Default: Explorer fallback disabled. Set VITE_MID_DISABLE_EXPLORER="false" to opt-in.
const DISABLE_EXPLORER = ENV.VITE_MID_DISABLE_EXPLORER !== 'false';
const EXPLORER_TIMEOUT_MS = Math.max(500, Math.min(10000, Number(ENV.VITE_EXPLORER_TIMEOUT_MS ?? '2500')));
type PickStrategy = 'before' | 'nearest' | 'after';
const PICK_STRATEGY: PickStrategy = ((ENV.VITE_MID_PICK_STRATEGY || 'before').toLowerCase() as PickStrategy);

function toIsoDay(ms: number): string { return new Date(ms).toISOString().slice(0, 10); }

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

function reefPerTokenFromEvent(ev: any, reefIsToken1: boolean): number | null {
  const a1 = toFloat(ev?.amount1, Number(ev?.pool?.token1?.decimals ?? 18));
  const a2 = toFloat(ev?.amount2, Number(ev?.pool?.token2?.decimals ?? 18));
  const in1 = toFloat(ev?.amountIn1, Number(ev?.pool?.token1?.decimals ?? 18));
  const in2 = toFloat(ev?.amountIn2, Number(ev?.pool?.token2?.decimals ?? 18));
  if (reefIsToken1) {
    if (in2 > 0 && a1 > 0) return a1 / in2;
    if (in1 > 0 && a2 > 0) return in1 / a2;
  } else {
    if (in1 > 0 && a2 > 0) return a2 / in1;
    if (in2 > 0 && a1 > 0) return in2 / a1;
  }
  if (reefIsToken1 && a1 > 0 && a2 > 0) return a1 / a2;
  if (!reefIsToken1 && a2 > 0 && a1 > 0) return a2 / a1;
  return null;
}

export function useTokenUsdMidFromSwapTime({ tokenId, decimals, tradeTimestamp, horizonDays = 7 }: UseTokenUsdMidInput): UseTokenUsdMidResult {
  const rawToken = (tokenId || '').trim();
  // reef-swap stores token ids in lowercase; normalize for id_eq matching
  const tokenKey = rawToken.toLowerCase();
  const dec = Math.max(0, Number(decimals ?? 18));
  const [usdMid, setUsdMid] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const { history } = useReefPriceHistory('max');

  const midTimestampIso = useMemo(() => {
    if (tradeTimestamp == null) return null;
    const t = (() => { try { const ms = Date.parse(String(tradeTimestamp)); return Number.isFinite(ms) ? ms : NaN; } catch { return NaN; } })();
    if (!Number.isFinite(t)) return null;
    const ms = t + Math.max(1, Math.trunc(horizonDays)) * 24 * 60 * 60 * 1000;
    return new Date(ms).toISOString();
  }, [tradeTimestamp, horizonDays]);

  const dayKey = useMemo(() => {
    if (!midTimestampIso) return null;
    return toIsoDay(Date.parse(midTimestampIso));
  }, [midTimestampIso]);

  const cacheKey = useMemo(() => tokenKey && dayKey ? `${tokenKey}:${dayKey}` : null, [tokenKey, dayKey]);

  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();
    async function run() {
      try {
        setError(undefined);
        if (!rawToken) { setUsdMid(null); return; }
        if (!midTimestampIso) { setUsdMid(null); return; }
        const targetMs = Date.parse(midTimestampIso);
        const reefUsdMidMaybe = (() => {
          try {
            const v = history?.[toIsoDay(targetMs) as any];
            return typeof v === 'number' ? v : null;
          } catch { return null; }
        })();
        if (cacheKey) {
          const c = cache.get(cacheKey);
          if (typeof c === 'number') { setUsdMid(c); return; }
        }
        // REEF leg: no need to hit swap index; use historical REEF price directly
        if (tokenKey === REEF_ID) {
          if (!cancelled) {
            if (reefUsdMidMaybe != null) {
              setUsdMid(reefUsdMidMaybe);
              if (cacheKey) cache.set(cacheKey, reefUsdMidMaybe);
            } else {
              setUsdMid(null);
            }
          }
          return;
        }

        const client = reefSwapClient as ApolloClient<NormalizedCacheObject>;
        const [beforeQ, afterQ] = await Promise.all([
          client.query({
            query: NEAREST_SWAP_FOR_TOKEN_BY_TIME_DOCUMENT as any,
            variables: { reef: REEF_ID, token: tokenKey, ts: midTimestampIso },
            fetchPolicy: 'network-only',
            context: { fetchOptions: { signal: abort.signal } },
          }),
          client.query({
            query: NEAREST_SWAP_FOR_TOKEN_BY_TIME_AFTER_DOCUMENT as any,
            variables: { reef: REEF_ID, token: tokenKey, ts: midTimestampIso },
            fetchPolicy: 'network-only',
            context: { fetchOptions: { signal: abort.signal } },
          }),
        ]);
        let evBefore = (beforeQ?.data?.poolEventsConnection?.edges ?? [])[0]?.node;
        let evAfter = (afterQ?.data?.poolEventsConnection?.edges ?? [])[0]?.node;

        // Fallback 1: widen time window around target on reef-swap (avoid explorer when possible)
        if (!evBefore && !evAfter) {
          const windows = [1, 3, 7, 14, 30, 60, 90, 180];
          const client2 = reefSwapClient as ApolloClient<NormalizedCacheObject>;
          for (const w of windows) {
            const fromBefore = new Date(targetMs - w * DAY_MS).toISOString();
            const toBefore = midTimestampIso;
            const fromAfter = midTimestampIso;
            const toAfter = new Date(targetMs + w * DAY_MS).toISOString();
            try {
              const [wb, wa] = await Promise.all([
                client2.query({
                  query: NEAREST_SWAP_FOR_TOKEN_WINDOW_BEFORE_DOCUMENT as any,
                  variables: { reef: REEF_ID, token: tokenKey, from: fromBefore, to: toBefore },
                  fetchPolicy: 'network-only',
                  context: { fetchOptions: { signal: abort.signal } },
                }),
                client2.query({
                  query: NEAREST_SWAP_FOR_TOKEN_WINDOW_AFTER_DOCUMENT as any,
                  variables: { reef: REEF_ID, token: tokenKey, from: fromAfter, to: toAfter },
                  fetchPolicy: 'network-only',
                  context: { fetchOptions: { signal: abort.signal } },
                }),
              ]);
              evBefore = (wb?.data?.poolEventsConnection?.edges ?? [])[0]?.node || evBefore;
              evAfter = (wa?.data?.poolEventsConnection?.edges ?? [])[0]?.node || evAfter;
              if (evBefore || evAfter) break;
            } catch {
              // ignore and try next window
            }
          }
        }

        // Fallback 2: if still empty, resolve nearest blocks via explorer and query reef-swap by block
        if (!evBefore && !evAfter && !DISABLE_EXPLORER) {
          try {
            // Use a separate abort with a short timeout to prevent hanging explorer requests
            const expAbort = new AbortController();
            const expTimer = window.setTimeout(() => expAbort.abort(), EXPLORER_TIMEOUT_MS);
            const [bBlock, aBlock] = await Promise.all([
              (reefExplorerClient as ApolloClient<NormalizedCacheObject>).query({
                query: BLOCK_BY_TIME_BEFORE_DOCUMENT as any,
                variables: { ts: midTimestampIso },
                fetchPolicy: 'network-only',
                context: { fetchOptions: { signal: expAbort.signal } },
              }),
              (reefExplorerClient as ApolloClient<NormalizedCacheObject>).query({
                query: BLOCK_BY_TIME_AFTER_DOCUMENT as any,
                variables: { ts: midTimestampIso },
                fetchPolicy: 'network-only',
                context: { fetchOptions: { signal: expAbort.signal } },
              }),
            ]);
            window.clearTimeout(expTimer);
            const hb = Number(bBlock?.data?.blocks?.[0]?.height);
            const ha = Number(aBlock?.data?.blocks?.[0]?.height);
            const client2 = reefSwapClient as ApolloClient<NormalizedCacheObject>;
            const byBlockAbort = new AbortController();
            const byBlockTimer = window.setTimeout(() => byBlockAbort.abort(), EXPLORER_TIMEOUT_MS);
            const [bSwap, aSwap] = await Promise.all([
              Number.isFinite(hb) && hb > 0
                ? client2.query({
                    query: NEAREST_SWAP_FOR_TOKEN_DOCUMENT as any,
                    variables: { reef: REEF_ID, token: tokenKey, bh: Math.trunc(hb), ex: 9999 },
                    fetchPolicy: 'network-only',
                    context: { fetchOptions: { signal: byBlockAbort.signal } },
                  })
                : Promise.resolve({ data: null } as any),
              Number.isFinite(ha) && ha > 0
                ? client2.query({
                    query: NEAREST_SWAP_FOR_TOKEN_BY_BLOCK_AFTER_DOCUMENT as any,
                    variables: { reef: REEF_ID, token: tokenKey, bh: Math.trunc(ha), ex: 0 },
                    fetchPolicy: 'network-only',
                    context: { fetchOptions: { signal: byBlockAbort.signal } },
                  })
                : Promise.resolve({ data: null } as any),
            ]);
            window.clearTimeout(byBlockTimer);
            evBefore = (bSwap?.data?.poolEventsConnection?.edges ?? [])[0]?.node || null;
            evAfter = (aSwap?.data?.poolEventsConnection?.edges ?? [])[0]?.node || null;
          } catch {
            // ignore fallback errors; proceed with blanks
          }
        }

        const pick = (() => {
          const tb = evBefore ? Date.parse(String(evBefore.timestamp)) : Number.NaN;
          const ta = evAfter ? Date.parse(String(evAfter.timestamp)) : Number.NaN;
          if (PICK_STRATEGY === 'before') {
            if (Number.isFinite(tb)) return evBefore;
            if (Number.isFinite(ta)) return evAfter;
            return null;
          }
          if (PICK_STRATEGY === 'after') {
            if (Number.isFinite(ta)) return evAfter;
            if (Number.isFinite(tb)) return evBefore;
            return null;
          }
          // nearest
          if (Number.isFinite(tb) && Number.isFinite(ta)) {
            const db = Math.abs(tb - targetMs);
            const da = Math.abs(ta - targetMs);
            // tie-breaker: prefer before
            return db <= da ? evBefore : evAfter;
          }
          if (Number.isFinite(tb)) return evBefore;
          if (Number.isFinite(ta)) return evAfter;
          return null;
        })();
        if (!pick) { setUsdMid(null); return; }
        const token1Id = (pick?.pool?.token1?.id || '').toLowerCase();
        const reefIsToken1 = token1Id === '0x0000000000000000000000000000000001000000';
        const rpt = reefPerTokenFromEvent(pick, reefIsToken1);
        if (rpt == null || !(rpt > 0)) { setUsdMid(null); return; }
        if (reefUsdMidMaybe == null) { setUsdMid(null); return; }
        const usdPerToken = rpt * reefUsdMidMaybe;
        if (!Number.isFinite(usdPerToken) || !(usdPerToken > 0)) { setUsdMid(null); return; }
        if (!cancelled) {
          setUsdMid(usdPerToken);
          if (cacheKey) cache.set(cacheKey, usdPerToken);
        }
      } catch (e: any) {
        if (!cancelled) { setUsdMid(null); setError(e instanceof Error ? e : new Error('usd mid lookup failed')); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setUsdMid(null);
    setLoading(true);
    run();
    return () => { cancelled = true; abort.abort(); };
  }, [tokenKey, dec, midTimestampIso, history, cacheKey]);

  return { usdMidPerUnit: usdMid, loading, error } as const;
}
