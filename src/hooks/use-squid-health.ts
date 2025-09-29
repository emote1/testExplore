import { useEffect, useMemo, useRef, useState } from 'react';
import { useApolloClient, type ApolloClient, type NormalizedCacheObject } from '@apollo/client';
import { HEALTH_COMBINED_QUERY } from '@/data/health';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';

export interface SquidHealth {
  status: 'live' | 'lagging' | 'stale' | 'down';
  height?: number;
  lastBlockTs?: number; // ms epoch
  processorTs?: number; // ms epoch
  latencyMsAvg?: number; // avg response time of last N
  latencyMsP95?: number;
  lastUpdated?: number;
}

interface Options {
  intervalMs?: number; // default 15000
  lagWarnSec?: number; // default 60
  staleSec?: number;   // default 5*60
  latencyWindow?: number; // default 20
}

export function useSquidHealth(opts: Options = {}): SquidHealth {
  const client = useApolloClient();
  const intervalMs = opts.intervalMs ?? 15_000;
  const lagWarnSec = opts.lagWarnSec ?? 60;
  const staleSec = opts.staleSec ?? 5 * 60;
  const latencyWindow = Math.max(1, Math.floor(opts.latencyWindow ?? 20));

  const [height, setHeight] = useState<number | undefined>(undefined);
  const [lastBlockTs, setLastBlockTs] = useState<number | undefined>(undefined);
  const [processorTs, setProcessorTs] = useState<number | undefined>(undefined);
  const [lastUpdated, setLastUpdated] = useState<number | undefined>(undefined);
  const latenciesRef = useRef<number[]>([]);

  async function timedQuery<T>(q: TypedDocumentNode<any, any>): Promise<T | null> {
    const t0 = performance.now();
    try {
      const { data } = await (client as ApolloClient<NormalizedCacheObject>).query({
        query: q,
        fetchPolicy: 'network-only',
      });
      const t1 = performance.now();
      const dt = t1 - t0;
      const arr = latenciesRef.current;
      arr.push(dt);
      while (arr.length > latencyWindow) arr.shift();
      return (data as T) ?? null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let alive = true;
    let timer: number | null = null;

    async function tick() {
      if (!alive) return;
      const data = await timedQuery<any>(HEALTH_COMBINED_QUERY as unknown as TypedDocumentNode<any, any>);
      const h = data?.squidStatus?.height;
      if (h != null) setHeight(Number(h));
      const row = data?.blocks?.[0];
      if (row) {
        const ts = Date.parse(String(row.timestamp));
        const pts = row.processorTimestamp ? Date.parse(String(row.processorTimestamp)) : undefined;
        if (!Number.isNaN(ts)) setLastBlockTs(ts);
        if (pts && !Number.isNaN(pts)) setProcessorTs(pts);
      }
      setLastUpdated(Date.now());
      // schedule next
      timer = window.setTimeout(tick, intervalMs);
    }

    tick();
    return () => { alive = false; if (timer) window.clearTimeout(timer); };
  }, [client, intervalMs, latencyWindow]);

  const { avg, p95 } = useMemo(() => {
    const arr = latenciesRef.current;
    if (arr.length === 0) return { avg: undefined, p95: undefined };
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = arr.reduce((a, b) => a + b, 0);
    const avg = sum / arr.length;
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const p95 = sorted[idx];
    return { avg, p95 };
  }, [lastUpdated]);

  const status: SquidHealth['status'] = useMemo(() => {
    if (!lastUpdated) return 'down';
    if (!lastBlockTs) return 'lagging';
    const now = Date.now();
    const lagSec = Math.max(0, (now - lastBlockTs) / 1000);
    if (lagSec > staleSec) return 'stale';
    if (lagSec > lagWarnSec) return 'lagging';
    return 'live';
  }, [lastUpdated, lastBlockTs, lagWarnSec, staleSec]);

  return {
    status,
    height,
    lastBlockTs,
    processorTs,
    latencyMsAvg: avg,
    latencyMsP95: p95,
    lastUpdated,
  };
}
