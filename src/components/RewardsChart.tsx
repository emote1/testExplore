import { useEffect, useMemo, useRef, useState } from 'react';
import { useStakingRewardsSeries } from '@/hooks/use-staking-rewards-series';
import { useReefPrice } from '@/hooks/use-reef-price';
import { useReefPriceHistory } from '@/hooks/use-reef-price-history';
import { Button } from './ui/button';
import { Info } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
  Brush,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';

interface RewardsChartProps {
  address: string;
}

interface ChartPoint {
  ts: number;     // UTC midnight timestamp (ms)
  date: string;   // YYYY-MM-DD
  valueReef?: number;
  valueUsd?: number;
  valueUsdHist?: number;
  zero: boolean;  // true if no staking that day
}

export function RewardsChart({ address }: RewardsChartProps) {
  const { price } = useReefPrice();
  // Primary unit scale of Y axis; USD group supports overlays
  const [unit, setUnit] = useState<'reef' | 'usd'>('reef');
  const [mode, setMode] = useState<'daily' | 'cumulative'>('daily');
  const ranges = [
    { key: '30d', days: 30 },
    { key: '90d', days: 90 },
    { key: '180d', days: 180 },
    { key: '365d', days: 365 },
    { key: 'all', days: undefined },
  ] as const;
  const [range, setRange] = useState<(typeof ranges)[number]['key']>('90d');
  const [showUsd, setShowUsd] = useState(true);
  const [showUsdHist, setShowUsdHist] = useState(false);
  const [unitInfoOpen, setUnitInfoOpen] = useState(false);
  const infoBtnRef = useRef<HTMLSpanElement | null>(null);
  const infoPopRef = useRef<HTMLDivElement | null>(null);
  // Single base dataset: for ALL fetch 'all', otherwise fetch '365d'
  const baseKey = range === 'all' ? 'all' : '365d';
  const { daily: dailyBase, loading, error } = useStakingRewardsSeries(address, baseKey);

  const canShowUsdCurrent = !!price?.usd;
  const { history: priceHistory } = useReefPriceHistory(baseKey === 'all' ? 'max' : 365);
  const canShowUsdHist = !!priceHistory && Object.keys(priceHistory).length > 0;
  const reefCompact = useMemo(() => new Intl.NumberFormat('en-US', { notation: 'compact', minimumFractionDigits: 2, maximumFractionDigits: 2 }), []);
  // Date formatters (UTC) for readable ticks in English locale
  const fmtDayMonth = useMemo(() => new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' }), []); // Sep 07
  const fmtMonthYear = useMemo(() => new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }), []); // Sep 2025
  const fmtFull = useMemo(() => new Intl.DateTimeFormat('en-US', { month: 'long', day: '2-digit', year: 'numeric', timeZone: 'UTC' }), []);

  // Close unit info on outside click / Esc
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!unitInfoOpen) return;
      const target = e.target as Node;
      if (infoPopRef.current && infoPopRef.current.contains(target)) return;
      if (infoBtnRef.current && infoBtnRef.current.contains(target)) return;
      setUnitInfoOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setUnitInfoOpen(false); }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [unitInfoOpen]);

  const data: ChartPoint[] = useMemo(() => {
    const srcDaily = dailyBase;
    if (!srcDaily || srcDaily.length === 0) return [];

    const currentUsd = price?.usd ?? 0;
    const byDate = new Map<string, number>();
    for (const p of srcDaily) byDate.set(p.date, p.sumReef);

    const MS_DAY = 24 * 60 * 60 * 1000;
    let startTs: number;
    let endTs: number;
    if (range === 'all') {
      startTs = srcDaily[0].ts;
      endTs = srcDaily[srcDaily.length - 1].ts;
    } else {
      const opt = ranges.find((r) => r.key === range);
      const todayUtcMid = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime();
      const days = opt?.days ?? 30;
      endTs = todayUtcMid;
      startTs = todayUtcMid - (days - 1) * MS_DAY;
    }

    const filled: Array<{ date: string; ts: number; sum: number }> = [];
    for (let t = startTs; t <= endTs; t += MS_DAY) {
      const d = new Date(t).toISOString().slice(0, 10);
      const v = byDate.get(d) ?? 0;
      filled.push({ date: d, ts: t, sum: v });
    }

    if (mode === 'daily') {
      return filled.map((p) => {
        const hist = priceHistory?.[p.date];
        const dayUsdHist = typeof hist === 'number' ? hist : 0; // Variant A: no fallback
        return {
          ts: p.ts,
          date: p.date,
          valueReef: p.sum,
          valueUsd: p.sum * currentUsd,
          valueUsdHist: p.sum * dayUsdHist,
          zero: p.sum === 0,
        };
      });
    }

    // mode === 'cumulative': recompute cumulative within the filled window
    let accReef = 0;
    let accUsd = 0;
    let accUsdHist = 0;
    return filled.map((p) => {
      accReef += p.sum;
      accUsd = accReef * currentUsd;
      const hist = priceHistory?.[p.date];
      const dayUsd = typeof hist === 'number' ? hist : 0; // Variant A
      accUsdHist += p.sum * dayUsd;
      return {
        ts: p.ts,
        date: p.date,
        valueReef: accReef,
        valueUsd: accUsd,
        valueUsdHist: accUsdHist,
        zero: p.sum === 0,
      };
    });
  }, [dailyBase, mode, price, priceHistory, range]);

  const yTickFormatter = (v: number) => {
    if (unit === 'usd') {
      const sign = v < 0 ? '-' : '';
      const abs = Math.abs(v);
      const num = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${sign}${num}$`;
    }
    // For REEF use compact to keep axis readable on mobile
    return reefCompact.format(v);
  };

  const xTickFormatter = (ts: number | string) => {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(`${ts}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return String(ts);
    // <= 90d: dd.MM, >= 180d & ALL: MMM yyyy
    if (range === '30d' || range === '90d') return fmtDayMonth.format(d);
    return fmtMonthYear.format(d);
  };

  const tooltipFormatter = (value: any, _name?: string, props?: any) => {
    const v = Number(value);
    const key: string = props?.dataKey ?? '';
    const isUsdSeries = key === 'valueUsd' || key === 'valueUsdHist' || unit === 'usd';
    if (isUsdSeries) {
      const sign = v < 0 ? '-' : '';
      const abs = Math.abs(v);
      const num = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return [`${sign}${num}$`, mode === 'daily' ? 'Daily Sum' : 'Cumulative'];
    }
    return [`${reefCompact.format(v)} REEF`, mode === 'daily' ? 'Daily Sum' : 'Cumulative'];
  };

  const tooltipLabelFormatter = (label: any) => {
    const d = typeof label === 'number' ? new Date(label) : new Date(`${String(label)}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return String(label);
    return fmtFull.format(d);
  };

  // Shade region with no historical USD data inside current window
  const missingShade = useMemo(() => {
    if (!(unit === 'usd' && showUsdHist) || !priceHistory || data.length === 0) return null;
    const keys = Object.keys(priceHistory);
    if (keys.length === 0) return null;
    keys.sort();
    const firstHistDate = keys[0];
    const firstHistTs = new Date(`${firstHistDate}T00:00:00.000Z`).getTime();
    const x1 = data[0].ts;
    const x2 = Math.min(firstHistTs - 1, data[data.length - 1].ts);
    if (!(Number.isFinite(x1) && Number.isFinite(x2)) || x2 <= x1) return null;
    return { x1, x2 } as const;
  }, [unit, showUsdHist, priceHistory, data]);

  // After data is computed, prepare Brush state (only for ALL)
  const showBrush = range === 'all' && data.length > 0;
  const [brush, setBrush] = useState<{ startIndex: number; endIndex: number } | null>(null);
  useEffect(() => {
    if (!showBrush) { setBrush(null); return; }
    setBrush((prev) => {
      const full = { startIndex: 0, endIndex: Math.max(0, data.length - 1) };
      if (!prev) return full;
      const maxEnd = Math.max(0, data.length - 1);
      if (prev.endIndex > maxEnd) return full;
      return prev;
    });
  }, [showBrush, data.length]);
  const isZoomed = !!brush && (brush.startIndex > 0 || brush.endIndex < Math.max(0, data.length - 1));
  const resetZoom = () => setBrush({ startIndex: 0, endIndex: Math.max(0, data.length - 1) });

  // Pre-compute cumulative totals for fixed windows for all modes; later pick display set
  const fixedTotalsAll = useMemo(() => {
    const empty = { '30d': 0, '90d': 0, '180d': 0, '365d': 0 } as Record<'30d'|'90d'|'180d'|'365d', number>;
    const base = dailyBase ?? [];
    if (base.length === 0) return { reef: empty, usd: empty, usdHist: empty };
    const todayMs = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime();
    const currentUsd = price?.usd ?? 0;
    const windows: Array<{ key: '30d' | '90d' | '180d' | '365d'; days: number }> = [
      { key: '30d', days: 30 },
      { key: '90d', days: 90 },
      { key: '180d', days: 180 },
      { key: '365d', days: 365 },
    ];
    const reef: Record<'30d'|'90d'|'180d'|'365d', number> = { ...empty };
    const usd: Record<'30d'|'90d'|'180d'|'365d', number> = { ...empty };
    const usdHist: Record<'30d'|'90d'|'180d'|'365d', number> = { ...empty };
    for (const w of windows) {
      const cutoffMs = todayMs - (w.days - 1) * 24 * 60 * 60 * 1000;
      const cutoffStr = new Date(cutoffMs).toISOString().slice(0, 10);
      const slice = base.filter((p) => p.date >= cutoffStr);
      const sumReef = slice.reduce((acc, p) => acc + p.sumReef, 0);
      reef[w.key] = sumReef;
      usd[w.key] = sumReef * currentUsd;
      usdHist[w.key] = slice.reduce((acc, p) => {
        const hist = priceHistory?.[p.date];
        const dayUsd = typeof hist === 'number' ? hist : 0;
        return acc + p.sumReef * dayUsd;
      }, 0);
    }
    return { reef, usd, usdHist };
  }, [dailyBase, price, priceHistory]);

  const fixedTotals = useMemo(() => {
    if (unit === 'reef') return fixedTotalsAll.reef;
    // unit === 'usd'
    if (showUsd) return fixedTotalsAll.usd;
    return fixedTotalsAll.usdHist;
  }, [fixedTotalsAll, unit, showUsd]);

  function formatTotal(v: number): string {
    if (unit === 'usd') {
      const sign = v < 0 ? '-' : '';
      const abs = Math.abs(v);
      const num = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${sign}${num}$`;
    }
    // For REEF use compact for readability
    return `${reefCompact.format(v)} REEF`;
  }

  return (
    <div className="mt-4 rounded-md border border-gray-200 p-3 bg-white">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2">
          <span className="text-sm text-gray-600">Mode:</span>
          <Button variant={mode === 'daily' ? 'default' : 'outline'} size="sm" onClick={() => setMode('daily')}>Daily</Button>
          <Button variant={mode === 'cumulative' ? 'default' : 'outline'} size="sm" onClick={() => setMode('cumulative')}>Cumulative</Button>
        </div>
        <div className="inline-flex items-center gap-2 ml-4 relative">
          <span className="text-sm text-gray-600">Unit:</span>
          <Button variant={unit === 'reef' ? 'default' : 'outline'} size="sm" onClick={() => setUnit('reef')}>REEF</Button>
          <Button
            variant={unit === 'usd' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUnit('usd')}
            disabled={!canShowUsdCurrent && !canShowUsdHist}
          >
            USD
          </Button>
          {unit === 'usd' && (
            <div className="inline-flex items-center gap-1 ml-2">
              <span className="text-xs text-gray-500">Layers:</span>
              <Button
                variant={showUsd ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowUsd((prev) => { const next = !prev; if (!next && !showUsdHist) return prev; return next; })}
                disabled={!canShowUsdCurrent}
              >
                USD
              </Button>
              <Button
                variant={showUsdHist ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowUsdHist((prev) => { const next = !prev; if (!next && !showUsd) return prev; return next; })}
                disabled={!canShowUsdHist}
              >
                USD(H)
              </Button>
            </div>
          )}
          <span ref={infoBtnRef}>
            <Button variant="outline" size="sm" onClick={() => setUnitInfoOpen((v) => !v)} className="inline-flex items-center">
              <Info className="h-4 w-4 mr-1" /> Info
            </Button>
          </span>
          {unitInfoOpen ? (
            <div ref={infoPopRef} role="dialog" aria-label="About USD modes" className="absolute z-20 top-full left-0 mt-2 w-80 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
              <div className="text-sm font-semibold mb-2">What are USD and USD(H)?</div>
              <div className="space-y-2 text-xs text-gray-700">
                <p><b>USD</b> — converts all rewards using the <i>current</i> REEF→USD rate. Quick “what is it worth now” view.</p>
                <p><b>USD(H)</b> — converts each reward using the <i>rate of that day</i>. Correct for retrospectives and period-to-period comparisons.</p>
                <div>
                  <div className="font-medium mb-1">When to use:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>USD for a present-value snapshot.</li>
                    <li>USD(H) for trends and historical analysis.</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="inline-flex items-center gap-2 ml-4">
          <span className="text-sm text-gray-600">Range:</span>
          {ranges.map((r) => (
            <Button key={r.key} variant={range === r.key ? 'default' : 'outline'} size="sm" onClick={() => setRange(r.key)}>
              {r.key.toUpperCase()}
            </Button>
          ))}
        </div>
        {showBrush && isZoomed && (
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={resetZoom}>Reset Zoom</Button>
          </div>
        )}
        {(!canShowUsdCurrent || !canShowUsdHist) && (
          <span className="text-xs text-gray-500 ml-2">
            {!canShowUsdCurrent ? 'USD недоступен (нет текущей цены).' : ''}
            {!canShowUsdHist ? ' USD(H) недоступен (нет истории цен).' : ''}
          </span>
        )}
      </div>

      {error && <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">{String(error.message || error)}</div>}
      {loading && data.length === 0 ? (
        <div className="py-8 text-center text-gray-600">Loading chart…</div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-gray-600">No data</div>
      ) : (
        <div className="w-full h-56 sm:h-64 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="reefGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="usdCurGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="usdHistGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              {missingShade ? (
                <ReferenceArea x1={missingShade.x1} x2={missingShade.x2} fill="#9ca3af" fillOpacity={0.2} strokeOpacity={0} />
              ) : null}
              {missingShade ? (
                <ReferenceLine
                  x={(missingShade.x1 + missingShade.x2) / 2}
                  strokeOpacity={0}
                  label={{ value: 'No historical price', position: 'insideTop', fill: '#6b7280', fontSize: 12 }}
                />
              ) : null}
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 12 }}
                minTickGap={12}
                interval="preserveStartEnd"
                tickFormatter={xTickFormatter as any}
              />
              <YAxis tickFormatter={yTickFormatter as any} width={80} tick={{ fontSize: 12 }} />
              <RechartsTooltip formatter={tooltipFormatter as any} labelFormatter={tooltipLabelFormatter as any} labelClassName="text-xs" />
              <Legend />
              {unit === 'reef' ? (
                <Area
                  type="monotone"
                  dataKey="valueReef"
                  name={mode === 'daily' ? 'Daily REEF' : 'Cumulative REEF'}
                  stroke="#2563eb"
                  fill="url(#reefGradient)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={(props: any) => {
                    const keyBase = props?.payload?.date ?? props?.index ?? 'x';
                    if (mode !== 'daily') return <g key={`dot-${keyBase}`} />;
                    const payload = props?.payload as ChartPoint | undefined;
                    if (!payload || !payload.zero) return <g key={`dot-${keyBase}`} />;
                    const { cx, cy } = props;
                    if (typeof cx !== 'number' || typeof cy !== 'number') return <g key={`dot-${keyBase}`} />;
                    return (
                      <circle key={`dot-${keyBase}`} cx={cx} cy={cy} r={4} fill="#f59e0b" stroke="#ffffff" strokeWidth={1} />
                    );
                  }}
                />
              ) : (
                <>
                  {showUsd ? (
                    <Area
                      type="monotone"
                      dataKey="valueUsd"
                      name={mode === 'daily' ? 'Daily USD (Current)' : 'Cumulative USD (Current)'}
                      stroke="#2563eb"
                      fill="url(#usdCurGradient)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  ) : null}
                  {showUsdHist ? (
                    <Area
                      type="monotone"
                      dataKey="valueUsdHist"
                      name={mode === 'daily' ? 'Daily USD (History)' : 'Cumulative USD (History)'}
                      stroke="#10b981"
                      fill="url(#usdHistGradient)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  ) : null}
                </>
              )}
              {showBrush && (
                <Brush
                  dataKey="ts"
                  height={32}
                  travellerWidth={12}
                  stroke="#94a3b8"
                  fill="#f8fafc"
                  startIndex={brush?.startIndex}
                  endIndex={brush?.endIndex}
                  onChange={(e: any) => {
                    if (!e) return;
                    setBrush({ startIndex: e.startIndex, endIndex: e.endIndex });
                  }}
                  tickFormatter={xTickFormatter as any}
                >
                  <AreaChart data={data}>
                    <Area
                      type="monotone"
                      dataKey={unit === 'reef' ? 'valueReef' : (showUsd ? 'valueUsd' : 'valueUsdHist')}
                      stroke="#94a3b8"
                      fill="#e5e7eb"
                      strokeWidth={1}
                    />
                  </AreaChart>
                </Brush>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      
      {/* Fixed cumulative totals below chart */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded border border-gray-200 p-2 text-center">
          <div className="text-xs text-gray-500">30D Cumulative</div>
          <div className="text-sm font-semibold">{formatTotal(fixedTotals['30d'])}</div>
        </div>
        <div className="rounded border border-gray-200 p-2 text-center">
          <div className="text-xs text-gray-500">90D Cumulative</div>
          <div className="text-sm font-semibold">{formatTotal(fixedTotals['90d'])}</div>
        </div>
        <div className="rounded border border-gray-200 p-2 text-center">
          <div className="text-xs text-gray-500">180D Cumulative</div>
          <div className="text-sm font-semibold">{formatTotal(fixedTotals['180d'])}</div>
        </div>
        <div className="rounded border border-gray-200 p-2 text-center">
          <div className="text-xs text-gray-500">365D Cumulative</div>
          <div className="text-sm font-semibold">{formatTotal(fixedTotals['365d'])}</div>
        </div>
      </div>
    </div>
  );
}
