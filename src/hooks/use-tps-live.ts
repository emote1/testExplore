import { useEffect, useMemo, useRef, useState } from 'react';
import { gql, useQuery, useSubscription } from '@apollo/client';

const LATEST_BLOCK = gql`
  query LatestBlockForTps {
    blocks(orderBy: height_DESC, limit: 1) { height timestamp }
  }
`;

const EXTRINSICS_STREAM = gql`
  subscription ExtrinsicsFromHeight($fromHeight: Int!, $limit: Int!) {
    extrinsics(
      where: { block: { height_gt: $fromHeight } }
      orderBy: [id_ASC]
      limit: $limit
    ) {
      id
      block { timestamp }
    }
  }
`;

interface Sample { t: number; c: number }

const STORAGE_KEY = 'tps_live_state_v1';

export function useTpsLive(windowSec = 60) {
  const [fromHeight, setFromHeight] = useState<number | null>(null);
  const [tps, setTps] = useState<number>(0);
  const [perMin, setPerMin] = useState<number>(0);
  const [tpsTrend, setTpsTrend] = useState<number[]>([]);
  const buf = useRef<Sample[]>([]);
  const lastTpsRef = useRef<number>(0);
  const lastPerMinRef = useRef<number>(0);
  const trendRef = useRef<number[]>([]);

  const { refetch: refetchLatest } = useQuery(LATEST_BLOCK, {
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: false,
    onCompleted: (d) => {
      const h = d?.blocks?.[0]?.height as number | undefined;
      if (typeof h === 'number') setFromHeight(h);
    },
  });

  // На восстановление WS/онлайн — подтянуть последний height и тем самым пересоздать подписку
  useEffect(() => {
    const handler = () => {
      try {
        refetchLatest?.().then((res) => {
          const h = (res as any)?.data?.blocks?.[0]?.height as number | undefined;
          if (typeof h === 'number') setFromHeight(h);
        }).catch(() => {});
      } catch {}
    };
    window.addEventListener('ws-connected', handler as EventListener);
    window.addEventListener('online', handler as EventListener);
    return () => {
      window.removeEventListener('ws-connected', handler as EventListener);
      window.removeEventListener('online', handler as EventListener);
    };
  }, [refetchLatest]);

  // Restore recent state from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ts?: number; windowSec?: number; buf?: Sample[]; trend?: number[]; lastTps?: number; lastPerMin?: number };
      const cutoff = Date.now() - windowSec * 1000;
      const restoredBuf = Array.isArray(parsed?.buf)
        ? parsed.buf.filter((s: any) => typeof s?.t === 'number' && typeof s?.c === 'number' && s.t >= cutoff)
        : [];
      buf.current = restoredBuf;
      trendRef.current = Array.isArray(parsed?.trend) ? parsed.trend.filter((n) => typeof n === 'number').slice(-windowSec) : [];
      lastTpsRef.current = typeof parsed?.lastTps === 'number' ? parsed.lastTps : 0;
      lastPerMinRef.current = typeof parsed?.lastPerMin === 'number' ? parsed.lastPerMin : 0;
      // seed state from restored data
      const seededTps = currentTps(buf.current, windowSec);
      const seededPerMin = currentCount(buf.current);
      setTps(seededTps);
      setPerMin(seededPerMin);
      setTpsTrend([...trendRef.current]);
    } catch {}
  }, [windowSec]);

  useSubscription(EXTRINSICS_STREAM, {
    skip: fromHeight == null,
    variables: { fromHeight: fromHeight ?? 0, limit: 5 },
    onData: ({ data }) => {
      const xs = data?.data?.extrinsics as Array<{ id: string; block: { timestamp?: string } }> | undefined;
      if (!xs || xs.length === 0) return;
      const now = Date.now();
      pushSample(buf.current, now, xs.length, windowSec);
      const nextTps = currentTps(buf.current, windowSec);
      const nextPerMin = currentCount(buf.current);
      if (Math.abs(nextTps - lastTpsRef.current) >= 0.005) {
        lastTpsRef.current = nextTps;
        setTps(nextTps);
      }
      if (Math.abs(nextPerMin - lastPerMinRef.current) >= 1) {
        lastPerMinRef.current = nextPerMin;
        setPerMin(nextPerMin);
      }
    },
    onError: () => {},
  });

  useEffect(() => {
    let intervalId: number | null = null;
    function tick() {
      const nextTps = currentTps(buf.current, windowSec);
      const nextPerMin = currentCount(buf.current);
      if (Math.abs(nextTps - lastTpsRef.current) >= 0.005) {
        lastTpsRef.current = nextTps;
        setTps(nextTps);
      }
      if (Math.abs(nextPerMin - lastPerMinRef.current) >= 1 || nextPerMin === 0) {
        lastPerMinRef.current = nextPerMin;
        setPerMin(nextPerMin);
      }
      trendRef.current.push(nextTps);
      if (trendRef.current.length > windowSec) trendRef.current.shift();
      setTpsTrend([...trendRef.current]);
      // persist compact state
      try {
        const snapshot = { ts: Date.now(), windowSec, buf: buf.current, trend: trendRef.current, lastTps: lastTpsRef.current, lastPerMin: lastPerMinRef.current };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {}
    }
    function start() {
      if (intervalId) window.clearInterval(intervalId);
      const period = document.hidden ? 5000 : 1000;
      tick();
      intervalId = window.setInterval(tick, period);
    }
    start();
    const onVis = () => start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (intervalId) window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [windowSec]);

  // Save on page close
  useEffect(() => {
    const onUnload = () => {
      try {
        const snapshot = { ts: Date.now(), windowSec, buf: buf.current, trend: trendRef.current, lastTps: lastTpsRef.current, lastPerMin: lastPerMinRef.current };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {}
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [windowSec]);

  return useMemo(() => ({ tps, perMin, tpsTrend }), [tps, perMin, tpsTrend]);
}

function pushSample(buf: Sample[], t: number, c: number, windowSec: number) {
  buf.push({ t, c });
  const cutoff = Date.now() - windowSec * 1000;
  while (buf.length && buf[0].t < cutoff) buf.shift();
}

function currentTps(buf: Sample[], windowSec: number) {
  const sum = buf.reduce((acc, s) => acc + s.c, 0);
  return sum / windowSec;
}

function currentCount(buf: Sample[]) {
  const sum = buf.reduce((acc, s) => acc + s.c, 0);
  return sum;
}
