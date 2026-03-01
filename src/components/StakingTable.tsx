import React, { useState, lazy, Suspense } from 'react';
import { Loader2, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { useStakingActivity, type StakingActivityRow } from '../hooks/use-staking-activity';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

const RewardsChartLazy = lazy(() => import('./RewardsChart').then((m) => ({ default: m.RewardsChart })));

interface StakingTableProps {
  address: string | null;
  evmAddress: string | null;
  enabled?: boolean;
  onCountChange?: (count: number) => void;
}

function formatAmount(amount: string | number): string {
  try {
    let str = String(amount);
    // Handle scientific notation from Hasura (e.g. 2.5649908465e+22)
    if (str.includes('e') || str.includes('E')) {
      const num = Number(str);
      if (!Number.isFinite(num)) return '0';
      const reef = num / 1e18;
      if (reef >= 1_000_000) return `${(reef / 1_000_000).toFixed(2)}M`;
      if (reef >= 1_000) return `${(reef / 1_000).toFixed(2)}K`;
      return reef.toFixed(2);
    }
    // Remove decimal point if present
    str = str.replace('.', '');
    const bi = BigInt(str);
    const decimals = 18;
    const divisor = 10n ** BigInt(decimals);
    const whole = bi / divisor;
    const frac = bi % divisor;
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, 2);
    const num = parseFloat(`${whole}.${fracStr}`);
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toFixed(2);
  } catch {
    return '0';
  }
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStakingTypeBadge(type: string) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    Reward: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    Bonded: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    Unbonded: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    Withdrawn: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    Slash: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  };
  const style = styles[type] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
  return (
    <Badge className={`${style.bg} ${style.text} border ${style.border} rounded-full px-3 py-1`}>
      {type}
    </Badge>
  );
}

function StakingRow({ row }: { row: StakingActivityRow }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-3 py-4">{getStakingTypeBadge(row.staking_type)}</td>
      <td className="px-3 py-4 text-sm text-gray-600">{formatTimestamp(row.timestamp)}</td>
      <td className="px-3 py-4 text-sm font-mono text-gray-700 truncate max-w-[150px]" title={row.signer_id}>
        {row.signer_id.slice(0, 8)}...{row.signer_id.slice(-6)}
      </td>
      <td className="px-3 py-4 text-right">
        <span className={`font-medium ${row.staking_type === 'Reward' ? 'text-emerald-600' : row.staking_type === 'Slash' ? 'text-red-600' : 'text-gray-900'}`}>
          {row.staking_type === 'Reward' ? '+' : row.staking_type === 'Slash' ? '-' : ''}
          {formatAmount(row.amount)} REEF
        </span>
      </td>
      <td className="px-3 py-4 text-sm text-gray-500 text-center">
        {row.era ?? '—'}
      </td>
    </tr>
  );
}

export function StakingTable({ address, evmAddress, enabled = true, onCountChange }: StakingTableProps) {
  const [showChart, setShowChart] = useState(false);
  const { rows, totalCount, page, setPage, totalPages, isLoading, error } = useStakingActivity({
    address,
    evmAddress,
    enabled,
    pageSize: 20,
  });

  React.useEffect(() => {
    if (typeof totalCount === 'number' && onCountChange) {
      onCountChange(totalCount);
    }
  }, [totalCount, onCountChange]);

  // Get native address for chart (prefer address over evmAddress)
  const chartAddress = address || '';

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        <p>Error loading staking data: {error}</p>
      </div>
    );
  }

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <span className="ml-3 text-gray-500">Loading staking history...</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        <p className="text-lg font-medium">No staking activity</p>
        <p className="text-sm">This wallet has no staking events recorded.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Chart toggle and display */}
      {chartAddress && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-gray-700">
              <BarChart3 className="h-5 w-5" />
              <span className="font-semibold">Staking Rewards Chart</span>
            </div>
            <Button
              variant={showChart ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowChart((v) => !v)}
            >
              {showChart ? 'Hide Chart' : 'Show Chart'}
            </Button>
          </div>
          {showChart && (
            <Suspense fallback={<div className="p-4 text-center text-gray-500">Loading chart...</div>}>
              <RewardsChartLazy address={chartAddress} />
            </Suspense>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-white">
            <tr className="border-b-2 border-slate-200">
              <th className="px-3 py-3 text-left text-[13px] font-semibold text-slate-700" style={{ width: '15%' }}>Type</th>
              <th className="px-3 py-3 text-left text-[13px] font-semibold text-slate-700" style={{ width: '15%' }}>Time</th>
              <th className="px-3 py-3 text-left text-[13px] font-semibold text-slate-700" style={{ width: '30%' }}>Account</th>
              <th className="px-3 py-3 text-right text-[13px] font-semibold text-slate-700" style={{ width: '25%' }}>Amount</th>
              <th className="px-3 py-3 text-center text-[13px] font-semibold text-slate-700" style={{ width: '15%' }}>Era</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row) => (
              <StakingRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Page {page + 1} of {totalPages} ({totalCount} total)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
