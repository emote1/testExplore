import { useEffect, useState } from 'react';
import { getActiveWalletsSparklineDailyIcp, icpConfig } from '../data/icp-client';

const ICP_CRON_INTERVAL_HOURS = Number(import.meta.env.VITE_ICP_CRON_INTERVAL_HOURS ?? '4');

interface SparkDatedPoint {
  value: number | null;
  ts: string;
}

interface ActiveWallets24hIcp {
  enabled: boolean;
  loading: boolean;
  error?: Error;
  last24h: number | null;
  prev24h: number | null;
  growthPct: number | null;
  spark: number[];
  sparkDated: SparkDatedPoint[];
  asOf?: string;
}

function fillDateGaps(series: { value: number; ts: string }[]): SparkDatedPoint[] {
  if (series.length < 2) return series.map((s) => ({ value: s.value, ts: s.ts }));
  const sorted = [...series].sort((a, b) => a.ts.localeCompare(b.ts));
  const result: SparkDatedPoint[] = [];
  const startDate = new Date(sorted[0].ts + 'T00:00:00Z');
  const endDate = new Date(sorted[sorted.length - 1].ts + 'T00:00:00Z');
  const dataMap = new Map(sorted.map((s) => [s.ts, s.value]));
  const current = new Date(startDate);
  while (current <= endDate) {
    const key = current.toISOString().split('T')[0];
    result.push({ ts: key, value: dataMap.get(key) ?? null });
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
}

/**
 * Calculates growth percentage from daily active-wallet sparkline data.
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
    sparkDated: [],
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

    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(): Promise<string | undefined> {
      let asOf: string | undefined;
      try {
        setState((prev) => ({ ...prev, loading: true }));
        const sparkData = await getActiveWalletsSparklineDailyIcp(ac.signal);
        if (!mounted) return undefined;

        const { last24h, prev24h, growthPct } = calcGrowthFromSpark(sparkData.series ?? []);

        const rawSeries = sparkData.series ?? [];
        asOf = rawSeries[rawSeries.length - 1]?.ts;
        setState({
          loading: false,
          error: undefined,
          last24h,
          prev24h,
          growthPct,
          spark: rawSeries.map((p) => p.active),
          sparkDated: fillDateGaps(rawSeries.map((p) => ({ value: p.active, ts: p.ts }))),
          asOf,
        });
      } catch (e) {
        if (!mounted) return undefined;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: e instanceof Error ? e : new Error(String(e)),
        }));
      }
      return asOf;
    }

    const RETRY_MS = 30 * 60 * 1000;

    function scheduleNext(asOf?: string, prevAsOf?: string) {
      if (!mounted) return;
      const CRON_MS = ICP_CRON_INTERVAL_HOURS * 60 * 60 * 1000;
      const BUFFER_MS = 5 * 60 * 1000;
      const isStale = prevAsOf != null && asOf === prevAsOf;
      let delayMs = isStale ? RETRY_MS : CRON_MS;
      if (!isStale && asOf) {
        const lastUpdate = new Date(asOf + (asOf.includes('T') ? '' : 'T00:00:00Z')).getTime();
        if (Number.isFinite(lastUpdate)) {
          const nextCron = lastUpdate + CRON_MS;
          delayMs = Math.max(BUFFER_MS, nextCron + BUFFER_MS - Date.now());
        }
      }
      timer = setTimeout(async () => {
        const freshAsOf = await load();
        scheduleNext(freshAsOf, asOf);
      }, delayMs);
    }

    load().then((asOf) => scheduleNext(asOf));

    return function () {
      mounted = false;
      if (timer) clearTimeout(timer);
      ac.abort();
    };
  }, []);

  return { enabled: icpConfig.enabled, ...state };
}
