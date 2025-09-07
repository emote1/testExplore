import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apolloClient } from '@/apollo-client';
import { STAKINGS_CONNECTION_QUERY, STAKINGS_LIST_MIN_QUERY } from '@/data/staking';
import { useAddressResolver } from './use-address-resolver';

interface RawReward {
  id: string;
  amount: string; // base units (18)
  timestamp: string;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD (UTC)
  ts: number;   // UTC midnight timestamp (ms)
  sumReef: number;
}

export interface RewardsSeriesResult {
  daily: DailyPoint[];
  cumulative: DailyPoint[]; // cumulativeReef per date
  loading: boolean;
  error?: Error;
  totalCount: number;
}

function toUtcDay(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '1970-01-01';
  return d.toISOString().slice(0, 10);
}

function amountToReef(amount: string): number {
  try {
    const bi = BigInt(amount);
    // 18 decimals -> keep ~4 decimals safely: divide by 1e14 (BigInt) then by 1e4 as float (total 1e18)
    return Number(bi / 100000000000000n) / 1e4;
  } catch {
    return 0;
  }
}

type RangeKey = '30d' | '90d' | '180d' | '365d' | 'all';

function getDays(key: RangeKey): number | null {
  switch (key) {
    case '30d': return 30;
    case '90d': return 90;
    case '180d': return 180;
    case '365d': return 365;
    default: return null; // all
  }
}

async function fetchRewards(nativeAddress: string, range: RangeKey): Promise<{ items: RawReward[]; totalCount: number }> {
  // 1) get totalCount
  // If range != all, compute [from, to] anchored at today (UTC midnight) — removes extra RTT
  let from: string | undefined;
  let to: string | undefined;
  const days = getDays(range);
  if (days) {
    const todayUtcMid = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const lastMs = todayUtcMid.getTime();
    const fromMs = lastMs - (days - 1) * 24 * 60 * 60 * 1000;
    const toMs = lastMs + 24 * 60 * 60 * 1000 - 1; // end of today
    from = new Date(fromMs).toISOString();
    to = new Date(toMs).toISOString();
  }

  let totalCount: number | undefined = undefined;
  if (!days) {
    const conn = await apolloClient.query({ query: STAKINGS_CONNECTION_QUERY as any, variables: { accountId: nativeAddress, from, to }, fetchPolicy: 'network-only' });
    totalCount = (conn?.data?.stakingsConnection?.totalCount ?? 0) as number;
    if (!totalCount) return { items: [], totalCount: 0 };
  }

  // Adaptive paging to respect Subsquid response size limits
  // For filtered windows pick conservative page size to avoid squid size-limit retries
  // Start small (40) and, если страница пришла полной, удваиваем до 80/160/240
  let pageSize = days ? 40 : 200;
  const minPage = 20;
  const items: RawReward[] = [];
  for (let offset = 0; ; ) {
    try {
      const q = await apolloClient.query({
        query: STAKINGS_LIST_MIN_QUERY as any,
        variables: { accountId: nativeAddress, first: pageSize, after: offset, from, to },
        fetchPolicy: 'network-only',
      });
      const chunk = (q?.data?.stakings ?? []) as Array<any>;
      if (!Array.isArray(chunk) || chunk.length === 0) {
        // Avoid infinite loop on unexpected empty page
        break;
      }
      for (const s of chunk) {
        items.push({ id: String(s.id), amount: String(s.amount), timestamp: String(s.timestamp) });
      }
      const currentPageSize = pageSize;
      offset += chunk.length;
      // Break conditions / growth for filtered window
      if (days) {
        if (chunk.length < currentPageSize) {
          break; // last page retrieved
        }
        // full page -> try to grow for the next request
        pageSize = Math.min(currentPageSize * 2, 240);
      }
      // For ALL: stop when we know we've reached totalCount
      if (!days && typeof totalCount === 'number' && offset >= totalCount) break;
    } catch (e: any) {
      const msg = (e?.message || '').toString();
      const isSize = msg.includes('size limit') || msg.includes('exceed');
      if (isSize && pageSize > minPage) {
        pageSize = Math.max(minPage, Math.floor(pageSize / 2));
        // retry same offset with smaller pageSize on next loop iteration
        continue;
      }
      throw e;
    }
  }
  // Data comes newest first; optional normalize order later per day
  return { items, totalCount: typeof totalCount === 'number' ? totalCount : items.length };
}

export function useStakingRewardsSeries(accountAddress: string | null | undefined, rangeKey: RangeKey = 'all'): RewardsSeriesResult {
  const { resolveAddress } = useAddressResolver();
  const [native, setNative] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!accountAddress) { setNative(null); return; }
        const addr = await resolveAddress(accountAddress);
        if (!cancelled) setNative(addr);
      } catch {
        if (!cancelled) setNative(null);
      }
    })();
    return () => { cancelled = true; };
  }, [accountAddress, resolveAddress]);

  const { data, isPending, isError, error } = useQuery<{ items: RawReward[]; totalCount: number}>({
    queryKey: ['stakingSeries', native, rangeKey],
    enabled: !!native,
    queryFn: async () => {
      if (!native) return { items: [], totalCount: 0 };
      return await fetchRewards(native, rangeKey);
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    retry: 1,
  });

  const daily = useMemo<DailyPoint[]>(() => {
    const map = new Map<string, number>();
    const arr = data?.items ?? [];
    for (const r of arr) {
      const day = toUtcDay(r.timestamp);
      const reef = amountToReef(r.amount);
      map.set(day, (map.get(day) ?? 0) + reef);
    }
    const out: DailyPoint[] = Array.from(map.entries()).map(([date, sumReef]) => ({ date, ts: new Date(`${date}T00:00:00Z`).getTime(), sumReef }));
    out.sort((a, b) => a.ts - b.ts);
    return out;
  }, [data]);

  const cumulative = useMemo<DailyPoint[]>(() => {
    let acc = 0;
    return daily.map((p) => { acc += p.sumReef; return { date: p.date, ts: p.ts, sumReef: acc }; });
  }, [daily]);

  // Note: background prefetch of 'all' disabled to avoid лишняя нагрузка сети и задержки

  return {
    daily,
    cumulative,
    loading: isPending,
    error: isError ? (error as Error) : undefined,
    totalCount: data?.totalCount ?? 0,
  };
}
