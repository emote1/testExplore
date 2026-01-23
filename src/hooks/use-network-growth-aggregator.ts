import { useState, useEffect } from 'react';
import { getExtrinsicsSparklineDailyIcp, icpConfig } from '../data/icp-client';

interface NetworkGrowthState {
  loading: boolean;
  error: Error | null;
  growthPct: number | null;
  last24h: number | null;
  prev24h: number | null;
  asOf: string | null;
  spark: number[]; // daily extrinsics for chart
}

/**
 * Calculates growth percentage from daily sparkline data.
 * Compares last day vs previous day (consistent with chart).
 */
function calcGrowthFromSpark(series: { extrinsics: number; ts: string }[]): {
  last24h: number | null;
  prev24h: number | null;
  growthPct: number | null;
} {
  if (series.length < 1) {
    return { last24h: null, prev24h: null, growthPct: null };
  }
  const last = series[series.length - 1]?.extrinsics ?? null;
  const prev = series.length >= 2 ? series[series.length - 2]?.extrinsics ?? null : null;
  
  let growthPct: number | null = null;
  if (last !== null && prev !== null && prev > 0) {
    growthPct = ((last - prev) / prev) * 100;
  }
  return { last24h: last, prev24h: prev, growthPct };
}

export function useNetworkGrowthAggregator(): NetworkGrowthState {
  const [state, setState] = useState<NetworkGrowthState>({
    loading: true,
    error: null,
    growthPct: null,
    last24h: null,
    prev24h: null,
    asOf: null,
    spark: [],
  });

  useEffect(() => {
    let cancelled = false;

    if (!icpConfig.extrinsicsEnabled) {
      setState({
        loading: false,
        error: null,
        growthPct: null,
        last24h: null,
        prev24h: null,
        asOf: null,
        spark: [],
      });
      return;
    }

    async function load() {
      try {
        const sparkData = await getExtrinsicsSparklineDailyIcp();
        if (cancelled) return;
        
        // Calculate growth from sparkline (last day vs prev day)
        const { last24h, prev24h, growthPct } = calcGrowthFromSpark(sparkData.series);
        
        setState({
          loading: false,
          error: null,
          growthPct,
          last24h,
          prev24h,
          asOf: sparkData.series[sparkData.series.length - 1]?.ts ?? null,
          spark: sparkData.series.map(s => s.extrinsics),
        });
      } catch (err) {
        if (cancelled) return;
        setState(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      }
    }

    load();
    // Refresh every 5 minutes
    const interval = setInterval(load, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return state;
}
