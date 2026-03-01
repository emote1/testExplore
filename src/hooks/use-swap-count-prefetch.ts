import { useEffect, useState, useRef } from 'react';
import { reefSwapClient } from '@/reef-swap-client';
import { POOL_EVENTS_COUNT_DOCUMENT } from '@/data/reef-swap';
import { useAddressResolver } from './use-address-resolver';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';

// Module-level cache to avoid refetching for same address
const swapCountCache = new Map<string, number>();

export function useSwapCountPrefetch(address: string | null, enabled: boolean = true): number | null {
  const { resolveEvmAddress } = useAddressResolver();
  const [count, setCount] = useState<number | null>(null);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !address) {
      setCount(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const evmAddress = await resolveEvmAddress(address);
        if (!evmAddress || cancelled) return;

        // Check cache first
        const cached = swapCountCache.get(evmAddress.toLowerCase());
        if (typeof cached === 'number') {
          if (!cancelled) setCount(cached);
          return;
        }

        // Avoid duplicate fetches for same address
        if (fetchedRef.current === evmAddress.toLowerCase()) return;
        fetchedRef.current = evmAddress.toLowerCase();

        const client = reefSwapClient as ApolloClient<NormalizedCacheObject>;
        const { data } = await client.query({
          query: POOL_EVENTS_COUNT_DOCUMENT,
          variables: { addr: evmAddress },
          fetchPolicy: 'cache-first',
        });

        const total = data?.poolEventsConnection?.totalCount ?? 0;
        swapCountCache.set(evmAddress.toLowerCase(), total);
        if (!cancelled) setCount(total);
      } catch (e) {
        // Silently fail - this is just prefetch
        console.debug('[swap-prefetch] failed', e);
      }
    })();

    return () => { cancelled = true; };
  }, [address, enabled, resolveEvmAddress]);

  return count;
}

// Clear cache (useful for testing)
export function clearSwapCountCache(): void {
  swapCountCache.clear();
}
