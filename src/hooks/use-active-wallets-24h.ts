import { useEffect, useState } from 'react';
import { getActiveWalletsSparklineDaily } from '../data/aggregator-client';

interface ActiveWallets24h {
  loading: boolean;
  error?: Error;
  last24h: number | null;
  prev24h: number | null;
  growthPct: number | null;
  spark: number[];
  asOf?: string;
}

/**
 * Calculates growth percentage from daily sparkline data.
 * Compares last day vs previous day (consistent with chart).
 */
function calcGrowthFromSpark(series: { active: number; ts: string }[]): {
  last24h: number | null;
  prev24h: number | null;
  growthPct: number | null;
} {
  if (series.length < 1) {
    return { last24h: null, prev24h: null, growthPct: null };
  }
  const last = series[series.length - 1]?.active ?? null;
  const prev = series.length >= 2 ? series[series.length - 2]?.active ?? null : null;
  
  let growthPct: number | null = null;
  if (last !== null && prev !== null && prev > 0) {
    growthPct = ((last - prev) / prev) * 100;
  }
  return { last24h: last, prev24h: prev, growthPct };
}

export function useActiveWallets24h(): ActiveWallets24h {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [last24h, setLast24h] = useState<number | null>(null);
  const [prev24h, setPrev24h] = useState<number | null>(null);
  const [growthPct, setGrowthPct] = useState<number | null>(null);
  const [spark, setSpark] = useState<number[]>([]);
  const [asOf, setAsOf] = useState<string | undefined>(undefined);

  useEffect(function () {
    const ac = new AbortController();
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const sparkData = await getActiveWalletsSparklineDaily(30, ac.signal);
        if (!mounted) return;
        
        // Calculate growth from sparkline (last day vs prev day)
        const { last24h, prev24h, growthPct } = calcGrowthFromSpark(sparkData.series ?? []);
        
        setLast24h(last24h);
        setPrev24h(prev24h);
        setGrowthPct(growthPct);
        setSpark((sparkData.series ?? []).map((p: { active: number }) => p.active));
        setAsOf(sparkData.series?.[sparkData.series.length - 1]?.ts);
        setError(undefined);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return function () {
      mounted = false;
      ac.abort();
    };
  }, []);

  return { loading, error, last24h, prev24h, growthPct, spark, asOf };
}
