// Mock daily series for the metrics dashboard.
// 30 data points each, matching DAILY_DATES below.
// TODO: replace with real data from aggregator API (`/v1/sparklines` endpoint).

export const DAILY_DATES: readonly string[] = [
  'Apr 20', 'Apr 21', 'Apr 22', 'Apr 23', 'Apr 24', 'Apr 25', 'Apr 26',
  'Apr 27', 'Apr 28', 'Apr 29', 'Apr 30',
  'May 1', 'May 2', 'May 3', 'May 4', 'May 5', 'May 6', 'May 7', 'May 8', 'May 9', 'May 10',
  'May 11', 'May 12', 'May 13', 'May 14', 'May 15', 'May 16', 'May 17', 'May 18', 'May 19',
] as const;

export const DAILY_SERIES = {
  active: [15200, 14800, 15500, 16200, 14900, 13500, 12800, 14100, 15600, 16800, 17200, 16400, 15100, 14500, 15800, 17300, 18100, 17500, 16200, 14800, 15400, 16800, 17600, 18900, 17800, 16500, 15900, 17400, 18700, 18432],
  staked: [7.18, 7.19, 7.20, 7.21, 7.21, 7.22, 7.22, 7.23, 7.24, 7.25, 7.25, 7.26, 7.27, 7.27, 7.28, 7.28, 7.29, 7.30, 7.30, 7.31, 7.31, 7.32, 7.32, 7.33, 7.33, 7.33, 7.34, 7.34, 7.34, 7.34],
  blocks: [9.8, 10.1, 10.0, 9.9, 10.2, 10.0, 9.7, 10.1, 10.3, 10.0, 9.9, 10.2, 10.1, 9.8, 10.0, 10.3, 10.1, 9.9, 10.2, 10.0, 9.8, 10.1, 10.0, 10.2, 10.1, 10.0, 9.9, 10.1, 10.0, 10.0],
} as const;

export interface Metric {
  id: 'active' | 'staked' | 'blocks';
  label: string;
  value: string;
  unit?: string;
  suffix?: string;
  change?: number;
  live?: boolean;
  accent: string;
  series: readonly number[];
  /** Optional date labels parallel to series; when omitted, callers fall back to DAILY_DATES. */
  dates?: readonly string[];
  /** Subtitle shown in the expanded chart header, e.g. "daily · last 30d" or "live · last 60s". */
  chartSubtitle?: string;
  format?: (v: number) => string;
}

export const METRICS: readonly Metric[] = [
  {
    id: 'active',
    label: 'Active Wallets',
    value: '18,432',
    unit: '(24h)',
    change: +12.4,
    accent: '#7DD3DA',
    series: DAILY_SERIES.active,
    format: (v) => `${v.toLocaleString()} wallets`,
  },
  {
    id: 'staked',
    label: 'Total Staked',
    value: '7.34',
    unit: 'B REEF',
    change: +0.8,
    accent: '#5BC0D9',
    series: DAILY_SERIES.staked,
    format: (v) => `${v.toFixed(2)}B REEF`,
  },
  {
    id: 'blocks',
    label: 'Blocks/min',
    value: '10',
    suffix: '(Live)',
    live: true,
    change: 0,
    accent: '#A8DFE5',
    series: DAILY_SERIES.blocks,
    format: (v) => `${v.toFixed(1)} blocks/min`,
  },
] as const;

