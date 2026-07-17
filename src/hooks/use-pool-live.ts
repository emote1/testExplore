import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@apollo/client';
import { POOL_RECENT_TRANSFERS_QUERY } from '@/data/pool';
import { createNewItemDetector } from '@/utils/transfer-new-items';
import type { RawTransferRow } from '@/data/pool-adapter';
import type { ChannelId } from '@/components/SovraWaterfall/types';

export type LiveChannel = Extract<ChannelId, 'inflow' | 'outflow' | 'swap'>;

export interface LiveTransferEvent {
  id: string;
  channel: LiveChannel;
  tokenId: string | null;
  amountRaw: string;
  timestamp: number; // ms epoch
}

const DEFAULT_INTERVAL_MS = 20_000;
const FETCH_LIMIT = 10;

/**
 * Live transfers for the pool view. Same architecture as the classic wallet's
 * useTransferSubscription (polling — our proxy can't carry Hasura WebSockets):
 * one tiny wallet-wide query on an interval + a seen-id detector; only truly
 * new transfers are reported via onNew. Pauses while the tab is hidden.
 *
 * Test overrides (same convention as the classic hook):
 *   ?pollMs=1000  — poll interval
 *   ?liveDemo=1   — replays the newest existing transfer once as a live event
 */
export function usePoolLive(
  accounts: string[] | null,
  enabled: boolean,
  onNew: (events: LiveTransferEvent[]) => void,
) {
  const accountsKey = (accounts ?? []).join(',');
  const detectorRef = useRef(createNewItemDetector<RawTransferRow>({ key: (r) => r.id, max: 100 }));
  const demoFiredRef = useRef(false);
  const onNewRef = useRef(onNew);
  useEffect(() => { onNewRef.current = onNew; }, [onNew]);

  const { pollMs, demo } = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const raw = p.get('pollMs') ?? p.get('poll');
      const n = raw ? Number(raw) : NaN;
      return {
        pollMs: Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_INTERVAL_MS,
        demo: p.get('liveDemo') === '1',
      };
    } catch {
      return { pollMs: DEFAULT_INTERVAL_MS, demo: false };
    }
  }, []);

  useEffect(() => {
    detectorRef.current.reset();
    demoFiredRef.current = false;
  }, [accountsKey]);

  const { data, startPolling, stopPolling } = useQuery(POOL_RECENT_TRANSFERS_QUERY, {
    variables: { accounts, limit: FETCH_LIMIT },
    skip: !accounts?.length || !enabled,
    pollInterval: enabled ? pollMs : 0,
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: false,
  });

  // pause polling while the tab is hidden (battery + server load)
  useEffect(() => {
    if (!accounts?.length || !enabled) return;
    const onVis = () => {
      if (document.hidden) stopPolling?.();
      else startPolling?.(pollMs);
    };
    document.addEventListener('visibilitychange', onVis);
    onVis();
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stopPolling?.();
    };
  }, [accountsKey, accounts?.length, enabled, pollMs, startPolling, stopPolling]);

  useEffect(() => {
    if (!accounts?.length) return;
    const rows = (data?.rows ?? []) as RawTransferRow[];
    if (rows.length === 0) return;

    // first tick primes the detector and reports nothing
    let fresh = detectorRef.current.detectNew(rows);
    if (demo && !demoFiredRef.current) {
      demoFiredRef.current = true;
      fresh = [rows[0]];
    }
    if (fresh.length === 0) return;

    const accSet = new Set(accounts.map((a) => a.toLowerCase()));
    const events: LiveTransferEvent[] = fresh.map((r) => {
      // same classification rule as transferRowToSovraTx (pool-adapter)
      const isSwap = !!r.reefswapAction;
      const isIncoming = accSet.has((r.toId ?? '').toLowerCase());
      return {
        id: r.id,
        channel: isSwap ? 'swap' : (isIncoming ? 'inflow' : 'outflow'),
        tokenId: r.tokenId ?? null,
        amountRaw: String(r.amount),
        timestamp: new Date(r.timestamp).getTime(),
      };
    });
    onNewRef.current(events);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, accountsKey, demo]);
}
