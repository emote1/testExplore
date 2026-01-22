import React from 'react';
import { Wallet, Activity, LineChart, TrendingUp } from 'lucide-react';
import { TpsSparkline } from './TpsSparkline';
import { useWsStatus } from '../hooks/use-ws-status';
import { useTpsLive } from '../hooks/use-tps-live';
import { useNetworkGrowthAggregator } from '../hooks/use-network-growth-aggregator';
import { useActiveWallets24h } from '../hooks/use-active-wallets-24h';
import { useActiveWallets24hIcp } from '../hooks/use-active-wallets-24h-icp';
import { useNewWalletsInflowIcp } from '../hooks/use-new-wallets-inflow-icp';
import { AddressDisplay } from './AddressDisplay';
import { useSquidHealth } from '../hooks/use-squid-health';

const ICP_DAILY_UPDATE_UTC = import.meta.env.VITE_ICP_DAILY_UPDATE_UTC || '';

function parseUtcTime(value: string): { hour: number; minute: number } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function formatEta(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'soon';
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatMinReef(raw?: string): string | null {
  if (!raw) return null;
  try {
    const value = BigInt(raw);
    const base = 10n ** 18n;
    const whole = value / base;
    return `${whole.toString()} REEF`;
  } catch {
    return null;
  }
}

export function NetworkStatistics() {
  const { perMin, tpsTrend } = useTpsLive(60, 'extrinsics');
  const perMinText = Number.isFinite(perMin) && perMin >= 0 ? perMin.toFixed(0) : '0';
  const ws = useWsStatus();
  const squid = useSquidHealth({ intervalMs: 30_000 });
  const wsOk = ws.tone === 'live';
  const squidOk = squid.status === 'live';
  const squidLoading = squid.status === 'loading';
  const combinedLabel = wsOk && squidOk
    ? 'Live'
    : (!wsOk && !squidOk && !squidLoading)
      ? 'WS + Subsquid Down'
      : (!wsOk ? 'WS Down' : (squidLoading ? 'Connecting' : 'Subsquid Down'));
  const combinedTone = wsOk && squidOk
    ? 'live'
    : (ws.tone === 'error' || squid.status === 'down')
      ? 'error'
      : squidLoading
        ? 'info'
        : 'warning';
  const combinedStyles = {
    live: { dot: 'bg-emerald-500', text: 'text-emerald-700' },
    warning: { dot: 'bg-yellow-500', text: 'text-yellow-700' },
    error: { dot: 'bg-red-500', text: 'text-red-700' },
    info: { dot: 'bg-blue-500', text: 'text-blue-700' },
  } as const;
  const combinedStyle = combinedStyles[combinedTone];

  const growth = useNetworkGrowthAggregator();
  const growthValueText = React.useMemo(() => {
    if (growth.loading) return '…';
    if (growth.last24h == null) return '—';
    return growth.last24h.toLocaleString();
  }, [growth.loading, growth.last24h]);
  const growthDeltaText = React.useMemo(() => {
    if (growth.loading) return '…';
    if (growth.growthPct == null) return '—';
    const v = growth.growthPct;
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
  }, [growth.loading, growth.growthPct]);

  const active = useActiveWallets24h();
  const activeIcp = useActiveWallets24hIcp();
  const inflow = useNewWalletsInflowIcp();
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const activeValueText = React.useMemo(() => {
    if (active.loading) return '…';
    if (active.last24h == null) return '—';
    return active.last24h.toLocaleString();
  }, [active.loading, active.last24h]);
  const activeDeltaText = React.useMemo(() => {
    if (active.loading) return '…';
    const v = active.growthPct;
    if (v == null) return '—';
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
  }, [active.loading, active.growthPct]);
  const activeTooltip = React.useMemo(() => {
    if (!active.asOf) return 'Unique wallets in 24h. Chart: daily';
    const to = new Date(active.asOf);
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `${fmt(from)} → ${fmt(to)}\nChart: ${active.spark.length} days`;
  }, [active.asOf, active.spark.length]);

  const activeIcpValueText = React.useMemo(() => {
    if (!activeIcp.enabled) return '—';
    if (activeIcp.loading) return '…';
    if (activeIcp.last24h == null) return '—';
    return activeIcp.last24h.toLocaleString();
  }, [activeIcp.enabled, activeIcp.loading, activeIcp.last24h]);
  const activeIcpDeltaText = React.useMemo(() => {
    if (!activeIcp.enabled) return 'ICP off';
    if (activeIcp.loading) return '…';
    const v = activeIcp.growthPct;
    if (v == null) return '—';
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
  }, [activeIcp.enabled, activeIcp.loading, activeIcp.growthPct]);
  const activeIcpTooltip = React.useMemo(() => {
    if (!activeIcp.enabled) return 'Set VITE_ICP_ACTIVE_WALLETS_DAILY_URL to enable ICP data.';
    if (!activeIcp.asOf) return 'ICP: New wallets in 24h. Chart: daily';
    const to = new Date(activeIcp.asOf);
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `${fmt(from)} → ${fmt(to)}\nICP chart: ${activeIcp.spark.length} days`;
  }, [activeIcp.enabled, activeIcp.asOf, activeIcp.spark.length]);

  const nextUpdateText = React.useMemo(() => {
    if (!activeIcp.enabled) return null;
    const time = parseUtcTime(ICP_DAILY_UPDATE_UTC);
    if (!time) return null;
    const nextUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), time.hour, time.minute, 0));
    if (now.getTime() >= nextUtc.getTime()) {
      nextUtc.setUTCDate(nextUtc.getUTCDate() + 1);
    }
    const timeLabel = nextUtc.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
    const eta = formatEta(nextUtc.getTime() - now.getTime());
    return `Next update ~${timeLabel} UTC (${eta})`;
  }, [activeIcp.enabled, now]);

  const inflowMinText = React.useMemo(
    () => formatMinReef(inflow.data?.minRaw),
    [inflow.data?.minRaw]
  );
  const inflowEntries = inflow.data?.entries ?? [];
  const inflowAsOfText = inflow.data?.asOf
    ? new Date(inflow.data.asOf).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Glass background gradient */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 via-purple-50/30 to-pink-100/50 rounded-2xl blur-xl" />
        <div className="relative bg-white/40 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Network Statistics</h2>
        <div className={`inline-flex items-center gap-2 text-sm ${combinedStyle.text}`}>
          <span className={`w-2 h-2 rounded-full ${combinedStyle.dot} ${combinedTone === 'live' || combinedTone === 'info' ? 'animate-pulse' : ''}`} />
          <span>{combinedLabel}</span>
          {nextUpdateText ? <span className="text-gray-500">• {nextUpdateText}</span> : null}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="New Wallets (24h, ICP)"
          value={activeIcpValueText}
          delta={activeIcpDeltaText}
          tooltip={activeIcpTooltip}
          icon={<LineChart className="h-6 w-6 text-emerald-600" />}
          color="emerald"
          sparkClassName="h-[137px]"
          sparkNode={
            activeIcp.enabled && activeIcp.spark.length > 0 ? (
              <div className="relative h-full w-full rounded-lg overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-100/80 via-emerald-50/40 to-transparent" />
                <div className="relative flex items-end justify-center gap-[3px] h-full w-full px-2 py-1">
                  {activeIcp.spark.map((val, i) => {
                    const maxVal = Math.max(...activeIcp.spark, 1);
                    const h = Math.max(15, (val / maxVal) * 100);
                    const day = new Date(Date.now() - (activeIcp.spark.length - 1 - i) * 24 * 60 * 60 * 1000);
                    const dayLabel = day.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                    return (
                      <div
                        key={i}
                        className="flex-1 max-w-3 rounded-sm transition-all cursor-pointer bg-gradient-to-t from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 hover:scale-110 shadow-sm"
                        style={{ height: `${h}%` }}
                        title={`${dayLabel}: ${val} new wallets (ICP)`}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm bg-gradient-to-t from-emerald-50/50 to-transparent rounded-lg">
                {activeIcp.enabled ? 'No ICP data yet' : 'ICP URL not set'}
              </div>
            )
          }
        />
        <StatCard
          title="Active Wallets (24h)"
          value={activeValueText}
          delta={activeDeltaText}
          tooltip={activeTooltip}
          icon={<Wallet className="h-6 w-6 text-blue-600" />}
          color="blue"
          sparkClassName="h-[137px]"
          sparkNode={
            active.spark.length > 0 ? (
              <div className="relative h-full w-full rounded-lg overflow-hidden">
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-t from-blue-100/80 via-blue-50/40 to-transparent" />
                <div className="relative flex items-end justify-center gap-[3px] h-full w-full px-2 py-1">
                  {active.spark.map((val, i) => {
                    const maxVal = Math.max(...active.spark, 1);
                    const h = Math.max(15, (val / maxVal) * 100);
                    const day = new Date(Date.now() - (active.spark.length - 1 - i) * 24 * 60 * 60 * 1000);
                    const dayLabel = day.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                    return (
                      <div
                        key={i}
                        className="flex-1 max-w-3 rounded-sm transition-all cursor-pointer bg-gradient-to-t from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300 hover:scale-110 shadow-sm"
                        style={{ height: `${h}%` }}
                        title={`${dayLabel}: ${val} wallets`}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm bg-gradient-to-t from-blue-50/50 to-transparent rounded-lg">
                Run cron to collect data
              </div>
            )
          }
        />
        <StatCard
          title="Tx/min (Live)"
          value={`${perMinText} tx/min`}
          valueNode={
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-gray-800 tabular-nums">{perMinText}</span>
              <span className="text-sm text-gray-500 font-medium">tx/min</span>
            </div>
          }
          sparkNode={<TpsSparkline series={tpsTrend} trendWin={60} trendRes={24} trendZoom={1.1} height={20} width={40} xpad={4} emaAlpha={0.08} fixedXFrac={0.5} yPadPx={6} pathAnimMs={1500} />}
          sparkClassName="h-[137px]"
          delta="Live"
          icon={<Activity className="h-6 w-6 text-violet-600" />}
          color="violet"
        />
        <StatCard
          title="Transactions (24h)"
          value={growthValueText}
          delta={growthDeltaText}
          tooltip={growth.asOf ? `Total transactions in 24h\nChart: ${growth.spark.length} days` : 'Total transactions in last 24 hours'}
          icon={<TrendingUp className="h-6 w-6 text-orange-600" />}
          color="orange"
          sparkClassName="h-[137px]"
          sparkNode={
            growth.spark.length > 0 ? (
              <div className="relative h-full w-full rounded-lg overflow-hidden">
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-t from-orange-100/80 via-amber-50/40 to-transparent" />
                <div className="relative flex items-end justify-center gap-[3px] h-full w-full px-2 py-1">
                  {growth.spark.map((val, i) => {
                    const maxVal = Math.max(...growth.spark, 1);
                    const h = Math.max(15, (val / maxVal) * 100);
                    const day = new Date(Date.now() - (growth.spark.length - 1 - i) * 24 * 60 * 60 * 1000);
                    const dayLabel = day.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                    return (
                      <div
                        key={i}
                        className="flex-1 max-w-3 rounded-sm transition-all cursor-pointer bg-gradient-to-t from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 hover:scale-110 shadow-sm"
                        style={{ height: `${h}%` }}
                        title={`${dayLabel}: ${val.toLocaleString()} txs`}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm bg-gradient-to-t from-orange-50/50 to-transparent rounded-lg">
                Run cron to collect data
              </div>
            )
          }
        />
        </div>
        <div className="mt-6 rounded-2xl border border-white/60 bg-white/60 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-800">New Wallets Inflow (24h, ICP)</div>
              <div className="text-xs text-gray-500">
                {inflowMinText ? `≥ ${inflowMinText}` : 'Minimum not set'}
                {inflowAsOfText ? ` • Updated ${inflowAsOfText}` : ''}
              </div>
            </div>
            {inflow.data ? (
              <div className="text-xs text-gray-500">
                Qualified {inflow.data.qualified}/{inflow.data.totalNew}
                {inflow.data.truncated ? ` • Top ${inflowEntries.length}` : ''}
              </div>
            ) : null}
          </div>

          <div className="mt-3">
            {!inflow.enabled ? (
              <div className="text-sm text-gray-500">ICP URL not set</div>
            ) : inflow.loading ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : inflowEntries.length === 0 ? (
              <div className="text-sm text-gray-500">No wallets above the threshold yet.</div>
            ) : (
              <div className="space-y-2">
                {inflowEntries.map((entry) => (
                  <div
                    key={entry.address}
                    className="flex items-center justify-between gap-4 rounded-xl border border-emerald-100/60 bg-emerald-50/40 px-3 py-2"
                  >
                    <AddressDisplay
                      address={entry.address}
                      className="inline-block text-sm font-mono text-emerald-900 bg-white/60 px-2 py-1 rounded"
                    />
                    <div className="text-sm font-semibold text-emerald-900 tabular-nums">
                      {entry.incomingReef} REEF
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </section>
  );
}

// StatCard component
interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  tooltip?: string;
  valueNode?: React.ReactNode;
  sparkNode?: React.ReactNode;
  sparkClassName?: string;
  bottomChart?: React.ReactNode;
  delta: string;
  icon: React.ReactNode;
  color: 'emerald' | 'blue' | 'violet' | 'orange';
}

function StatCard({ title, value, sub, tooltip, valueNode, sparkNode, sparkClassName, bottomChart, delta, icon, color }: StatCardProps) {
  const paths: Record<StatCardProps['color'], string> = {
    emerald: 'M2 10 C6 7,10 12,14 9, 18 8,22 11,26 10, 30 12,34 11,38 12',
    blue: 'M2 12 C6 11,10 13,14 12, 18 10,22 12,26 11, 30 12,34 12,38 12',
    violet: 'M2 11 C6 9,10 12,14 10, 18 12,22 10,26 13, 30 12,34 13,38 12',
    orange: 'M2 12 C6 13,10 12,14 13, 18 12,22 13,26 12, 30 11,34 12,38 11',
  };
  const stroke = {
    emerald: '#10b981',
    blue: '#2563eb',
    violet: '#7c3aed',
    orange: '#f59e0b',
  }[color];

  const glowColor = {
    emerald: 'hover:shadow-emerald-200/50',
    blue: 'hover:shadow-blue-200/50',
    violet: 'hover:shadow-violet-200/50',
    orange: 'hover:shadow-orange-200/50',
  }[color];

  const iconBg = {
    emerald: 'bg-emerald-100/80 border-emerald-200/50',
    blue: 'bg-blue-100/80 border-blue-200/50',
    violet: 'bg-violet-100/80 border-violet-200/50',
    orange: 'bg-orange-100/80 border-orange-200/50',
  }[color];

  return (
    <div className={`group relative rounded-2xl bg-white/70 backdrop-blur-md p-6 border border-white/50 shadow-lg hover:shadow-xl ${glowColor} transition-all duration-300 hover:scale-[1.02] hover:bg-white/80`}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent rounded-xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between text-gray-700 text-sm">
          <span className="inline-flex items-center gap-2 cursor-help font-medium" title={tooltip}>{title}</span>
          <span className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${iconBg} border backdrop-blur-sm shadow-sm`}>
            {icon}
          </span>
        </div>
      <div className={`mt-2 ${sparkClassName ?? 'h-20'}`}>
        {sparkNode ? (
          sparkNode
        ) : (
          <svg viewBox="0 0 40 20" className="w-full h-full" preserveAspectRatio="none">
            <path d={paths[color]} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div>
          {valueNode ? (
            <div>{valueNode}</div>
          ) : (
            <div className="text-2xl font-semibold text-gray-800 tabular-nums">{value}</div>
          )}
          {sub ? <div className="text-xs text-gray-500">{sub}</div> : null}
        </div>
        <div className={`text-xs px-2 py-1 rounded-lg border backdrop-blur-sm font-medium ${delta.startsWith('-') ? 'text-red-600 bg-red-100/70 border-red-200/50' : 'text-emerald-600 bg-emerald-100/70 border-emerald-200/50'}`}>{delta}</div>
      </div>
      {bottomChart}
      </div>
    </div>
  );
}
