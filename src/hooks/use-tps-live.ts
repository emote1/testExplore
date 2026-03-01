import { useEffect, useMemo, useRef, useState } from 'react';
import { gql, useQuery, useSubscription } from '@apollo/client';
import { parse } from 'graphql';
import { isHasuraExplorerMode } from '@/utils/transfer-query';

const LATEST_BLOCK_SUBSQUID = gql`
  query LatestBlockForTps {
    blocks(orderBy: height_DESC, limit: 1) { height timestamp }
  }
`;

const LATEST_BLOCK_HASURA = parse(`
  query LatestBlockForTpsHasura {
    blocks: block(order_by: { height: desc }, limit: 1) {
      height
      timestamp
    }
  }
`);

const LATEST_BLOCK = isHasuraExplorerMode
  ? LATEST_BLOCK_HASURA
  : LATEST_BLOCK_SUBSQUID;

const EXTRINSICS_STREAM_SUBSQUID = gql`
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

const EXTRINSICS_STREAM_HASURA = parse(`
  subscription ExtrinsicsFromHeightHasura($fromHeight: Int!, $limit: Int!) {
    extrinsics: extrinsic(
      where: { block_height: { _gt: $fromHeight } }
      order_by: [{ id: asc }]
      limit: $limit
    ) {
      id
      timestamp
    }
  }
`);

const EXTRINSICS_STREAM = isHasuraExplorerMode
  ? EXTRINSICS_STREAM_HASURA
  : EXTRINSICS_STREAM_SUBSQUID;

const TRANSFERS_STREAM_SUBSQUID = gql`
  subscription TransfersFromHeight($fromHeight: Int!, $limit: Int!) {
    transfers(
      where: { blockHeight_gt: $fromHeight }
      orderBy: [id_ASC]
      limit: $limit
    ) {
      id
      timestamp
    }
  }
`;

const TRANSFERS_STREAM_HASURA = parse(`
  subscription TransfersFromHeightHasura($fromHeight: Int!, $limit: Int!) {
    transfers: transfer(
      where: { block_height: { _gt: $fromHeight } }
      order_by: [{ id: asc }]
      limit: $limit
    ) {
      id
      timestamp
    }
  }
`);

const TRANSFERS_STREAM = isHasuraExplorerMode
  ? TRANSFERS_STREAM_HASURA
  : TRANSFERS_STREAM_SUBSQUID;

const BLOCKS_STREAM_SUBSQUID = gql`
  subscription BlocksFromHeight($fromHeight: Int!, $limit: Int!) {
    blocks(
      where: { height_gt: $fromHeight }
      orderBy: [height_ASC]
      limit: $limit
    ) {
      height
      timestamp
    }
  }
`;

const BLOCKS_STREAM_HASURA = parse(`
  subscription BlocksFromHeightHasura($fromHeight: Int!, $limit: Int!) {
    blocks: block(
      where: { height: { _gt: $fromHeight } }
      order_by: [{ height: asc }]
      limit: $limit
    ) {
      height
      timestamp
    }
  }
`);

const BLOCKS_STREAM = isHasuraExplorerMode
  ? BLOCKS_STREAM_HASURA
  : BLOCKS_STREAM_SUBSQUID;

interface Sample { t: number; c: number }

const STORAGE_KEY = 'tps_live_state_v2';

export function useTpsLive(windowSec = 60, source: 'extrinsics' | 'transfers' | 'blocks' = 'extrinsics') {
  const [fromHeight, setFromHeight] = useState<number | null>(null);
  const [tps, setTps] = useState<number>(0);
  const [perMin, setPerMin] = useState<number>(0);
  const [tpsTrend, setTpsTrend] = useState<number[]>([]);
  const buf = useRef<Sample[]>([]);
  const lastTpsRef = useRef<number>(0);
  const lastPerMinRef = useRef<number>(0);
  const trendRef = useRef<number[]>([]);
  // Track per-second counts for spiky visualization
  const lastSecondRef = useRef<number>(Math.floor(Date.now() / 1000));
  const currentSecondCountRef = useRef<number>(0);

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
          const h = (res as { data?: { blocks?: Array<{ height?: number }> } })?.data?.blocks?.[0]?.height;
          if (typeof h === 'number') setFromHeight(h);
        }).catch(() => { /* ignore fetch errors */ });
      } catch { /* ignore handler errors */ }
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
        ? parsed.buf.filter((s) => typeof (s as { t?: number; c?: number })?.t === 'number' && typeof (s as { t?: number; c?: number })?.c === 'number' && (s as { t: number }).t >= cutoff)
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
    } catch { /* ignore parse errors */ }
  }, [windowSec]);

  const streamDoc = source === 'blocks' ? BLOCKS_STREAM : source === 'transfers' ? TRANSFERS_STREAM : EXTRINSICS_STREAM;
  useSubscription(streamDoc, {
    skip: fromHeight == null,
    variables: { fromHeight: fromHeight ?? 0, limit: 5 },
    onData: ({ data }) => {
      const payload = data?.data as { transfers?: unknown[]; extrinsics?: unknown[]; blocks?: unknown[] } | undefined;
      const xs = source === 'blocks' ? payload?.blocks : source === 'transfers' ? payload?.transfers : payload?.extrinsics;
      if (!xs || xs.length === 0) return;
      const now = Date.now();
      const currentSecond = Math.floor(now / 1000);
      
      // Track per-second counts for spiky visualization
      if (currentSecond !== lastSecondRef.current) {
        // New second - push previous count to trend and reset
        lastSecondRef.current = currentSecond;
        currentSecondCountRef.current = xs.length;
      } else {
        // Same second - accumulate
        currentSecondCountRef.current += xs.length;
      }
      
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
      const now = Date.now();
      const currentSecond = Math.floor(now / 1000);
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
      
      // Push to trend - store perMin history for smooth sparkline
      if (currentSecond !== lastSecondRef.current) {
        trendRef.current.push(nextPerMin);
        lastSecondRef.current = currentSecond;
        currentSecondCountRef.current = 0;
      } else if (trendRef.current.length > 0) {
        trendRef.current[trendRef.current.length - 1] = nextPerMin;
      } else {
        trendRef.current.push(nextPerMin);
      }
      
      if (trendRef.current.length > windowSec) trendRef.current.shift();
      setTpsTrend([...trendRef.current]);
      // persist compact state
      try {
        const snapshot = { ts: Date.now(), windowSec, buf: buf.current, trend: trendRef.current, lastTps: lastTpsRef.current, lastPerMin: lastPerMinRef.current };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch { /* ignore storage errors */ }
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
      } catch { /* ignore storage errors */ }
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
