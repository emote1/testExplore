import { Loader2, Award } from 'lucide-react';
import { useStakingRewards } from '@/hooks/useStakingRewards';
import { formatTimestamp, formatTimestampFull, formatTokenAmount } from '@/utils/formatters';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ExternalLink } from './ui/external-link';

interface RewardsTableProps {
  address: string;
}

export function RewardsTable({ address }: RewardsTableProps) {
  const { rewards, loading, error, pageIndex, pageCount, setPageIndex, totalCount } = useStakingRewards(address, 25);

  return (
    <div className="relative p-4 bg-white rounded-lg shadow-md overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-700">
          <Award className="h-5 w-5" />
          <span className="font-semibold">Staking Rewards</span>
          <span className="text-sm text-gray-500">{totalCount ? `${totalCount} total` : ''}</span>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">{String(error.message || error)}</div>
      )}

      <div className="overflow-x-auto md:overflow-x-visible">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">TIMESTAMP</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AMOUNT</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-8">LINK</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && rewards.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-gray-600">
                  <div className="inline-flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>Loading…</span></div>
                </td>
              </tr>
            ) : rewards.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-gray-600">No rewards found for this address.</td>
              </tr>
            ) : (
              rewards.map((r) => {
                const ts = formatTimestamp(r.timestamp);
                const full = formatTimestampFull(r.timestamp);
                const amount = formatTokenAmount(r.amount, 18, 'REEF');
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">{ts}</span>
                          </TooltipTrigger>
                          <TooltipContent><span>{full}</span></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="px-4 py-3">{amount}</td>
                    <td className="px-2 py-3 text-center">{r.extrinsicHash ? <ExternalLink href={`https://reefscan.com/extrinsic/${r.extrinsicHash}`} /> : '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
          disabled={pageIndex === 0 || loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>

        <span className="text-sm">Page <strong>{pageIndex + 1}</strong> of <strong>{pageCount}</strong></span>

        <button
          onClick={() => setPageIndex(Math.min(pageCount - 1, pageIndex + 1))}
          disabled={pageIndex >= pageCount - 1 || loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
