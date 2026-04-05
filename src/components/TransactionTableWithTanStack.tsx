import {
  flexRender,
  Table,
  Row,
} from '@tanstack/react-table';
import { Loader2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { transactionColumns } from './transaction-columns';
import type { UiTransfer } from '../data/transfer-mapper';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import { formatTokenAmount, formatRelativeShort } from '../utils/formatters';
import { shortenHash } from '../utils/formatters';

interface TransactionRowProps {
  row: Row<UiTransfer>;
  newTransfers: string[];
  onRowClick: (e: React.MouseEvent, transfer: UiTransfer) => void;
  onRowKeyDown: (e: React.KeyboardEvent, transfer: UiTransfer) => void;
}

const TransactionRow = React.memo(function TransactionRow({ row, newTransfers, onRowClick, onRowKeyDown }: TransactionRowProps) {
  return (
    <tr
      key={row.id}
      data-testid="tx-row"
      data-transfer-id={row.original.id}
      onClick={(e) => onRowClick(e, row.original)}
      onKeyDown={(e) => onRowKeyDown(e, row.original)}
      tabIndex={0}
      aria-label="Open transaction details"
      className={`group transition-colors transition-transform duration-200 cursor-pointer hover:bg-gray-50 hover:-translate-y-px focus-visible:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white ${row.index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} ${newTransfers.includes(row.original.id) ? 'row-wash' : ''}`}
    >
      {row.getVisibleCells().map(cell => (
        <td
          key={cell.id}
          className={
            cell.column.id === 'actions' ? 'px-1 py-4 text-center w-10' :
            cell.column.id === 'value' ? 'px-3 py-4 text-right whitespace-nowrap' :
            'px-3 py-4'
          }
          style={cell.column.id !== 'actions' ? { width: '14%' } : undefined}
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
});

const TransactionCard = React.memo(function TransactionCard({
  row, newTransfers, onRowClick, onRowKeyDown,
}: TransactionRowProps) {
  const tx = row.original;
  const isIncoming = tx.type === 'INCOMING';
  const isSwap = tx.method === 'swap' || tx.type === 'SWAP';

  // Format amount
  let amountLabel: React.ReactNode;
  if (isSwap && tx.swapInfo) {
    const bought = tx.swapInfo.bought;
    const boughtRaw = String(bought.amount || '0');
    const boughtAbs = boughtRaw.startsWith('-') ? boughtRaw.slice(1) : boughtRaw;
    const boughtFmt = formatTokenAmount(boughtAbs, bought.token.decimals, bought.token.name);
    amountLabel = <span className="text-green-600">+{boughtFmt}</span>;
  } else {
    const formatted = formatTokenAmount(tx.amount, tx.token.decimals, tx.token.name);
    const isErcToken = !tx.isNft && (tx.token?.name !== 'REEF') && ((tx.token?.decimals ?? 18) > 0);
    const prefix = isErcToken ? (isIncoming ? '+' : '\u2212') : '';
    const cls = isErcToken ? (isIncoming ? 'text-green-600' : 'text-yellow-700') : '';
    amountLabel = <span className={cls}>{prefix}{formatted}</span>;
  }

  // Counterparty address
  const counterparty = isSwap ? null : (isIncoming ? tx.from : tx.to);
  const counterpartyLabel = isSwap ? null : (isIncoming ? 'From' : 'To');

  return (
    <div
      data-testid="tx-card"
      onClick={(e) => onRowClick(e, tx)}
      onKeyDown={(e) => onRowKeyDown(e, tx)}
      tabIndex={0}
      aria-label="Open transaction details"
      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors ${
        newTransfers.includes(tx.id) ? 'row-wash' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${
          isSwap ? 'border-blue-400 text-blue-600' :
          isIncoming ? 'border-green-400 text-green-600' : 'border-orange-400 text-orange-600'
        }`}>
          {isSwap ? <><ArrowLeftRight className="w-3 h-3" /> Swap</> :
           isIncoming ? <><ArrowDownLeft className="w-3 h-3" /> In</> :
           <><ArrowUpRight className="w-3 h-3" /> Out</>}
        </span>
        <span className="text-xs text-gray-500">{formatRelativeShort(tx.timestamp)}</span>
      </div>
      <div className="text-sm font-semibold tabular-nums mb-1">
        {amountLabel}
      </div>
      {counterparty && (
        <div className="text-xs text-gray-500 font-mono truncate">
          {counterpartyLabel}: {shortenHash(counterparty, 8, 6)}
        </div>
      )}
    </div>
  );
});

interface TransactionTableWithTanStackProps {
  newTransfers?: string[];
  table: Table<UiTransfer>;
  isLoading: boolean;
  isFetching?: boolean;
  totalCount?: number;
  loadedCount?: number;
  /** Optional adapter-level deep jump to avoid TanStack clamping */
  goToPage?: (pageIndex: number) => void;
  /** Page-level loading progress for deep jumps */
  isPageLoading?: boolean;
  pageLoadProgress?: number; // 0..1
  /** Exact total known vs heuristic */
  hasExactTotal?: boolean;
  /** When true, adapter is using offset/limit fast mode */
  fastModeActive?: boolean;
  /** Optional hint to show when the table has no rows (overrides spinner) */
  emptyHint?: string;
}

export function TransactionTableWithTanStack({ table, isLoading, isFetching, totalCount, loadedCount, newTransfers = [], goToPage, isPageLoading, pageLoadProgress, hasExactTotal = false, fastModeActive = false, emptyHint }: TransactionTableWithTanStackProps) {
  const DEEP_LOADER_MIN_PAGE_INDEX = 9; // show loader starting from page 10
  const DEEP_LOADER_SHOW_DELAY_MS = 450;
  const rows = table.getRowModel().rows;
  const enableVirtual = rows.length > 30;
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [detailsFor, setDetailsFor] = useState<UiTransfer | null>(null);
  const [hasRequestedData, setHasRequestedData] = useState<boolean>(false);
  const [showEmptyState, setShowEmptyState] = useState<boolean>(false);
  useEffect(() => {
    if (isLoading || isFetching || isPageLoading) setHasRequestedData(true);
  }, [isLoading, isFetching, isPageLoading]);
  useEffect(() => {
    const hasFiniteTotal = typeof totalCount === 'number' && Number.isFinite(totalCount);
    const isEmptyCandidate =
      rows.length === 0 &&
      !isLoading &&
      !isPageLoading &&
      hasRequestedData &&
      (emptyHint != null || (hasExactTotal && hasFiniteTotal && totalCount === 0));

    if (!isEmptyCandidate) {
      setShowEmptyState(false);
      return;
    }

    const id = window.setTimeout(() => setShowEmptyState(true), 250);
    return () => window.clearTimeout(id);
  }, [rows.length, isLoading, isPageLoading, hasRequestedData, emptyHint, hasExactTotal, totalCount]);
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

  // Sorting badge label
  const sortBadge = useMemo(() => {
    const s = (table.getState().sorting || [])[0] as { id?: string; desc?: boolean } | undefined;
    if (!s || !s.id) return null;
    const label = s.id === 'amount' ? 'Amount' : s.id === 'timestamp' ? 'Timestamp' : String(s.id);
    return `${label} ${s.desc ? '↓' : '↑'}`;
  }, [table]);

  // Quick jump helpers
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const [showDeepPageLoader, setShowDeepPageLoader] = useState<boolean>(false);
  const deepLoaderShownAtRef = useRef<number>(0);
  const [deepLoaderProgressPct, setDeepLoaderProgressPct] = useState<number>(0);
  const deepLoaderPctUpdatedAtRef = useRef<number>(0);
  const progressPageRef = useRef<number>(pageIndex);
  const [jumpInput, setJumpInput] = useState<string>('');
  useEffect(() => {
    if (progressPageRef.current !== pageIndex) {
      progressPageRef.current = pageIndex;
      setDeepLoaderProgressPct(0);
      deepLoaderPctUpdatedAtRef.current = 0;
    }
  }, [pageIndex]);
  useEffect(() => {
    const nextPct = Math.max(0, Math.min(100, Math.round((pageLoadProgress || 0) * 100)));
    const raw = !!isPageLoading && pageIndex >= DEEP_LOADER_MIN_PAGE_INDEX;
    if (!raw && !showDeepPageLoader) return;
    setDeepLoaderProgressPct((prev) => {
      const stepped = nextPct >= 100 ? 100 : Math.floor(nextPct / 2) * 2;
      if (stepped <= prev) return prev;
      const now = Date.now();
      if (stepped < 100 && deepLoaderPctUpdatedAtRef.current > 0 && (now - deepLoaderPctUpdatedAtRef.current) < 180) {
        return prev;
      }
      if (stepped < 100 && (stepped - prev) < 2) return prev;
      deepLoaderPctUpdatedAtRef.current = now;
      return stepped;
    });
  }, [isPageLoading, pageIndex, pageLoadProgress, showDeepPageLoader]);
  useEffect(() => {
    const raw = !!isPageLoading && pageIndex >= DEEP_LOADER_MIN_PAGE_INDEX;
    if (raw) {
      if (showDeepPageLoader) return;
      const showTimer = window.setTimeout(() => {
        deepLoaderShownAtRef.current = Date.now();
        setShowDeepPageLoader(true);
      }, DEEP_LOADER_SHOW_DELAY_MS);
      return () => window.clearTimeout(showTimer);
    }

    if (!showDeepPageLoader) return;
    const elapsed = Date.now() - (deepLoaderShownAtRef.current || 0);
    const minVisibleRemain = Math.max(0, 280 - elapsed);
    // Extra hysteresis to avoid quick hide/show flicker when loading toggles briefly
    const hideDelay = minVisibleRemain + 220;
    const hideTimer = window.setTimeout(() => setShowDeepPageLoader(false), hideDelay);
    return () => window.clearTimeout(hideTimer);
  }, [isPageLoading, pageIndex, showDeepPageLoader, DEEP_LOADER_MIN_PAGE_INDEX, DEEP_LOADER_SHOW_DELAY_MS]);
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
  // Validate and clamp jump target to [1..pageCount]
  const jumpMax = Math.max(1, pageCount || 1);
  const jumpNum = (() => { const n = Number(jumpInput); return Number.isFinite(n) ? Math.floor(n) : NaN; })();
  const jumpValid = Number.isFinite(jumpNum) && jumpNum >= 1 && jumpNum <= jumpMax;
  function handleGo() {
    if (!jumpValid) return;
    const clamped = Math.min(Math.max(1, jumpNum as number), jumpMax);
    if (goToPage) goToPage(clamped - 1);
    else table.setPageIndex(clamped - 1);
  }

  // Open details modal for a row; ignore clicks originating from links/buttons
  function onRowClick(e: React.MouseEvent, transfer: UiTransfer) {
    const target = e.target as HTMLElement;
    if (target.closest('a,button,[role="button"],.no-row-open')) return;
    setDetailsFor(transfer);
  }
  function onRowKeyDown(e: React.KeyboardEvent, transfer: UiTransfer) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setDetailsFor(transfer);
    }
  }

  return (
    <div className="relative p-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {sortBadge ? (
        <div className="absolute top-2 right-3">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
            Sorted by {sortBadge}
          </span>
        </div>
      ) : null}
      {/* Desktop: table layout */}
      <div className="hidden sm:block">
        <div className="overflow-x-auto md:overflow-x-visible">
          <div ref={parentRef} className={enableVirtual ? 'max-h-[70vh] min-h-[420px] overflow-auto' : 'min-h-[420px]'}>
            <table className="w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-white">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="border-b-2 border-slate-200">
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className={`px-3 py-3 text-[13px] font-semibold text-slate-700 font-sans text-left
                        ${header.column.id === 'actions' ? 'w-10 text-center px-1' : ''}
                        ${header.column.id === 'value' ? 'text-right' : ''}
                      `}
                      style={header.column.id !== 'actions' ? { width: '14%' } : undefined}
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
            <tbody className="bg-white divide-y divide-gray-200 fade-in">
              {(() => {
                const hasFiniteTotal = typeof totalCount === 'number' && Number.isFinite(totalCount);
                const isConfirmedEmpty = showEmptyState;

                // If totalCount is known to be 0, skip loading and show empty state immediately
                const isKnownEmpty = hasFiniteTotal && totalCount === 0;

                const shouldShowLoading =
                  rows.length === 0 &&
                  !isKnownEmpty &&
                  (isLoading ||
                    isPageLoading ||
                    (!hasRequestedData && pageIndex === 0) ||
                    // Prevent empty-state flash when total is known >0 but rows haven't materialized yet
                    (pageIndex === 0 && hasFiniteTotal && totalCount > 0 && !isConfirmedEmpty) ||
                    // If adapter already reports some loaded items, avoid claiming empty
                    (pageIndex === 0 && typeof loadedCount === 'number' && loadedCount > 0 && !isConfirmedEmpty));

                if (shouldShowLoading) {
                  return (
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
                  );
                }

                if (isConfirmedEmpty || isKnownEmpty) {
                  return (
                <tr>
                  <td colSpan={transactionColumns.length} className="text-center py-6 text-gray-500">
                    {emptyHint ?? 'No transactions found for this address.'}
                  </td>
                </tr>
                  );
                }

                if (rows.length === 0) return null;

                if (enableVirtual) {
                  return (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td colSpan={transactionColumns.length} style={{ height: paddingTop }} />
                    </tr>
                  )}
                  {virtualItems.map(vItem => {
                    const row = rows[vItem.index]!;
                    return (
                      <TransactionRow
                        key={row.id}
                        row={row}
                        newTransfers={newTransfers}
                        onRowClick={onRowClick}
                        onRowKeyDown={onRowKeyDown}
                      />
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
                  );
                }

                return (
                <>
                  {rows.map((row) => (
                    <TransactionRow
                      key={row.id}
                      row={row}
                      newTransfers={newTransfers}
                      onRowClick={onRowClick}
                      onRowKeyDown={onRowKeyDown}
                    />
                  ))}
                  {isFetching && (
                    <tr>
                      <td colSpan={transactionColumns.length} className="text-center py-4 text-gray-500">
                        Loading more...
                      </td>
                    </tr>
                  )}
                </>
                );
              })()}
            </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mobile: card layout */}
      <div className="sm:hidden">
        {(() => {
          const hasFiniteTotal = typeof totalCount === 'number' && Number.isFinite(totalCount);
          const isConfirmedEmpty = showEmptyState;
          const isKnownEmpty = hasFiniteTotal && totalCount === 0;
          const shouldShowLoading =
            rows.length === 0 &&
            !isKnownEmpty &&
            (isLoading ||
              isPageLoading ||
              (!hasRequestedData && pageIndex === 0) ||
              (pageIndex === 0 && hasFiniteTotal && totalCount > 0 && !isConfirmedEmpty) ||
              (pageIndex === 0 && typeof loadedCount === 'number' && loadedCount > 0 && !isConfirmedEmpty));

          if (shouldShowLoading) {
            return (
              <div className="flex items-center justify-center py-8 text-gray-600">
                {pageIndex === 0 ? (
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading…</span>
                  </div>
                ) : null}
              </div>
            );
          }

          if (isConfirmedEmpty || isKnownEmpty) {
            return (
              <div className="py-8 text-center text-gray-500">
                {emptyHint ?? 'No transactions found for this address.'}
              </div>
            );
          }

          if (rows.length === 0) return null;

          return (
            <div className="divide-y divide-gray-100">
              {rows.map(row => (
                <TransactionCard
                  key={row.id}
                  row={row}
                  newTransfers={newTransfers}
                  onRowClick={onRowClick}
                  onRowKeyDown={onRowKeyDown}
                />
              ))}
              {isFetching && (
                <div className="py-4 text-center text-gray-500 text-sm">Loading more...</div>
              )}
            </div>
          );
        })()}
      </div>
      {/* Centered overlay for deep-page loading */}
      {showDeepPageLoader ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3 py-1 shadow">
            {fastModeActive ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-600" aria-label="loading" />
            ) : (
              <span className="inline-flex min-w-[108px] justify-center text-xs text-gray-700 tabular-nums" data-testid="page-loading-progress">
                {`Loading ${deepLoaderProgressPct}%`}
              </span>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => { if (goToPage) goToPage(pageIndex - 1); else table.previousPage(); }}
            disabled={!table.getCanPreviousPage() || isFetching}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>Previous</span>
          </button>

          <div className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <span>
              Page{' '}
              <strong>
                {table.getState().pagination.pageIndex + 1} of {(() => { const pc = table.getPageCount(); return (!hasExactTotal && pc > 1) ? `~${pc}` : String(pc); })()}
              </strong>
            </span>
          </div>

          <button
            onClick={() => { if (goToPage) goToPage(pageIndex + 1); else table.nextPage(); }}
            disabled={!table.getCanNextPage() || isFetching}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>Next</span>
          </button>
        </div>

        {/* Quick jump row */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-600">Go to page</label>
            <input
              type="number"
              min={1}
              max={pageCount || undefined}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGo(); }}
              placeholder="e.g. 5"
              className="h-9 w-24 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white"
              data-testid="goto-page-input"
            />
            <button
              onClick={handleGo}
              disabled={isFetching || !jumpValid}
              className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="goto-page-button"
            >
              Go
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">
              Quick{hasExactTotal ? '' : ' ~'}:
            </span>
            {quickPages.map((p) => (
              <button
                key={p}
                onClick={() => { if (goToPage) goToPage(p - 1); else table.setPageIndex(p - 1); }}
                disabled={isFetching || (p - 1) === pageIndex}
                className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 ${((p - 1) === pageIndex) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Details modal */}
      <TransactionDetailsModal
        open={!!detailsFor}
        transfer={detailsFor}
        onClose={() => setDetailsFor(null)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pricesById={(table.options as any)?.meta?.pricesById}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reefUsd={(table.options as any)?.meta?.reefUsd}
      />
    </div>
  );
};
