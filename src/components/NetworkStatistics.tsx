import React from 'react';
import ReactDOM from 'react-dom';
import { Activity, ChevronDown, ChevronUp, LineChart, Lock, X } from 'lucide-react';
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
const EXPLORER_BACKEND = String(import.meta.env.VITE_REEF_EXPLORER_BACKEND ?? '').toLowerCase();
const WS_HEALTH_ENABLED = EXPLORER_BACKEND !== 'hasura';

const TRUSTED_VALIDATORS: { address: string; name: string }[] = [
  { address: '5DqZcoLR729bLBr8hLjEsg944JiFq5kAjjcBEF3XKUNpTHdr', name: "Pierre's" },
  { address: '5HGbjiLeyCxbsGXqtM1pPwsJ3UfcAR2WFBcXr2f4FUkmKFLu', name: "Pierre's" },
  { address: '5D7rGZNioSv3gDJGaJLUsXqWfgZe2DYAxGouda2usgNmjpFE', name: "Pierre's" },
];

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
  const { perMin, tpsTrend } = useTpsLive(60, 'blocks');
  const perMinText = Number.isFinite(perMin) && perMin >= 0 ? perMin.toFixed(0) : '0';
  const ws = useWsStatus();
  const squid = useSquidHealth({ intervalMs: 30_000 });
  const wsOk = !WS_HEALTH_ENABLED || ws.tone === 'live';
  const squidOk = squid.status === 'live';
  const squidLoading = squid.status === 'loading';
  const squidDownLabel = WS_HEALTH_ENABLED ? 'Subsquid Down' : 'Data Down';
  const combinedLabel = wsOk && squidOk
    ? 'Live'
    : (!wsOk && !squidOk && !squidLoading)
      ? 'WS + Subsquid Down'
      : (!wsOk ? 'WS Down' : (squidLoading ? 'Connecting' : squidDownLabel));
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
  const [showValidators, setShowValidators] = React.useState(false);
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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/40 via-purple-50/20 to-pink-100/40 dark:from-blue-950/20 dark:via-purple-950/10 dark:to-pink-950/20 rounded-2xl" />
        <div className="relative bg-transparent rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">Network Statistics</h2>
        <div className={`inline-flex items-center gap-2 text-sm ${combinedStyle.text}`}>
          <span className={`w-2 h-2 rounded-full ${combinedStyle.dot} ${combinedTone === 'live' || combinedTone === 'info' ? 'animate-pulse' : ''}`} />
          <span>{combinedLabel}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
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
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-100/80 via-emerald-50/40 to-transparent dark:from-emerald-900/60 dark:via-emerald-950/30" />
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
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm bg-gradient-to-t from-emerald-50/50 dark:from-emerald-950/50 to-transparent rounded-lg">
                    {activeIcp.enabled ? 'No ICP data yet' : 'ICP URL not set'}
                  </div>
                )
              }
            />
            <StatCard
              title="Blocks/min (Live)"
              value={`${perMinText} blocks/min`}
              valueNode={
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-foreground tabular-nums">{perMinText}</span>
                  <span className="text-sm text-muted-foreground font-medium">blocks/min</span>
                </div>
              }
              sparkNode={<TpsSparkline series={tpsTrend} trendWin={60} trendRes={24} trendZoom={1.1} height={20} width={40} xpad={4} emaAlpha={0.08} fixedXFrac={0.5} yPadPx={6} pathAnimMs={1500} />}
              sparkClassName="h-[137px]"
              delta="Live"
              icon={<Activity className="h-6 w-6 text-violet-600" />}
              color="violet"
            />
            <StatCard
              title={
                <span className="flex items-baseline gap-1.5 flex-wrap">
                  <span>Total Staked</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold tabular-nums">{stakedValueText} REEF</span>
                </span>
              }
              value=""
              delta=""
              tooltip={staked.era != null ? `Era ${staked.era} • ${staked.validatorCount} validators\n${staked.stakedPct.toFixed(2)}% of total supply staked${staked.apy != null ? `\nAPY: ~${staked.apy.toFixed(1)}%` : ''}` : 'Total REEF staked across all validators'}
              icon={<Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />}
              color="orange"
              sparkClassName="min-h-[137px]"
              sparkNode={
                <div className="relative w-full rounded-lg bg-gradient-to-t from-amber-100/80 via-amber-50/40 to-transparent dark:from-amber-950/40 dark:via-transparent max-w-full">
                  {staked.loading ? (
                    <div className="flex flex-col gap-3 px-4 py-3 animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="h-3 w-16 bg-amber-200/60 rounded" />
                        <div className="h-3 w-10 bg-amber-200/60 rounded" />
                      </div>
                      <div className="w-full h-3 bg-amber-200/40 rounded-full" />
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-10 bg-amber-200/60 rounded" />
                        <div className="h-4 w-14 bg-emerald-200/60 rounded" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="h-5 w-28 bg-amber-200/50 rounded-md" />
                        <div className="h-3 w-14 bg-amber-200/40 rounded" />
                        <div className="h-3 w-16 bg-amber-200/40 rounded" />
                      </div>
                    </div>
                  ) : staked.error ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
                      <span className="text-sm text-red-500 font-medium">Ошибка загрузки данных</span>
                      <span className="text-[10px] text-muted-foreground">{staked.error.message.slice(0, 80)}</span>
                      <button
                        onClick={() => window.location.reload()}
                        className="mt-1 text-xs px-3 py-1 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      >
                        Обновить
                      </button>
                    </div>
                  ) : (
                  <div className="flex flex-col items-center justify-center gap-3 px-4 py-3">
                    {/* Progress bar */}
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Staked</span>
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                          {`${staked.stakedPct.toFixed(1)}%`}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-700"
                          style={{ width: `${Math.min(staked.stakedPct, 100)}%` }}
                        />
                      </div>
                    </div>
                    {/* APY */}
                    {staked.apy != null ? (
                      <div className="flex items-center gap-2 w-full">
                        <span className="text-xs text-muted-foreground">APY</span>
                        <span className="text-sm font-semibold text-emerald-600">~{staked.apy.toFixed(1)}%</span>
                      </div>
                    ) : null}
                    {/* Details */}
                    <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                      <button
                        onClick={() => setShowValidators((v) => !v)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100/70 dark:hover:bg-amber-900/50 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer"
                      >
                        <span className="font-medium">{staked.validatorCount}</span>
                        <span>validators</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {stakedUsdText ? (
                        <span className="font-medium text-amber-700 dark:text-amber-400">{stakedUsdText}</span>
                      ) : null}
                      {staked.era != null ? (
                        <div className="flex items-center gap-1">
                          <span>Era</span>
                          <span className="font-medium">{staked.era.toLocaleString()}</span>
                        </div>
                      ) : null}
                    </div>
                    {/* Validators Modal */}
                    {showValidators && ReactDOM.createPortal(
                      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowValidators(false)}>
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />
                        {/* Modal */}
                        <div
                          className="relative bg-card border border-border rounded-2xl shadow-2xl dark:shadow-black/50 w-full max-w-2xl max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                                <Lock className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-foreground">Validators</h3>
                                <p className="text-sm flex items-center gap-1.5 flex-wrap">
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">Era {staked.era?.toLocaleString()}</span>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-brand dark:text-brand-light font-medium">{staked.validatorCount} validators</span>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{staked.stakedPct.toFixed(1)}% staked</span>
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setShowValidators(false)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Trusted Validators */}
                          {TRUSTED_VALIDATORS.length > 0 ? (
                            <div className="px-6 py-3 border-b border-border bg-amber-50/50 dark:bg-amber-950/20">
                              <div className="flex items-center gap-1.5 mb-2">
                                <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Trusted Validators</span>
                              </div>
                              <div className="space-y-1">
                                {TRUSTED_VALIDATORS.map((tv) => {
                                  const v = staked.validators.find((s) => s.address === tv.address);
                                  return (
                                    <div key={tv.address} className="flex items-center gap-2 text-sm bg-amber-100/60 dark:bg-amber-950/40 rounded-lg px-3 py-2 border border-amber-200/40 dark:border-amber-800/30" title={tv.address}>
                                      <svg className="w-3 h-3 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                      <span className="font-medium text-foreground flex-1 truncate">{v?.name ?? tv.name}</span>
                                      <span className="text-muted-foreground text-xs">{v?.commissionPct != null ? `${v.commissionPct.toFixed(0)}%` : '—'}</span>
                                      <span className="font-semibold text-amber-600 dark:text-amber-400 text-xs w-12 text-right">{v?.apy != null ? `${v.apy.toFixed(0)}%` : '—'}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}

                          {/* All Validators */}
                          <div className="overflow-y-auto max-h-[50vh] px-6 py-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-semibold px-3 py-2 sticky top-0 bg-card z-10">
                              <span className="w-6 shrink-0 text-right">#</span>
                              <span className="flex-1">Validator</span>
                              <span className="w-20 text-right">Staked</span>
                              <span className="w-14 text-right">Comm.</span>
                              <span className="w-14 text-right">APY</span>
                            </div>
                            {staked.validators.map((v, i) => {
                              const isTrusted = TRUSTED_VALIDATORS.some((tv) => tv.address === v.address);
                              return (
                                <div key={v.address} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 transition-colors ${isTrusted ? 'bg-amber-50/50 dark:bg-amber-950/20' : 'hover:bg-muted/50'}`} title={v.address}>
                                  <span className="text-muted-foreground w-6 text-right shrink-0 text-xs">{i + 1}</span>
                                  <span className="flex-1 truncate font-medium text-foreground">
                                    {isTrusted ? <svg className="w-3 h-3 text-amber-500 inline mr-1 -mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : null}
                                    {v.name ?? `${v.address.slice(0, 6)}…${v.address.slice(-4)}`}
                                  </span>
                                  <span className="text-muted-foreground w-20 text-right text-xs tabular-nums">
                                    {v.stakedReef > 1e6 ? `${(v.stakedReef / 1e6).toFixed(0)}M` : v.stakedReef > 1e3 ? `${(v.stakedReef / 1e3).toFixed(0)}K` : v.stakedReef.toFixed(0)}
                                  </span>
                                  <span className="text-foreground/60 w-14 text-right text-xs">{v.commissionPct != null ? `${v.commissionPct.toFixed(0)}%` : '—'}</span>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 w-14 text-right text-xs">{v.apy != null ? `${v.apy.toFixed(0)}%` : '—'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                  )}
                </div>
              }
            />
        </div>
        <div className="mt-4">
            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">New Wallets Inflow (24h, ICP)</div>
                  <div className="text-xs text-muted-foreground">
                    {inflowMinText ? `≥ ${inflowMinText}` : 'Minimum not set'}
                    {inflowAsOfText ? ` • Updated ${inflowAsOfText}` : ''}
                    {inflowNextUpdateText ? ` • ${inflowNextUpdateText}` : ''}
                  </div>
                </div>
                {inflow.data ? (
                  <div className="text-xs text-muted-foreground">
                    Qualified {inflow.data.qualified}/{inflow.data.totalNew}
                    {inflow.data.truncated ? ` • Top ${inflowEntries.length}` : ''}
                  </div>
                ) : null}
              </div>

              <div className="mt-3">
                {!inflow.enabled ? (
                  <div className="text-sm text-muted-foreground">ICP URL not set</div>
                ) : inflow.loading ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : inflowEntries.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No wallets above the threshold yet.</div>
                ) : (
                  <div className="space-y-2">
                    {inflowVisibleEntries.map((entry) => {
                      const formattedReef = formatCompactReef(entry.incomingReef) ?? entry.incomingReef;
                      return (
                      <div
                        key={entry.address}
                        className="flex items-center justify-between gap-4 rounded-xl border border-emerald-100/60 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/40 px-3 py-2"
                      >
                        <AddressDisplay
                          address={entry.address}
                          className="inline-block text-sm font-mono text-emerald-900 dark:text-emerald-100 bg-card/60 px-2 py-1 rounded"
                          copyable
                        />
                        <div
                          className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 tabular-nums"
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
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 bg-card/70 px-3 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-200 shadow-sm transition hover:bg-card"
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
      </div>
    </div>
    </section>
  );
}

// StatCard component
interface StatCardProps {
  title: React.ReactNode;
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
    emerald: 'hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/50',
    blue: 'hover:shadow-blue-200/50 dark:hover:shadow-blue-900/50',
    violet: 'hover:shadow-violet-200/50 dark:hover:shadow-violet-900/50',
    orange: 'hover:shadow-orange-200/50 dark:hover:shadow-orange-900/50',
  }[color];

  const iconBg = {
    emerald: 'bg-emerald-100/80 dark:bg-emerald-900/80 border-emerald-200/50 dark:border-emerald-700/50',
    blue: 'bg-blue-100/80 dark:bg-blue-900/80 border-blue-200/50 dark:border-blue-700/50',
    violet: 'bg-violet-100/80 dark:bg-violet-900/80 border-violet-200/50 dark:border-violet-700/50',
    orange: 'bg-orange-100/80 dark:bg-orange-900/80 border-orange-200/50 dark:border-orange-700/50',
  }[color];

  return (
    <div className={`group relative rounded-2xl bg-card p-6 border border-border dark:border-border/80 shadow-lg dark:shadow-black/30 hover:shadow-xl ${glowColor} transition-shadow duration-300 h-full`}>
      {/* Subtle gradient overlay — light mode only */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent dark:from-transparent rounded-2xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between text-foreground text-sm">
          <span className="inline-flex items-center gap-2 cursor-help font-medium" title={tooltip}>{title}</span>
          <span className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${iconBg} border shadow-sm`}>
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
            <div className="text-2xl font-semibold text-foreground tabular-nums">{value}</div>
          )}
          {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
        </div>
        {delta ? <div className={`text-xs px-2 py-1 rounded-lg border font-medium ${delta.startsWith('-') ? 'text-red-500 bg-red-100/70 dark:bg-red-950/70 border-red-200/50 dark:border-red-800/50 dark:text-red-400' : 'text-emerald-600 bg-emerald-100/70 dark:bg-emerald-950/70 border-emerald-200/50 dark:border-emerald-800/50 dark:text-emerald-400'}`}>{delta}</div> : null}
      </div>
      {bottomChart}
      </div>
    </div>
  );
}
