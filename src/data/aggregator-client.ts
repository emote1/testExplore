/**
 * Reef Aggregator API Client
 *
 * Provides typed access to aggregator endpoints.
 * Switches between mock (local JSON) and real API based on env.
 */

// Types matching OpenAPI schema
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

export interface TopEntity {
  account: string;
  rank: number;
  degreeIn?: number;
  degreeOut?: number;
  weightSum?: number;
  pagerank?: number;
}

export interface TopEntitiesResponse {
  asOf: string;
  metric: string;
  items: TopEntity[];
}

// Config
const AGGREGATOR_BASE_URL = import.meta.env.VITE_AGGREGATOR_URL || '';
const USE_MOCK = !AGGREGATOR_BASE_URL;

function getBaseUrl(): string {
  return USE_MOCK ? '' : AGGREGATOR_BASE_URL;
}

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const url = USE_MOCK ? path : `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Aggregator API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// API Functions

export async function getGrowth24h(signal?: AbortSignal): Promise<Growth24hResponse> {
  const path = USE_MOCK
    ? '/mock-aggregator/metrics-growth24h.json'
    : '/v1/metrics/growth24h';
  return fetchJson<Growth24hResponse>(path, signal);
}

export async function getExtrinsicsSparkline(
  hours = 24,
  signal?: AbortSignal
): Promise<ExtrinsicsSparklineResponse> {
  const path = USE_MOCK
    ? '/mock-aggregator/sparklines-extrinsics-24h.json'
    : `/v1/sparklines/extrinsics?hours=${hours}`;
  return fetchJson<ExtrinsicsSparklineResponse>(path, signal);
}

export async function getActiveWalletsSparkline(
  hours = 24,
  signal?: AbortSignal
): Promise<ActiveWalletsSparklineResponse> {
  const path = USE_MOCK
    ? '/mock-aggregator/sparklines-active-wallets-24h.json'
    : `/v1/sparklines/active-wallets?hours=${hours}`;
  return fetchJson<ActiveWalletsSparklineResponse>(path, signal);
}

export interface DailyWalletsSparklinePoint {
  ts: string;
  active: number;
  new: number;
}

export interface DailyWalletsSparklineResponse {
  days: number;
  series: DailyWalletsSparklinePoint[];
}

export async function getActiveWalletsSparklineDaily(
  days = 30,
  signal?: AbortSignal
): Promise<DailyWalletsSparklineResponse> {
  if (USE_MOCK) {
    // Generate mock daily data for 30 days
    const series: DailyWalletsSparklinePoint[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      series.push({
        ts: d.toISOString().split('T')[0],
        active: Math.floor(100 + Math.random() * 200),
        new: Math.floor(10 + Math.random() * 50),
      });
    }
    return { days, series };
  }
  return fetchJson<DailyWalletsSparklineResponse>(
    `/v1/sparklines/active-wallets-daily?days=${days}`,
    signal
  );
}

// Daily extrinsics sparklines
export interface DailyExtrinsicsSparklinePoint {
  ts: string;
  extrinsics: number;
}

export interface DailyExtrinsicsSparklineResponse {
  days: number;
  series: DailyExtrinsicsSparklinePoint[];
}

export async function getExtrinsicsSparklineDaily(
  days = 30,
  signal?: AbortSignal
): Promise<DailyExtrinsicsSparklineResponse> {
  if (USE_MOCK) {
    // Generate mock daily data for 30 days
    const series: DailyExtrinsicsSparklinePoint[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      series.push({
        ts: d.toISOString().split('T')[0],
        extrinsics: Math.floor(8000 + Math.random() * 4000),
      });
    }
    return { days, series };
  }
  return fetchJson<DailyExtrinsicsSparklineResponse>(
    `/v1/sparklines/extrinsics-daily?days=${days}`,
    signal
  );
}

export async function getTopEntities(
  options: {
    hours?: number;
    metric?: 'in_degree' | 'out_degree' | 'total_degree' | 'pagerank';
    limit?: number;
  } = {},
  signal?: AbortSignal
): Promise<TopEntitiesResponse> {
  const { hours = 24, metric = 'total_degree', limit = 20 } = options;
  if (USE_MOCK) {
    // Return mock data (not implemented yet)
    return {
      asOf: new Date().toISOString(),
      metric,
      items: [],
    };
  }
  const params = new URLSearchParams({
    hours: String(hours),
    metric,
    limit: String(limit),
  });
  return fetchJson<TopEntitiesResponse>(`/v1/top-entities?${params}`, signal);
}

// Export config for debugging
export const aggregatorConfig = {
  baseUrl: AGGREGATOR_BASE_URL,
  useMock: USE_MOCK,
};
