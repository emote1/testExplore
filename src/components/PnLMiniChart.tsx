import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';

interface PnLMiniChartProps {
  label?: string;
  thenUsd: number | null | undefined;
  midUsd?: number | null | undefined; // optional T+7d
  nowUsd: number | null | undefined;
  midLabel?: string; // e.g., "T+7d"
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

export function PnLMiniChart({ label, thenUsd, midUsd, nowUsd, midLabel = 'T+7d' }: PnLMiniChartProps) {
  const valid = typeof thenUsd === 'number' && isFinite(thenUsd) && typeof nowUsd === 'number' && isFinite(nowUsd);
  const hasMid = typeof midUsd === 'number' && isFinite(Number(midUsd));
  const data = useMemo(() => {
    if (!valid) return [] as Array<{ x: number; y: number }>;
    const arr: Array<{ x: number; y: number }> = [
      { x: 0, y: Math.max(0, Number(thenUsd)) },
    ];
    if (hasMid) arr.push({ x: 1, y: Math.max(0, Number(midUsd)) });
    arr.push({ x: hasMid ? 2 : 1, y: Math.max(0, Number(nowUsd)) });
    return arr;
  }, [valid, hasMid, thenUsd, midUsd, nowUsd]);
  if (!valid || data.length === 0) return null;

  const pnlAbs = Number(nowUsd!) - Number(thenUsd!);
  const pnlPct = Number(thenUsd!) > 0 ? (pnlAbs / Number(thenUsd!)) * 100 : 0;
  const isUp = pnlAbs >= 0;
  const color = isUp ? '#16a34a' : '#dc2626';

  return (
    <div className="mt-2 rounded border border-gray-200 p-2 bg-white">
      <div className="flex items-center justify-between text-xs">
        <div className="text-gray-600 truncate">{label ?? 'PnL'}</div>
        <div className={isUp ? 'text-green-600' : 'text-red-600'}>
          {isUp ? '+' : ''}{pnlAbs.toLocaleString('en-US', { maximumFractionDigits: 2 })}$ • {isUp ? '+' : ''}{pnlPct.toFixed(2)}%
        </div>
      </div>
      <div className="w-full h-12">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pnlMiniGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="x" hide domain={[0, data[data.length - 1]?.x ?? 1]} type="number" />
            <YAxis hide domain={[0, 'auto']} />
            <RechartsTooltip
              formatter={(v) => formatUsd(Number(v))}
              labelFormatter={(l) => (l === 0 ? 'Then' : (l === 1 && hasMid ? midLabel : 'Now'))}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Area type="monotone" dataKey="y" stroke={color} fill="url(#pnlMiniGradient)" strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-gray-500">
        <span>Then: {formatUsd(Number(thenUsd))}</span>
        {hasMid ? <span className="text-right">{midLabel}: {formatUsd(Number(midUsd))}</span> : null}
        <span className={hasMid ? 'col-span-2 text-right' : 'text-right'}>Now: {formatUsd(Number(nowUsd))}</span>
      </div>
    </div>
  );
}
