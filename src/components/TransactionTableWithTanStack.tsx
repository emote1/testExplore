import {
  flexRender,
  Table,
} from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { transactionColumns } from './transaction-columns';
import type { UiTransfer } from '../data/transfer-mapper';
// Token USD prices are computed in the adapter and passed via table meta

interface TransactionTableWithTanStackProps {
  newTransfers?: string[];
  table: Table<UiTransfer>;
  isLoading: boolean;
  isFetching?: boolean;
  /** Optional adapter-level deep jump to avoid TanStack clamping */
  goToPage?: (pageIndex: number) => void;
  /** Page-level loading progress for deep jumps */
  isPageLoading?: boolean;
  pageLoadProgress?: number; // 0..1
  /** Exact total known vs heuristic */
  hasExactTotal?: boolean;
  /** When true, adapter is using offset/limit fast mode */
  fastModeActive?: boolean;
}

export function TransactionTableWithTanStack({ table, isLoading, isFetching, newTransfers = [], goToPage, isPageLoading, pageLoadProgress, hasExactTotal = false, fastModeActive = false }: TransactionTableWithTanStackProps) {
  const rows = table.getRowModel().rows;
  const enableVirtual = rows.length > 30;
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: enableVirtual ? rows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 8,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]!.start : 0;
  const paddingBottom = virtualItems.length > 0
    ? totalSize - (virtualItems[virtualItems.length - 1]!.start + virtualItems[virtualItems.length - 1]!.size)
    : 0;

  // Quick jump helpers
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const [jumpInput, setJumpInput] = useState<string>('');
  const quickPages = useMemo(() => {
    if (!pageCount || pageCount < 1) return [] as number[];
    const step = 5;
    const pages = new Set<number>();
    // Always include page 1
    pages.add(1);
    // Add step-based pages
    for (let p = step; p <= pageCount; p += step) pages.add(p);
    // Include last page only when exact total is known
    if (hasExactTotal) pages.add(pageCount);
    // Sort ascending and limit to avoid overflow
    return Array.from(pages).sort((a, b) => a - b).slice(0, 12);
  }, [pageCount, hasExactTotal]);
  function handleGo() {
    const n = Number(jumpInput);
    if (!Number.isFinite(n)) return;
    const target = Math.max(1, Math.floor(n));
    if (goToPage) goToPage(target - 1);
    else table.setPageIndex(target - 1);
  }

  return (
    <div className="relative p-4 bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto md:overflow-x-visible">
        <div ref={parentRef} className={enableVirtual ? 'max-h-[70vh] overflow-auto' : undefined}>
          <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className={`px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${header.column.id === 'actions' ? 'w-8 text-center px-1' : ''} ${header.column.id === 'timestamp' ? 'w-52 md:w-60' : ''} ${header.column.id === 'feeAmount' ? 'w-20 text-right px-1' : ''}`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.length === 0 && (isLoading || isPageLoading) ? (
              <tr>
                <td colSpan={transactionColumns.length} className="text-center py-6 text-gray-600">
                  <div className="inline-flex items-center gap-2 justify-center">
                    {pageIndex === 0 ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading…</span>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={transactionColumns.length} className="text-center py-4">No transactions found for this address.</td>
              </tr>
            ) : enableVirtual ? (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td colSpan={transactionColumns.length} style={{ height: paddingTop }} />
                  </tr>
                )}
                {virtualItems.map(vItem => {
                  const row = rows[vItem.index]!;
                  return (
                    <tr
                      key={row.id}
                      data-testid="tx-row"
                      data-transfer-id={row.original.id}
                      className={`transition-colors duration-700 ${newTransfers.includes(row.original.id) ? 'bg-blue-100' : ''}`}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td
                          key={cell.id}
                          className={
                            cell.column.id === 'actions' ? 'px-1 py-3 text-center w-8' :
                            cell.column.id === 'timestamp' ? 'px-2 py-3 whitespace-nowrap' :
                            cell.column.id === 'feeAmount' ? 'px-1 py-3 text-right' :
                            (cell.column.id === 'from' || cell.column.id === 'to') ? 'px-3 py-3' :
                            'px-4 py-3'
                          }
                        >
                          {cell.column.id === 'actions'
                            ? flexRender(cell.column.columnDef.cell, cell.getContext())
                            : (cell.column.id === 'from' || cell.column.id === 'to')
                              ? <div className="truncate">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                              : flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td colSpan={transactionColumns.length} style={{ height: paddingBottom }} />
                  </tr>
                )}
                {isFetching && (
                  <tr>
                    <td colSpan={transactionColumns.length} className="text-center py-4 text-gray-500">
                      Loading more...
                    </td>
                  </tr>
                )}
              </>
            ) : (
              <>
                {rows.map(row => (
                  <tr
                    key={row.id}
                    data-testid="tx-row"
                    data-transfer-id={row.original.id}
                    className={`transition-colors duration-700 ${newTransfers.includes(row.original.id) ? 'bg-blue-100' : ''}`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className={
                          cell.column.id === 'actions' ? 'px-1 py-3 text-center w-8' :
                          cell.column.id === 'timestamp' ? 'px-2 py-3 whitespace-nowrap' :
                          cell.column.id === 'feeAmount' ? 'px-1 py-3 text-right' :
                          (cell.column.id === 'from' || cell.column.id === 'to') ? 'px-3 py-3' :
                          'px-4 py-3'
                        }
                      >
                        {cell.column.id === 'actions'
                          ? flexRender(cell.column.columnDef.cell, cell.getContext())
                          : (cell.column.id === 'from' || cell.column.id === 'to')
                            ? <div className="truncate">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                            : flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {isFetching && (
                  <tr>
                    <td colSpan={transactionColumns.length} className="text-center py-4 text-gray-500">
                      Loading more...
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
          </table>
        </div>
      </div>
      {/* Centered overlay for deep-page loading */}
      {isPageLoading && pageIndex > 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3 py-1 shadow">
            {fastModeActive ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-600" aria-label="loading" />
            ) : (
              <span className="text-xs text-gray-700" data-testid="page-loading-progress">
                {`Loading ${Math.round(((pageLoadProgress || 0) * 100))}%`}
              </span>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between mt-4">
        <button 
          onClick={() => { if (goToPage) goToPage(pageIndex - 1); else table.previousPage(); }}
          disabled={!table.getCanPreviousPage() || isFetching}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            <span>Previous</span>
            {fastModeActive && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">FAST</span>
            )}
          </span>
        </button>
        <span className="flex items-center gap-2">
          <span>
            Page{' '}
            <strong>
              {table.getState().pagination.pageIndex + 1} of {hasExactTotal ? String(table.getPageCount()) : `~${table.getPageCount()}`}
            </strong>
          </span>
          {/* Progress moved to centered overlay above to avoid duplication */}
        </span>
        <button 
          onClick={() => { if (goToPage) goToPage(pageIndex + 1); else table.nextPage(); }}
          disabled={!table.getCanNextPage() || isFetching}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            <span>Next</span>
            {fastModeActive && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">FAST</span>
            )}
          </span>
        </button>
      </div>

      {/* Quick jump row */}
      <div className="mt-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Go to page</label>
            <input
              type="number"
              min={1}
              max={pageCount || undefined}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGo(); }}
              placeholder="e.g. 5"
              className="w-24 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="goto-page-input"
            />
            <button
              onClick={handleGo}
              disabled={isFetching}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              data-testid="goto-page-button"
            >
              Go
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Quick:</span>
            {quickPages.map((p) => (
              <button
                key={p}
                onClick={() => { if (goToPage) goToPage(p - 1); else table.setPageIndex(p - 1); }}
                disabled={isFetching || (p - 1) === pageIndex}
                className={`px-2 py-1 text-sm rounded-md border ${((p - 1) === pageIndex) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
