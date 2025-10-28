import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';

interface PnLDualMiniChartProps {
  label?: string;
  aLabel: string;
  aThenUsd: number | null | undefined;
  aNowUsd: number | null | undefined;
  bLabel: string;
  bThenUsd: number | null | undefined;
  bNowUsd: number | null | undefined;
  aQtyText?: string; // e.g., "6.17K Mr.Dapps"
  bQtyText?: string; // e.g., "118.28K Reef"
  aMidThen?: number | null;
  bMidThen?: number | null;
}

function fmtPct(p: number | null): string {
  if (p == null || !Number.isFinite(Number(p))) return '—';
  const v = Number(p);
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

export function PnLDualMiniChart({ label, aLabel, aThenUsd, aNowUsd, bLabel, bThenUsd, bNowUsd, aQtyText, bQtyText, aMidThen = null, bMidThen = null }: PnLDualMiniChartProps) {
  const aValid = typeof aThenUsd === 'number' && isFinite(Number(aThenUsd)) && typeof aNowUsd === 'number' && isFinite(Number(aNowUsd));
  const bValid = typeof bThenUsd === 'number' && isFinite(Number(bThenUsd)) && typeof bNowUsd === 'number' && isFinite(Number(bNowUsd));
  const hasAny = aValid || bValid;
  const data = useMemo(() => {
    if (!hasAny) return [] as Array<{ x: number; a?: number; b?: number; aMid?: number; bMid?: number }>;
    const clamp = (v: any) => {
      if (!(typeof v === 'number' && isFinite(v))) return undefined;
      const n = Number(v);
      return Math.max(0, n);
    };
    return [
      { x: 0, a: clamp(Number(aThenUsd)), b: clamp(Number(bThenUsd)), aMid: clamp(aMidThen as any), bMid: clamp(bMidThen as any) },
      { x: 1, a: clamp(Number(aNowUsd)),  b: clamp(Number(bNowUsd))  },
    ];
  }, [hasAny, aThenUsd, aNowUsd, bThenUsd, bNowUsd, aMidThen, bMidThen]);
  if (!hasAny || data.length === 0) return null;

  const aQtyShort = (aQtyText || '').trim().split(/\s+/)[0] || '';
  const bQtyShort = (bQtyText || '').trim().split(/\s+/)[0] || '';
  const aName = aQtyShort ? `${aLabel} • ${aQtyShort}` : aLabel;
  const bName = bQtyShort ? `${bLabel} • ${bQtyShort}` : bLabel;
  const showLabel = !!(label && String(label).trim());
  const aPct = aValid && Number(aThenUsd) !== 0
    ? ((Number(aNowUsd) - Number(aThenUsd)) / Number(aThenUsd)) * 100
    : null;
  const bPct = bValid && Number(bThenUsd) !== 0
    ? ((Number(bNowUsd) - Number(bThenUsd)) / Number(bThenUsd)) * 100
    : null;
  const pctClass = (p: number | null) => (p == null ? 'text-gray-600' : (p >= 0 ? 'text-green-600' : 'text-red-600'));

  return (
    <div className="mt-2 rounded border border-gray-200 p-2 bg-white">
      <div className={`flex items-center ${showLabel ? 'justify-between' : 'justify-end'} text-xs`}>
        {showLabel ? <div className="text-gray-600 truncate">{label}</div> : null}
        <div className="flex items-center gap-3 text-gray-600">
          <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#2563eb]" />{aLabel} • {aQtyShort}</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#f59e0b]" />{bLabel} • {bQtyShort}</span>
        </div>
      </div>
      <div className="w-full h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
            <XAxis dataKey="x" hide domain={[0, 1]} type="number" />
            <YAxis hide domain={[0, 'auto']} scale={'linear'} />
            <RechartsTooltip
              formatter={(v) => (Number(v as any)).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
              labelFormatter={(l) => (l === 0 ? 'Then' : 'Now')}
              wrapperStyle={{ fontSize: 11 }}
              contentStyle={{ background: 'rgba(255,255,255,0.98)', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
              labelStyle={{ color: '#6b7280', fontSize: 11 }}
              itemStyle={{ color: '#111827', fontSize: 12 }}
            />
            <Line type="monotone" dataKey="a" name={aName} stroke="#2563eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={{ r: 2, strokeWidth: 2, fill: '#ffffff' }} activeDot={{ r: 4 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="b" name={bName} stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={{ r: 2, strokeWidth: 2, fill: '#ffffff' }} activeDot={{ r: 4 }} isAnimationActive={false} />
            {/* spot-at-trade dots */}
            <Line type="linear" dataKey="aMid" stroke="transparent" dot={{ r: 3, fill: '#2563eb', stroke: '#2563eb' }} activeDot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="bMid" stroke="transparent" dot={{ r: 3, fill: '#f59e0b', stroke: '#f59e0b' }} activeDot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 grid grid-cols-2 text-[11px]">
        <span className={`inline-flex items-center gap-1 ${pctClass(aPct)}`}><span className="inline-block w-2 h-2 rounded-full bg-[#2563eb]" />{aLabel}: {fmtPct(aPct)}</span>
        <span className={`inline-flex items-center gap-1 justify-end ${pctClass(bPct)}`}><span className="inline-block w-2 h-2 rounded-full bg-[#f59e0b]" />{bLabel}: {fmtPct(bPct)}</span>
      </div>
      {/* Legend moved to header; rely on tooltip for values */}
    </div>
  );
}
