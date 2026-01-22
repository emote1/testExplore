import { useEffect, useState } from 'react';
import { getNewWalletsInflowIcp, icpConfig, type NewWalletsInflowResponse } from '../data/icp-client';

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

    async function load() {
      try {
        setState((prev) => ({ ...prev, loading: true }));
        const data = await getNewWalletsInflowIcp(ac.signal);
        if (!mounted) return;
        setState({ loading: false, error: undefined, data });
      } catch (e) {
        if (!mounted) return;
        setState({ loading: false, error: e instanceof Error ? e : new Error(String(e)), data: undefined });
      }
    }

    load();
    const interval = setInterval(load, 5 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
      ac.abort();
    };
  }, []);

  return { enabled: icpConfig.newWalletsInflowEnabled, ...state };
}
