import { useQuery } from '@tanstack/react-query';
import { TtlCache } from '../data/ttl-cache';

interface ReefPrice {
  usd: number;
  usd_24h_change?: number;
  timestamp?: number;
}

const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
// Default to CoinGecko simple price endpoint; allow override via env
const PRICE_URL: string = (ENV.VITE_REEF_PRICE_URL || 'https://api.coingecko.com/api/v3/simple/price?ids=reef&vs_currencies=usd&include_24hr_change=true');
const USD_MULTIPLIER: number = (() => {
  try {
    const raw = ENV.VITE_REEF_USD_MULTIPLIER;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
})();

// Module-level TTL cache and in-flight dedupe to avoid duplicate fetches in React 18 StrictMode
const PRICE_TTL_MS = 60_000; // 1 min
const priceTtl = new TtlCache<ReefPrice>({
  namespace: 'reef:price',
  defaultTtlMs: PRICE_TTL_MS,
  persist: true,
  maxSize: 8,
});
let inflight: Promise<ReefPrice | null> | null = null;
const TTL_KEY = `usd:${USD_MULTIPLIER}`;

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json');
}

async function fetchReefPrice(_signal?: AbortSignal): Promise<ReefPrice | null> {
  try {
    // 1) Serve from TTL cache if available
    const cached = priceTtl.get(TTL_KEY);
    if (cached) return cached;

    // 2) Coalesce concurrent calls
    if (inflight) return await inflight;

    inflight = (async () => {
      // Intentionally do NOT attach AbortSignal to keep request alive across StrictMode remounts
      const res = await fetch(PRICE_URL, { headers: { accept: 'application/json' } });
    if (!res.ok || !isJsonResponse(res)) return null;
    const json = (await res.json().catch(() => null)) as unknown;
    if (!json || typeof json !== 'object') return null;

    // Case 1: CoinGecko format: { reef: { usd: number, usd_24h_change?: number } }
    {
      const root = json as Record<string, unknown>;
      const reef = root['reef'];
      if (reef && typeof reef === 'object') {
        const obj = reef as Record<string, unknown>;
        const usd = Number(obj['usd']);
        const change = Number(obj['usd_24h_change']);
        if (Number.isFinite(usd)) {
          const value: ReefPrice = { usd: usd * USD_MULTIPLIER, usd_24h_change: Number.isFinite(change) ? change : undefined, timestamp: Date.now() };
          priceTtl.set(TTL_KEY, value);
          return value;
        }
      }
    }

    // Case 2: Reefscan flat format: { usd: number, usd_24h_change?: number, timestamp?: number }
    {
      const j = json as Record<string, unknown>;
      const usd = Number(j['usd']);
      if (Number.isFinite(usd)) {
        const change = Number(j['usd_24h_change']);
        const ts = Number(j['timestamp']);
        const value: ReefPrice = { usd: usd * USD_MULTIPLIER, usd_24h_change: Number.isFinite(change) ? change : undefined, timestamp: Number.isFinite(ts) ? ts : Date.now() };
        priceTtl.set('usd', value);
        return value;
      }
    }
    return null;
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

export function useReefPrice() {
  const { data, isPending, isError } = useQuery<ReefPrice | null>({
    queryKey: ['reefPrice', PRICE_URL, USD_MULTIPLIER],
    queryFn: ({ signal }) => fetchReefPrice(signal),
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
    retry: 1,
  });
  return { price: data ?? null, loading: isPending, error: isError ? new Error('Failed to load REEF price') : undefined } as const;
}
