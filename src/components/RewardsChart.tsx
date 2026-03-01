import { useMemo, useState, memo } from 'react';
import { useStakingRewardsSeries } from '@/hooks/use-staking-rewards-series';
import { useReefPrice } from '@/hooks/use-reef-price';
import { TrendingUp, Loader2 } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';

interface RewardsChartProps {
  address: string;
}

interface ChartPoint {
  ts: number;
  date: string;
  value: number;
}

const RANGES = [
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: '365d', label: '1Y', days: 365 },
] as const;

export const RewardsChart = memo(function RewardsChart({ address }: RewardsChartProps) {
  const { price } = useReefPrice();
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('90d');
  const { daily: dailyBase, loading, error } = useStakingRewardsSeries(address, '365d');

  const reefCompact = useMemo(
    () => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }),
    []
  );

  const data: ChartPoint[] = useMemo(() => {
    if (!dailyBase || dailyBase.length === 0) return [];

    const byDate = new Map<string, number>();
    for (const p of dailyBase) byDate.set(p.date, p.sumReef);

    const MS_DAY = 24 * 60 * 60 * 1000;
    const todayUtcMid = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime();
    const opt = RANGES.find((r) => r.key === range);
    const days = opt?.days ?? 90;
    const endTs = todayUtcMid;
    const startTs = todayUtcMid - (days - 1) * MS_DAY;

    const filled: ChartPoint[] = [];
    let cumulative = 0;
    for (let t = startTs; t <= endTs; t += MS_DAY) {
      const d = new Date(t).toISOString().slice(0, 10);
      const v = byDate.get(d) ?? 0;
      cumulative += v;
      filled.push({ date: d, ts: t, value: cumulative });
    }
    return filled;
  }, [dailyBase, range]);

  const totals = useMemo(() => {
    if (!dailyBase || dailyBase.length === 0) return { '30d': 0, '90d': 0, '365d': 0 };
    const todayMs = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime();
    const MS_DAY = 24 * 60 * 60 * 1000;
    const result: Record<string, number> = {};
    for (const r of RANGES) {
      const cutoffMs = todayMs - (r.days - 1) * MS_DAY;
      const cutoffStr = new Date(cutoffMs).toISOString().slice(0, 10);
      const sum = dailyBase.filter((p) => p.date >= cutoffStr).reduce((acc, p) => acc + p.sumReef, 0);
      result[r.key] = sum;
    }
    return result as Record<'30d' | '90d' | '365d', number>;
  }, [dailyBase]);

  const currentUsd = price?.usd ?? 0;
  const totalReef = totals[range] ?? 0;
  const totalUsd = totalReef * currentUsd;

  const formatReef = useMemo(() => (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(0);
  }, []);

  const xTickFormatter = useMemo(() => (ts: number) => {
    const d = new Date(ts);
    return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  }, []);

  const yTickFormatter = useMemo(() => (v: number) => reefCompact.format(v), [reefCompact]);

  const tooltipLabelFormatter = useMemo(() => (ts: number | string) => {
    const d = new Date(Number(ts));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  const tooltipValueFormatter = useMemo(() => (value: number) => [
    `${formatReef(value)} REEF`, 'Cumulative'
  ] as [string, string], [formatReef]);

  const tickStyle = useMemo(() => ({ fontSize: 10, fill: '#94a3b8' }), []);
  const tooltipContentStyle = useMemo(() => ({
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '12px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  }), []);
  const chartMargin = useMemo(() => ({ top: 10, right: 10, left: 0, bottom: 0 }), []);
  const xDomain = useMemo(() => ['dataMin', 'dataMax'] as const, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
        Error loading rewards data
      </div>
    );
  }

  if (loading && data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 flex items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
        <span className="text-slate-500">Loading rewards...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
        No staking rewards data available
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-100">
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </div>
          <span className="font-semibold text-slate-800">Rewards Analytics</span>
        </div>
        {/* Range selector */}
        <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                range === r.key
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-b from-slate-50 to-white">
        <div className="text-center">
          <div className="text-xs text-slate-500 mb-0.5">Total Rewards</div>
          <div className="text-lg font-bold text-slate-800">{formatReef(totalReef)} REEF</div>
        </div>
        <div className="text-center border-x border-slate-200">
          <div className="text-xs text-slate-500 mb-0.5">USD Value</div>
          <div className="text-lg font-bold text-emerald-600">
            ${totalUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-500 mb-0.5">Daily Avg</div>
          <div className="text-lg font-bold text-slate-800">
            {formatReef(totalReef / (RANGES.find((r) => r.key === range)?.days ?? 90))} REEF
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 px-2 pb-3">
        <ResponsiveContainer width="100%" height="100%" debounce={100}>
          <AreaChart data={data} margin={chartMargin}>
            <defs>
              <linearGradient id="rewardGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={xDomain}
              tick={tickStyle}
              tickLine={false}
              axisLine={false}
              tickFormatter={xTickFormatter}
              minTickGap={40}
            />
            <YAxis
              tick={tickStyle}
              tickLine={false}
              axisLine={false}
              width={50}
              tickFormatter={yTickFormatter}
            />
            <RechartsTooltip
              contentStyle={tooltipContentStyle}
              labelFormatter={tooltipLabelFormatter}
              formatter={tooltipValueFormatter}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#a855f7"
              strokeWidth={2}
              fill="url(#rewardGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
