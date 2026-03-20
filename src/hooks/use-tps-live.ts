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

const RECENT_BLOCKS_SUBSQUID = gql`
  query RecentBlocksForTps($limit: Int!) {
    blocks(orderBy: height_DESC, limit: $limit) { height timestamp }
  }
`;

const RECENT_BLOCKS_HASURA = parse(`
  query RecentBlocksForTpsHasura($limit: Int!) {
    blocks: block(order_by: { height: desc }, limit: $limit) {
      height
      timestamp
    }
  }
`);

const RECENT_BLOCKS = isHasuraExplorerMode
  ? RECENT_BLOCKS_HASURA
  : RECENT_BLOCKS_SUBSQUID;

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

function readEventTimestampMs(item: unknown): number | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as { timestamp?: unknown; block?: { timestamp?: unknown } | null };
  const raw = record.timestamp ?? record.block?.timestamp;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

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

  const { data: recentBlocksData } = useQuery(RECENT_BLOCKS, {
    skip: source !== 'blocks',
    variables: { limit: Math.max(windowSec * 2, 120) },
    fetchPolicy: 'network-only',
    pollInterval: source === 'blocks' ? 15_000 : 0,
    notifyOnNetworkStatusChange: false,
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
      const seededPerMin = source === 'blocks' ? currentBlocksPerMin(buf.current, windowSec) : currentCount(buf.current);
      setTps(seededTps);
      setPerMin(seededPerMin);
      setTpsTrend([...trendRef.current]);
    } catch { /* ignore parse errors */ }
  }, [windowSec, source]);

  useEffect(() => {
    if (source !== 'blocks') return;
    const blocks = (recentBlocksData as { blocks?: unknown[] } | undefined)?.blocks;
    if (!Array.isArray(blocks) || blocks.length === 0) return;

    const nextSamples = buildBlockSamples(blocks, windowSec);
    if (nextSamples.length === 0) return;

    buf.current = nextSamples;

    const latestHeight = readMaxBlockHeight(blocks);
    if (typeof latestHeight === 'number') {
      setFromHeight((prev) => (typeof prev === 'number' ? Math.max(prev, latestHeight) : latestHeight));
    }

    const nextTps = currentTps(nextSamples, windowSec);
    const nextPerMin = currentBlocksPerMin(nextSamples, windowSec);
    lastTpsRef.current = nextTps;
    lastPerMinRef.current = nextPerMin;
    setTps(nextTps);
    setPerMin(nextPerMin);

    const nextTrend = buildBlocksTrend(nextSamples, windowSec);
    trendRef.current = nextTrend;
    setTpsTrend(nextTrend);
  }, [recentBlocksData, source, windowSec]);

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

      if (source === 'blocks') {
        for (const item of xs) {
          const sampleTs = readEventTimestampMs(item) ?? now;
          pushSample(buf.current, sampleTs, 1, windowSec);
        }
      } else {
        pushSample(buf.current, now, xs.length, windowSec);
      }
      const nextTps = currentTps(buf.current, windowSec);
      const nextPerMin = source === 'blocks' ? currentBlocksPerMin(buf.current, windowSec) : currentCount(buf.current);
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
      const nextPerMin = source === 'blocks' ? currentBlocksPerMin(buf.current, windowSec) : currentCount(buf.current);
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
  }, [windowSec, source]);

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

function readBlockHeight(item: unknown): number | null {
  if (!item || typeof item !== 'object') return null;
  const raw = (item as { height?: unknown }).height;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readMaxBlockHeight(items: unknown[]): number | null {
  let maxHeight: number | null = null;
  for (const item of items) {
    const height = readBlockHeight(item);
    if (height == null) continue;
    if (maxHeight == null || height > maxHeight) maxHeight = height;
  }
  return maxHeight;
}

function buildBlockSamples(items: unknown[], windowSec: number): Sample[] {
  const cutoff = Date.now() - windowSec * 1000;
  const seen = new Set<string>();
  const samples: Sample[] = [];

  for (const item of items) {
    const ts = readEventTimestampMs(item);
    if (!Number.isFinite(ts) || (ts as number) < cutoff) continue;
    const height = readBlockHeight(item);
    const key = height != null ? String(height) : `${ts}-${samples.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    samples.push({ t: ts as number, c: 1 });
  }

  samples.sort((a, b) => a.t - b.t);
  return samples;
}

function buildBlocksTrend(buf: Sample[], windowSec: number): number[] {
  const ordered = buf
    .filter((s) => Number.isFinite(s.t) && Number.isFinite(s.c))
    .slice()
    .sort((a, b) => a.t - b.t);

  const nowSec = Math.floor(Date.now() / 1000);
  const totalPoints = Math.max(1, Math.floor(windowSec));
  const startSec = nowSec - totalPoints + 1;
  const rateWindowSec = Math.max(10, Math.min(60, Math.floor(windowSec)));
  const trend: number[] = [];

  let left = 0;
  let right = 0;
  let total = 0;

  for (let sec = startSec; sec <= nowSec; sec++) {
    const endMs = sec * 1000 + 999;
    const startMs = endMs - rateWindowSec * 1000;

    while (right < ordered.length && ordered[right].t <= endMs) {
      total += ordered[right].c;
      right += 1;
    }

    while (left < right && ordered[left].t < startMs) {
      total -= ordered[left].c;
      left += 1;
    }

    trend.push((total * 60) / rateWindowSec);
  }

  return trend;
}

function currentBlocksPerMin(buf: Sample[], windowSec: number) {
  if (buf.length === 0) return 0;

  const ordered = buf
    .filter((s) => Number.isFinite(s.t) && Number.isFinite(s.c))
    .slice()
    .sort((a, b) => a.t - b.t);

  if (ordered.length === 0) return 0;

  const now = Date.now();
  const rateWindowSec = Math.max(10, Math.min(60, Math.floor(windowSec)));
  const startMs = now - rateWindowSec * 1000;
  let totalBlocks = 0;

  for (const sample of ordered) {
    if (sample.t < startMs || sample.t > now) continue;
    totalBlocks += sample.c;
  }

  return (totalBlocks * 60) / rateWindowSec;
}
