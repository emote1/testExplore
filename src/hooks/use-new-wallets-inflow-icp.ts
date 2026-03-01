import { useEffect, useState } from 'react';
import { getNewWalletsInflowIcp, icpConfig, type NewWalletsInflowResponse } from '../data/icp-client';

const ICP_CRON_INTERVAL_HOURS = Number(import.meta.env.VITE_ICP_CRON_INTERVAL_HOURS ?? '4');

interface NewWalletsInflowState {
  enabled: boolean;
  loading: boolean;
  error?: Error;
  data?: NewWalletsInflowResponse;
}

export function useNewWalletsInflowIcp(): NewWalletsInflowState {
  const [state, setState] = useState<Omit<NewWalletsInflowState, 'enabled'>>({
    loading: true,
    error: undefined,
    data: undefined,
  });

  useEffect(() => {
    if (!icpConfig.newWalletsInflowEnabled) {
      setState({ loading: false, error: undefined, data: undefined });
      return;
    }

    const ac = new AbortController();
    let mounted = true;

    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(): Promise<string | undefined> {
      try {
        setState((prev) => ({ ...prev, loading: true }));
        const data = await getNewWalletsInflowIcp(ac.signal);
        if (!mounted) return undefined;
        setState({ loading: false, error: undefined, data });
        return data.asOf;
      } catch (e) {
        if (!mounted) return undefined;
        setState({ loading: false, error: e instanceof Error ? e : new Error(String(e)), data: undefined });
        return undefined;
      }
    }

    const RETRY_MS = 30 * 60 * 1000;

    function scheduleNext(asOf?: string, prevAsOf?: string) {
      if (!mounted) return;
      const CRON_MS = ICP_CRON_INTERVAL_HOURS * 60 * 60 * 1000;
      const BUFFER_MS = 5 * 60 * 1000;
      const isStale = prevAsOf != null && asOf === prevAsOf;
      let delayMs = isStale ? RETRY_MS : CRON_MS;
      if (!isStale && asOf) {
        const lastUpdate = new Date(asOf).getTime();
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

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      ac.abort();
    };
  }, []);

  return { enabled: icpConfig.newWalletsInflowEnabled, ...state };
}
