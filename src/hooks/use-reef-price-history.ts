import { useQuery } from '@tanstack/react-query';
import { TtlCache } from '@/data/ttl-cache';

export interface ReefPriceHistory {
  // yyyy-mm-dd (UTC) -> usd price
  byDate: Record<string, number>;
  // available date range
  startDate: string; // yyyy-mm-dd
  endDate: string;   // yyyy-mm-dd
}

const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
const DEFAULT_DAYS = 365;
// CoinGecko market chart daily: returns prices as [ms, price]
// We keep the URL configurable for self-hosted proxies
const HISTORY_URL_BASE: string = ENV.VITE_REEF_PRICE_HISTORY_URL_BASE || 'https://api.coingecko.com/api/v3/coins/reef/market_chart';
const CG_API_KEY: string | undefined = ENV.VITE_COINGECKO_API_KEY;
const CG_DEMO_KEY: string | undefined = ENV.VITE_COINGECKO_DEMO_KEY;

// TTL cache to avoid repeated downloads
const HISTORY_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const histCache = new TtlCache<ReefPriceHistory>({ namespace: 'reef:price:history', defaultTtlMs: HISTORY_TTL_MS, persist: true, maxSize: 4 });
let inflight: Promise<ReefPriceHistory | null> | null = null;

function toDayUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json');
}

async function fetchHistory(days: number | 'max' = DEFAULT_DAYS, _signal?: AbortSignal): Promise<ReefPriceHistory | null> {
  try {
    const key = String(days);
    const cached = histCache.get(key);
    if (cached) return cached;
    if (inflight) return await inflight;

    inflight = (async () => {
      const daysParamInitial = days === 'max' && !CG_API_KEY ? 365 : days; // Public API: max not allowed
      let url = `${HISTORY_URL_BASE}?vs_currency=usd&days=${daysParamInitial}&interval=daily`;
      const headers: Record<string, string> = { accept: 'application/json' };
      if (CG_API_KEY) headers['x-cg-pro-api-key'] = CG_API_KEY;
      if (CG_DEMO_KEY) headers['x-cg-demo-api-key'] = CG_DEMO_KEY;
      // If no keys at all, CoinGecko may still work, otherwise we retry by adding query param for demo
      let res = await fetch(url, { headers });
      if (!res.ok && CG_DEMO_KEY) {
        // Some environments require the demo key as query param
        const demoDays = daysParamInitial;
        url = `${HISTORY_URL_BASE}?vs_currency=usd&days=${demoDays}&interval=daily&x_cg_demo_api_key=${encodeURIComponent(CG_DEMO_KEY)}`;
        res = await fetch(url, { headers });
      }
      // If still not ok and we tried 'max', fallback to 365
      if (!res.ok && days === 'max') {
        const fallbackUrl = `${HISTORY_URL_BASE}?vs_currency=usd&days=365&interval=daily`;
        res = await fetch(fallbackUrl, { headers });
      }
      if (!res.ok) {
        throw new Error(`CoinGecko history HTTP ${res.status}`);
      }
      if (!isJsonResponse(res)) return null;
      const json = await res.json().catch(() => null) as any;
      const prices: Array<[number, number]> = Array.isArray(json?.prices) ? json.prices : [];
      const byDate: Record<string, number> = {};
      for (const row of prices) {
        const ts = Number(row?.[0]);
        const price = Number(row?.[1]);
        if (!Number.isFinite(ts) || !Number.isFinite(price)) continue;
        const day = toDayUTC(ts);
        byDate[day] = price;
      }
      const daysSorted = Object.keys(byDate).sort();
      if (daysSorted.length === 0) return null;
      const value: ReefPriceHistory = {
        byDate,
        startDate: daysSorted[0],
        endDate: daysSorted[daysSorted.length - 1],
      };
      histCache.set(key, value);
      return value;
    })();

    try {
      return await inflight;
    } finally {
      inflight = null;
    }
  } catch {
    return null;
  }
}

export function useReefPriceHistory(days: number | 'max' = DEFAULT_DAYS) {
  const { data, isPending, isError } = useQuery<ReefPriceHistory | null>({
    queryKey: ['reefPriceHistory', String(days), HISTORY_URL_BASE],
    queryFn: ({ signal }) => fetchHistory(days, signal),
    staleTime: HISTORY_TTL_MS,
    gcTime: HISTORY_TTL_MS,
    retry: 1,
  });
  return {
    history: data?.byDate ?? null,
    startDate: data?.startDate ?? null,
    endDate: data?.endDate ?? null,
    loading: isPending,
    error: isError ? new Error('Failed to load REEF price history') : undefined,
  } as const;
}
