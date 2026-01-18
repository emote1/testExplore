import { useEffect, useState } from 'react';
import { getActiveWalletsSparklineDailyIcp, icpConfig } from '../data/icp-client';

interface ActiveWallets24hIcp {
  enabled: boolean;
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

export function useActiveWallets24hIcp(): ActiveWallets24hIcp {
  const [state, setState] = useState<Omit<ActiveWallets24hIcp, 'enabled'>>({
    loading: true,
    error: undefined,
    last24h: null,
    prev24h: null,
    growthPct: null,
    spark: [],
    asOf: undefined,
  });

  useEffect(function () {
    if (!icpConfig.enabled) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: undefined,
      }));
      return;
    }

    const ac = new AbortController();
    let mounted = true;

    async function load() {
      try {
        setState((prev) => ({ ...prev, loading: true }));
        const sparkData = await getActiveWalletsSparklineDailyIcp(ac.signal);
        if (!mounted) return;

        const { last24h, prev24h, growthPct } = calcGrowthFromSpark(sparkData.series ?? []);

        setState({
          loading: false,
          error: undefined,
          last24h,
          prev24h,
          growthPct,
          spark: (sparkData.series ?? []).map((p: { active: number }) => p.active),
          asOf: sparkData.series?.[sparkData.series.length - 1]?.ts,
        });
      } catch (e) {
        if (!mounted) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: e instanceof Error ? e : new Error(String(e)),
        }));
      }
    }

    load();
    const interval = setInterval(load, 5 * 60 * 1000);

    return function () {
      mounted = false;
      clearInterval(interval);
      ac.abort();
    };
  }, []);

  return { enabled: icpConfig.enabled, ...state };
}
