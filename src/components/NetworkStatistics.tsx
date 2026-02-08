import React from 'react';
import { Activity, ChevronDown, ChevronUp, LineChart, Lock } from 'lucide-react';
import { TpsSparkline } from './TpsSparkline';
import { useWsStatus } from '../hooks/use-ws-status';
import { useTpsLive } from '../hooks/use-tps-live';
import { useTotalStaked } from '../hooks/use-total-staked';
import { useReefPrice } from '../hooks/use-reef-price';
import { useActiveWallets24hIcp } from '../hooks/use-active-wallets-24h-icp';
import { useNewWalletsInflowIcp } from '../hooks/use-new-wallets-inflow-icp';
import { AddressDisplay } from './AddressDisplay';
import { useSquidHealth } from '../hooks/use-squid-health';

const ICP_CRON_INTERVAL_HOURS = Number(import.meta.env.VITE_ICP_CRON_INTERVAL_HOURS ?? '4');

function formatEta(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'soon';
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatNextUpdate(asOf: string | undefined, now: Date): string | null {
  if (!asOf || !Number.isFinite(ICP_CRON_INTERVAL_HOURS) || ICP_CRON_INTERVAL_HOURS <= 0) return null;
  const asOfDate = new Date(asOf);
  if (Number.isNaN(asOfDate.getTime())) return null;
  const intervalMs = ICP_CRON_INTERVAL_HOURS * 60 * 60 * 1000;
  const nowMs = now.getTime();
  let nextMs = asOfDate.getTime() + intervalMs;
  if (nowMs >= nextMs) {
    const periods = Math.floor((nowMs - asOfDate.getTime()) / intervalMs) + 1;
    nextMs = asOfDate.getTime() + periods * intervalMs;
  }
  return `Next update in ${formatEta(nextMs - nowMs)}`;
}

const REEF_STANDARD_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

function formatCompactReef(value?: string): string | null {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const abs = Math.abs(numeric);
  const formatScaled = (scaled: number, suffix: string) => {
    const truncated = Math.trunc(scaled * 100) / 100;
    return `${truncated.toFixed(2)}${suffix}`;
  };
  if (abs >= 1_000_000_000) return formatScaled(numeric / 1_000_000_000, 'B');
  if (abs >= 1_000_000) return formatScaled(numeric / 1_000_000, 'M');
  if (abs >= 1_000) return formatScaled(numeric / 1_000, 'K');
  return REEF_STANDARD_FORMATTER.format(numeric);
}

function formatMinReef(raw?: string): string | null {
  if (!raw) return null;
  try {
    const value = BigInt(raw);
    const base = 10n ** 18n;
    const whole = value / base;
    const formatted = formatCompactReef(whole.toString()) ?? whole.toString();
    return `${formatted} REEF`;
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

  const staked = useTotalStaked();
  const { price: reefPrice } = useReefPrice();
  const stakedValueText = React.useMemo(() => {
    if (staked.loading) return '…';
    if (staked.totalStakedReef === 0) return '—';
    const v = staked.totalStakedReef;
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    return v.toLocaleString();
  }, [staked.loading, staked.totalStakedReef]);
  const stakedUsdText = React.useMemo(() => {
    if (staked.loading || !reefPrice?.usd || staked.totalStakedReef === 0) return null;
    const usd = staked.totalStakedReef * reefPrice.usd;
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
    return `$${usd.toFixed(2)}`;
  }, [staked.loading, staked.totalStakedReef, reefPrice?.usd]);

  const activeIcp = useActiveWallets24hIcp();
  const inflow = useNewWalletsInflowIcp();
  const [now, setNow] = React.useState(() => new Date());
  const [showAllInflow, setShowAllInflow] = React.useState(false);
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
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
    if (!activeIcp.asOf) return 'ICP: Active wallets in 24h. Chart: daily';
    const to = new Date(activeIcp.asOf);
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `${fmt(from)} → ${fmt(to)}
Active wallets chart: ${activeIcp.sparkDated.length} days`;
  }, [activeIcp.enabled, activeIcp.asOf, activeIcp.sparkDated.length]);

  const inflowMinText = React.useMemo(
    () => formatMinReef(inflow.data?.minRaw),
    [inflow.data?.minRaw]
  );
  const inflowEntries = inflow.data?.entries ?? [];
  const inflowMaxVisible = 5;
  const inflowVisibleEntries = showAllInflow
    ? inflowEntries
    : inflowEntries.slice(0, inflowMaxVisible);
  const inflowHiddenCount = Math.max(0, inflowEntries.length - inflowVisibleEntries.length);
  const inflowAsOfText = inflow.data?.asOf
    ? new Date(inflow.data.asOf).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  const inflowNextUpdateText = React.useMemo(
    () => (inflow.enabled ? formatNextUpdate(inflow.data?.asOf, now) : null),
    [inflow.enabled, inflow.data?.asOf, now]
  );

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
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] gap-4">
          <div className="space-y-4">
            <StatCard
              title="Active Wallets (24h, ICP)"
              value={activeIcpValueText}
              delta={activeIcpDeltaText}
              tooltip={activeIcpTooltip}
              icon={<LineChart className="h-6 w-6 text-emerald-600" />}
              color="emerald"
              sparkClassName="h-[137px]"
              sparkNode={
                activeIcp.enabled && activeIcp.sparkDated.length > 0 ? (
                  <div className="relative h-full w-full rounded-lg overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-100/80 via-emerald-50/40 to-transparent" />
                    <div className="relative flex items-end justify-center gap-[3px] h-full w-full px-2 py-1">
                      {activeIcp.sparkDated.map((pt) => {
                        const maxVal = Math.max(...activeIcp.sparkDated.map(p => p.value ?? 0), 1);
                        const dayLabel = new Date(pt.ts + 'T00:00:00Z').toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                        if (pt.value === null) {
                          return (
                            <div
                              key={pt.ts}
                              className="flex-1 max-w-2 self-end rounded-sm bg-emerald-100 border border-dashed border-emerald-300/80 cursor-default"
                              style={{ height: '20px' }}
                              title={`${dayLabel}: no data`}
                            />
                          );
                        }
                        const h = Math.max(15, (pt.value / maxVal) * 100);
                        return (
                          <div
                            key={pt.ts}
                            className="flex-1 max-w-3 rounded-sm transition-all cursor-pointer bg-gradient-to-t from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 hover:scale-110 shadow-sm"
                            style={{ height: `${h}%` }}
                            title={`${dayLabel}: ${pt.value} active wallets (ICP)`}
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
            <div className="rounded-2xl border border-white/60 bg-white/60 backdrop-blur-sm p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-gray-800">New Wallets Inflow (24h, ICP)</div>
                  <div className="text-xs text-gray-500">
                    {inflowMinText ? `≥ ${inflowMinText}` : 'Minimum not set'}
                    {inflowAsOfText ? ` • Updated ${inflowAsOfText}` : ''}
                    {inflowNextUpdateText ? ` • ${inflowNextUpdateText}` : ''}
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
                    {inflowVisibleEntries.map((entry) => {
                      const formattedReef = formatCompactReef(entry.incomingReef) ?? entry.incomingReef;
                      return (
                      <div
                        key={entry.address}
                        className="flex items-center justify-between gap-4 rounded-xl border border-emerald-100/60 bg-emerald-50/40 px-3 py-2"
                      >
                        <AddressDisplay
                          address={entry.address}
                          className="inline-block text-sm font-mono text-emerald-900 bg-white/60 px-2 py-1 rounded"
                          copyable
                        />
                        <div
                          className="text-sm font-semibold text-emerald-900 tabular-nums"
                          title={`${entry.incomingReef} REEF`}
                        >
                          {formattedReef} REEF
                        </div>
                      </div>
                      );
                    })}
                    {inflowHiddenCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowAllInflow((prev) => !prev)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200/60 bg-white/70 px-3 py-2 text-xs font-medium text-emerald-800 shadow-sm transition hover:bg-white"
                      >
                        {showAllInflow ? 'Show less' : `Show ${inflowHiddenCount} more`}
                        {showAllInflow ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              title="Total Staked"
              value={`${stakedValueText} REEF`}
              delta={staked.loading ? '…' : `${staked.stakedPct.toFixed(1)}%`}
              tooltip={staked.era != null ? `Era ${staked.era} • ${staked.validatorCount} validators\n${staked.stakedPct.toFixed(2)}% of total supply staked` : 'Total REEF staked across all validators'}
              icon={<Lock className="h-6 w-6 text-amber-600" />}
              color="orange"
              sparkClassName="h-[137px]"
              sparkNode={
                <div className="relative h-full w-full rounded-lg overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-amber-100/80 via-amber-50/40 to-transparent" />
                  <div className="relative flex flex-col items-center justify-center h-full gap-3 px-4">
                    {/* Progress bar */}
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">Staked</span>
                        <span className="text-xs font-medium text-amber-700">
                          {staked.loading ? '…' : `${staked.stakedPct.toFixed(1)}%`}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-200/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-700"
                          style={{ width: `${Math.min(staked.stakedPct, 100)}%` }}
                        />
                      </div>
                    </div>
                    {/* Details */}
                    <div className="flex items-center justify-between w-full text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{staked.loading ? '…' : staked.validatorCount}</span>
                        <span>validators</span>
                      </div>
                      {stakedUsdText ? (
                        <span className="font-medium text-amber-700">{stakedUsdText}</span>
                      ) : null}
                      {staked.era != null ? (
                        <div className="flex items-center gap-1">
                          <span>Era</span>
                          <span className="font-medium">{staked.era.toLocaleString()}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              }
            />
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
