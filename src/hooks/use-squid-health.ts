import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApolloClient, type ApolloClient, type NormalizedCacheObject } from '@apollo/client';
import { HEALTH_COMBINED_QUERY } from '@/data/health';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';

interface HealthQueryResult {
  squidStatus?: {
    height?: number | string;
  };
  blocks?: Array<{
    timestamp?: string;
    processorTimestamp?: string;
  }>;
}

export interface SquidHealth {
  status: 'loading' | 'live' | 'lagging' | 'stale' | 'down';
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
  circuitTripErrors?: number; // default 2
  circuitCooldownMs?: number; // default 2*60*1000
}

export function useSquidHealth(opts: Options = {}): SquidHealth {
  const client = useApolloClient();
  const intervalMs = opts.intervalMs ?? 15_000;
  const lagWarnSec = opts.lagWarnSec ?? 60;
  const staleSec = opts.staleSec ?? 5 * 60;
  const latencyWindow = Math.max(1, Math.floor(opts.latencyWindow ?? 20));
  const circuitTripErrors = Math.max(1, Math.floor(opts.circuitTripErrors ?? 2));
  const circuitCooldownMs = Math.max(5_000, Math.floor(opts.circuitCooldownMs ?? 2 * 60 * 1000));

  const [height, setHeight] = useState<number | undefined>(undefined);
  const [lastBlockTs, setLastBlockTs] = useState<number | undefined>(undefined);
  const [processorTs, setProcessorTs] = useState<number | undefined>(undefined);
  const [lastUpdated, setLastUpdated] = useState<number | undefined>(undefined);
  const [outageActive, setOutageActive] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now);
  const latenciesRef = useRef<number[]>([]);
  const intervalMsRef = useRef(intervalMs);
  const latencyWindowRef = useRef(latencyWindow);
  const outageActiveRef = useRef(false);
  const cooldownUntilRef = useRef<number | null>(null);

  useEffect(() => {
    intervalMsRef.current = intervalMs;
  }, [intervalMs]);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 10_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    latencyWindowRef.current = latencyWindow;
  }, [latencyWindow]);

  const timedQuery = useCallback(async <T,>(q: TypedDocumentNode): Promise<T | null> => {
    const t0 = performance.now();
    const { data } = await (client as ApolloClient<NormalizedCacheObject>).query({
      query: q,
      fetchPolicy: 'network-only',
    });
    const t1 = performance.now();
    const dt = t1 - t0;
    const arr = latenciesRef.current;
    arr.push(dt);
    while (arr.length > latencyWindowRef.current) arr.shift();
    return (data as T) ?? null;
  }, [client]);

  useEffect(() => {
    let alive = true;
    let timer: number | null = null;
    let backoffMs = intervalMsRef.current;
    let errorCount = 0;
    const maxBackoffMs = 5 * 60 * 1000;

    function handleVisibilityChange() {
      if (!alive) return;
      if (document.hidden) {
        if (timer) {
          window.clearTimeout(timer);
          timer = null;
        }
      } else {
        if (!timer) {
          tick();
        }
      }
    }

    async function tick() {
      if (!alive || document.hidden) return;

      if (cooldownUntilRef.current) {
        const now = Date.now();
        if (now < cooldownUntilRef.current) {
          const remaining = cooldownUntilRef.current - now;
          timer = window.setTimeout(tick, remaining);
          return;
        }
        cooldownUntilRef.current = null;
      }

      try {
        const data = await timedQuery<HealthQueryResult>(HEALTH_COMBINED_QUERY as unknown as TypedDocumentNode);
        if (!alive) return;

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

        errorCount = 0;
        backoffMs = intervalMsRef.current;
        if (outageActiveRef.current) {
          outageActiveRef.current = false;
          setOutageActive(false);
          try { window.dispatchEvent(new CustomEvent('squid-recovered')); } catch { /* ignore */ }
        }
      } catch (err) {
        if (!alive) return;
        errorCount++;
        backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
        const anyErr = err as {
          message?: string;
          response?: { status?: number };
          networkError?: { statusCode?: number; response?: { status?: number } };
        };
        const status = anyErr?.networkError?.statusCode
          ?? anyErr?.networkError?.response?.status
          ?? anyErr?.response?.status;
        const message = anyErr?.message ?? 'Unknown error';
        const isOutage = status === 504
          || (typeof status === 'number' && status >= 500)
          || /504/.test(message)
          || /gateway time-out/i.test(message)
          || /failed to fetch/i.test(message)
          || /networkerror/i.test(message)
          || /cors/i.test(message);
        if (isOutage && !outageActiveRef.current) {
          outageActiveRef.current = true;
          setOutageActive(true);
          try {
            window.dispatchEvent(new CustomEvent('squid-outage', {
              detail: { status, message },
            }));
          } catch { /* ignore */ }
        }
        if (isOutage && errorCount >= circuitTripErrors) {
          const nextCooldown = Date.now() + circuitCooldownMs;
          if (!cooldownUntilRef.current || nextCooldown > cooldownUntilRef.current) {
            cooldownUntilRef.current = nextCooldown;
          }
        }
        console.warn(`[SquidHealth] Query failed (attempt ${errorCount}), backing off to ${backoffMs}ms`, err);
      }

      if (alive && !document.hidden) {
        timer = window.setTimeout(tick, backoffMs);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    tick();

    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timer) window.clearTimeout(timer);
    };
  }, [client, timedQuery]);

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
    if (outageActive) return 'down';
    if (!lastUpdated) return 'loading';
    if (!lastBlockTs) return 'lagging';
    const lagSec = Math.max(0, (nowMs - lastBlockTs) / 1000);
    if (lagSec > staleSec) return 'stale';
    if (lagSec > lagWarnSec) return 'lagging';
    return 'live';
  }, [outageActive, lastUpdated, lastBlockTs, lagWarnSec, staleSec, nowMs]);

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
