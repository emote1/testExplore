export interface Growth24hResponse {
  asOf: string;
  extrinsics: {
    last24h: number;
    prev24h: number;
    growthPct: number;
  };
  graph: {
    nodes: number;
    edges: number;
    eOverN: number;
    newWalletsRatio: number;
  };
  activeWallets: {
    last24h: number;
    prev24h: number;
    growthPct: number;
  };
}

export interface ExtrinsicsSparklinePoint {
  ts: string;
  extrinsics: number;
}

export interface ExtrinsicsSparklineResponse {
  hours: number;
  series: ExtrinsicsSparklinePoint[];
}

export interface ActiveWalletsSparklinePoint {
  ts: string;
  active: number;
  new: number;
}

export interface ActiveWalletsSparklineResponse {
  hours: number;
  series: ActiveWalletsSparklinePoint[];
}

export async function getGrowth24hMock(signal?: AbortSignal): Promise<Growth24hResponse> {
  const res = await fetch('/mock-aggregator/metrics-growth24h.json', { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`mock growth24h failed: ${res.status}`);
  return res.json();
}

export async function getExtrinsicsSparkline24hMock(signal?: AbortSignal): Promise<ExtrinsicsSparklineResponse> {
  const res = await fetch('/mock-aggregator/sparklines-extrinsics-24h.json', { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`mock extrinsics sparkline failed: ${res.status}`);
  return res.json();
}

export async function getActiveWalletsSparkline24hMock(signal?: AbortSignal): Promise<ActiveWalletsSparklineResponse> {
  const res = await fetch('/mock-aggregator/sparklines-active-wallets-24h.json', { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`mock active wallets sparkline failed: ${res.status}`);
  return res.json();
}
