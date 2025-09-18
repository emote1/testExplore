import { useEffect, useMemo, useState } from 'react';
import { useReefPrice } from './use-reef-price';
import { REEF_TOKEN_ADDRESS } from '@/utils/evm-call';
import { TtlCache } from '../data/ttl-cache';

export interface TokenInput {
  id: string;
  decimals: number;
}

export interface TokenPricesResult {
  pricesById: Record<string, number | null>;
  loading: boolean;
}

// Approximate float from bigint using scientific notation based on first 15 digits
function toFloatApprox(x: bigint): number {
  const s = x.toString();
  if (s.length <= 15) return Number(x);
  const head = Number(s.slice(0, 15));
  const exp = s.length - 15;
  return head * Math.pow(10, exp);
}

function pow10(n: number): bigint {
  if (n <= 0) return 1n;
  let b = 1n;
  for (let i = 0; i < n; i += 1) b *= 10n;
  return b;
}

// Subsquid GraphQL fallback (no EVM eth_call needed)
const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
const SQUID_URL: string = ENV.VITE_REEFSWAP_SQUID_URL ?? 'https://squid.subsquid.io/reef-swap/graphql';
const MIN_REEF_RESERVE: number = (() => {
  try {
    const raw = ENV.VITE_MIN_REEF_RESERVE_FOR_PRICE;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 50000; // show price only if REEF reserve >= 50000
  } catch {
    return 50000;
  }
})();

interface GraphReservesRow {
  token1: string;
  token2: string;
  reserved1?: string | number;
  reserved2?: string | number;
}

async function graphFetch<T>(query: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(SQUID_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal,
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null) as any;
    return json?.data ?? null;
  } catch {
    return null;
  }
}

function parseBig(v: unknown): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(Math.trunc(v));
  if (typeof v === 'string' && v.length) return BigInt(v);
  return 0n;
}

async function fetchReservesViaGraph(tok: string, signal?: AbortSignal): Promise<GraphReservesRow | null> {
  const a = REEF_TOKEN_ADDRESS.toLowerCase();
  const b = tok.toLowerCase();
  const q = `query PR($tokens: [String!]!) {
    poolsReserves(tokens: $tokens) {
      token1
      token2
      reserved1
      reserved2
    }
  }`;
  const data = await graphFetch<{ poolsReserves: GraphReservesRow[] }>(q, { tokens: [a, b] }, signal);
  const rows = data?.poolsReserves ?? [];
  const row = rows.find(r => {
    const t1 = (r.token1 || '').toLowerCase();
    const t2 = (r.token2 || '').toLowerCase();
    const s = new Set([t1, t2]);
    return s.has(a) && s.has(b);
  });
  return row ?? null;
}

interface AllPoolsRow {
  token1: string;
  token2: string;
  reserved1?: string | number;
  reserved2?: string | number;
  decimals1?: number;
  decimals2?: number;
}

async function fetchReservesViaAllPoolsList(tok: string, signal?: AbortSignal): Promise<AllPoolsRow | null> {
  const reef = REEF_TOKEN_ADDRESS.toLowerCase();
  const b = tok.toLowerCase();
  const q = `query AP($search: String!, $offset: Float!, $limit: Float!, $signer: String!) {
    allPoolsList(search: $search, offset: $offset, limit: $limit, signerAddress: $signer) {
      token1
      token2
      reserved1
      reserved2
      decimals1
      decimals2
      symbol1
      symbol2
    }
  }`;
  // сузим выдачу поиском по адресу токена
  const data = await graphFetch<{ allPoolsList: AllPoolsRow[] }>(q, {
    search: b,
    offset: 0,
    limit: 20,
    signer: '0x0000000000000000000000000000000000000000',
  }, signal);
  const rows = data?.allPoolsList ?? [];
  const row = rows.find(r => {
    const t1 = (r.token1 || '').toLowerCase();
    const t2 = (r.token2 || '').toLowerCase();
    const s = new Set([t1, t2]);
    return s.has(reef) && s.has(b);
  });
  return row ?? null;
}

// Batched poolsReserves for many tokens in a single round-trip
async function fetchBatchReservesViaGraph(tokens: string[], signal?: AbortSignal): Promise<Map<string, GraphReservesRow>> {
  const reef = REEF_TOKEN_ADDRESS.toLowerCase();
  const uniq = Array.from(new Set(tokens.map(t => t.toLowerCase()).filter(Boolean)));
  if (uniq.length === 0) return new Map();
  const q = `query PR($tokens: [String!]!) {
    poolsReserves(tokens: $tokens) {
      token1
      token2
      reserved1
      reserved2
    }
  }`;
  const data = await graphFetch<{ poolsReserves: GraphReservesRow[] }>(q, { tokens: [reef, ...uniq] }, signal);
  const rows = data?.poolsReserves ?? [];
  const out = new Map<string, GraphReservesRow>();
  for (const r of rows) {
    const t1 = (r.token1 || '').toLowerCase();
    const t2 = (r.token2 || '').toLowerCase();
    if (t1 === reef && uniq.includes(t2)) out.set(t2, r);
    else if (t2 === reef && uniq.includes(t1)) out.set(t1, r);
  }
  return out;
}

async function fetchTokenPriceUsd(token: TokenInput, reefUsd: number, signal?: AbortSignal): Promise<number | null> {
  try {
    if (!token?.id) return null;
    const id = token.id.toLowerCase();
    if (id === REEF_TOKEN_ADDRESS.toLowerCase()) return reefUsd;
    // GraphQL only: poolsReserves -> allPoolsList
    let row = await fetchReservesViaGraph(id, signal);
    let r1 = row ? parseBig(row.reserved1) : 0n;
    let r2 = row ? parseBig(row.reserved2) : 0n;
    let reefIs1 = row ? ((row.token1 || '').toLowerCase() === REEF_TOKEN_ADDRESS.toLowerCase()) : false;

    let tokDec = token.decimals ?? 18;
    if (!row || r1 <= 0n || r2 <= 0n) {
      const ap = await fetchReservesViaAllPoolsList(id, signal);
      if (!ap) return null;
      r1 = parseBig(ap.reserved1);
      r2 = parseBig(ap.reserved2);
      if (r1 <= 0n || r2 <= 0n) return null;
      const reefLower = REEF_TOKEN_ADDRESS.toLowerCase();
      const t1Lower = (ap.token1 || '').toLowerCase();
      const t2Lower = (ap.token2 || '').toLowerCase();
      reefIs1 = t1Lower === reefLower;
      // prefer decimals from allPoolsList if present
      if (t1Lower === id && typeof ap.decimals1 === 'number') {
        tokDec = Math.max(0, Math.floor(ap.decimals1));
      } else if (t2Lower === id && typeof ap.decimals2 === 'number') {
        tokDec = Math.max(0, Math.floor(ap.decimals2));
      }
    }

    const reefDec = 18; // REEF

    const reserveReef = reefIs1 ? r1 : r2;
    const reserveTok = reefIs1 ? r2 : r1;
    // Low-liquidity guard: skip price if REEF side is too small
    const reefReserveFloat = toFloatApprox(reserveReef) / Math.pow(10, reefDec);
    if (!Number.isFinite(reefReserveFloat) || reefReserveFloat < MIN_REEF_RESERVE) return null;
    const num = reserveReef * pow10(tokDec);
    const den = reserveTok * pow10(reefDec);
    if (den === 0n) return null;
    const reefPerToken = toFloatApprox(num) / toFloatApprox(den);
    if (!Number.isFinite(reefPerToken) || reefPerToken <= 0) return null;
    return reefUsd * reefPerToken;
  } catch {
    return null;
  }
}

const PRICE_TTL_MS = 60_000; // 1 minute
const priceTtl = new TtlCache<number>({
  namespace: 'reef:token-prices',
  defaultTtlMs: PRICE_TTL_MS,
  persist: true,
  maxSize: 20000,
});

export function useTokenUsdPrices(tokens: TokenInput[]): TokenPricesResult {
  const unique = useMemo(() => {
    const seen = new Set<string>();
    const out: TokenInput[] = [];
    for (const t of tokens || []) {
      const id = (t?.id || '').toLowerCase();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, decimals: t.decimals ?? 18 });
    }
    return out;
  }, [tokens]);

  const { price: reefPrice, loading: reefLoading } = useReefPrice();
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let aborted = false;
    const ac = new AbortController();
    const signal = ac.signal;
    async function run() {
      if (!reefPrice?.usd || unique.length === 0) {
        setPrices({});
        setLoading(false);
        return;
      }
      setLoading(true);
      const next: Record<string, number | null> = {};
      // 1) Try TTL cache for all tokens
      const missing: TokenInput[] = [];
      for (const t of unique) {
        const key = `${t.id}:${t.decimals}`;
        const cached = priceTtl.get(key);
        if (typeof cached === 'number') {
          next[t.id] = cached;
        } else {
          missing.push(t);
        }
      }

      // 2) Batch poolsReserves for missing tokens
      const idsToQuery = missing
        .map(t => t.id)
        .filter(id => id !== REEF_TOKEN_ADDRESS.toLowerCase());
      const batchMap = await fetchBatchReservesViaGraph(idsToQuery, signal);

      // 3) Compute from batch rows; collect still-unresolved
      const still: TokenInput[] = [];
      for (const t of missing) {
        const row = batchMap.get(t.id) ?? null;
        if (row) {
          const reefIs1 = (row.token1 || '').toLowerCase() === REEF_TOKEN_ADDRESS.toLowerCase();
          const r1 = parseBig(row.reserved1);
          const r2 = parseBig(row.reserved2);
          const reefDec = 18;
          const tokDec = t.decimals ?? 18;
          const reserveReef = reefIs1 ? r1 : r2;
          const reserveTok = reefIs1 ? r2 : r1;
          // Low-liquidity guard: skip price if REEF side is too small
          const reefReserveFloat = toFloatApprox(reserveReef) / Math.pow(10, reefDec);
          if (!Number.isFinite(reefReserveFloat) || reefReserveFloat < MIN_REEF_RESERVE) {
            next[t.id] = null;
            continue;
          }
          const num = reserveReef * pow10(tokDec);
          const den = reserveTok * pow10(reefDec);
          const val = den === 0n ? null : (toFloatApprox(num) / toFloatApprox(den)) * (reefPrice.usd ?? 0);
          if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
            next[t.id] = val;
            priceTtl.set(`${t.id}:${t.decimals}`, val);
            continue;
          }
        }
        still.push(t);
      }

      // 4) Fallback per-token graph queries for unresolved (limit concurrency)
      async function pLimitMap<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
        let index = 0;
        const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
          while (index < items.length) {
            const i = index++;
            await worker(items[i]!, i);
          }
        });
        await Promise.all(workers);
      }
      await pLimitMap(still, 4, async (t) => {
        const val = await fetchTokenPriceUsd(t, reefPrice.usd, signal);
        if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
          priceTtl.set(`${t.id}:${t.decimals}`, val);
        }
        next[t.id] = val ?? null;
      });
      if (!aborted) {
        setPrices(next);
        setLoading(false);
      }
    }
    run();
    return () => { aborted = true; ac.abort(); };
  }, [reefPrice?.usd, unique]);

  return { pricesById: prices, loading: loading || reefLoading };
}
