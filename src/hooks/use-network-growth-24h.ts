import { useMemo } from 'react';
import { gql, useQuery } from '@apollo/client';

const EXTRINSICS_GROWTH_24H = gql`
  query ExtrinsicsGrowth24h($fromPrev: DateTime!, $fromNow: DateTime!, $toNow: DateTime!) {
    last24h: extrinsicsConnection(
      where: { timestamp_gte: $fromNow, timestamp_lt: $toNow }
      orderBy: timestamp_ASC
    ) {
      totalCount
    }
    prev24h: extrinsicsConnection(
      where: { timestamp_gte: $fromPrev, timestamp_lt: $fromNow }
      orderBy: timestamp_ASC
    ) {
      totalCount
    }
  }
`;

interface NetworkGrowth24h {
  loading: boolean;
  error?: Error;
  growthPct: number | null;
  last24h: number | null;
  prev24h: number | null;
}

export function useNetworkGrowth24h(): NetworkGrowth24h {
  // Compute 24h windows once per mount (client time, UTC ISO)
  const { fromPrev, fromNow, toNow } = useMemo(() => {
    const now = new Date();
    const msNow = now.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const fromNowDate = new Date(msNow - dayMs);
    const fromPrevDate = new Date(msNow - 2 * dayMs);
    return {
      fromPrev: fromPrevDate.toISOString(),
      fromNow: fromNowDate.toISOString(),
      toNow: now.toISOString(),
    };
  }, []);

  const { data, loading, error } = useQuery(EXTRINSICS_GROWTH_24H, {
    variables: { fromPrev, fromNow, toNow },
    fetchPolicy: 'network-only',
  });

  const { growthPct, last24h, prev24h } = useMemo(() => {
    const last = data?.last24h?.totalCount ?? null;
    const prev = data?.prev24h?.totalCount ?? null;
    if (last == null || prev == null) {
      return { growthPct: null, last24h: last, prev24h: prev };
    }
    const base = prev === 0 ? 1 : prev;
    const pct = ((last - prev) / base) * 100;
    return { growthPct: pct, last24h: last, prev24h: prev };
  }, [data]);

  return {
    loading,
    error: error as Error | undefined,
    growthPct,
    last24h,
    prev24h,
  };
}
