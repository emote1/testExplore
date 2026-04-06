import React from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

import { useTransactionFilterStore, type TxTypeFilter } from '../stores/use-transaction-filter-store';

interface TokenOption {
  label: string;
  value: string;
}

interface TransactionsFiltersProps {
  getTypeBadge: (intent: TxTypeFilter) => number | null;
  typeBtnClass: (intent: TxTypeFilter) => string;
  tokenOptions: TokenOption[];
  selectedTokenLabel: string;
  selectedTokenDecimals: number;
  isAllMode: boolean;
  isReefMode: boolean;
  isMinInvalid: boolean;
  isMaxInvalid: boolean;
  isRangeInvalid: boolean;
}

export function TransactionsFilters({
  getTypeBadge,
  typeBtnClass,
  tokenOptions,
  selectedTokenLabel,
  selectedTokenDecimals,
  isAllMode,
  isReefMode,
  isMinInvalid,
  isMaxInvalid,
  isRangeInvalid,
}: TransactionsFiltersProps) {
  const txType = useTransactionFilterStore(state => state.txType);
  const setTxType = useTransactionFilterStore(state => state.setTxType);
  const tokenFilter = useTransactionFilterStore(state => state.tokenFilter);
  const setTokenFilter = useTransactionFilterStore(state => state.setTokenFilter);
  const minInput = useTransactionFilterStore(state => state.minAmountInput);
  const setMinInput = useTransactionFilterStore(state => state.setMinAmountInput);
  const maxInput = useTransactionFilterStore(state => state.maxAmountInput);
  const setMaxInput = useTransactionFilterStore(state => state.setMaxAmountInput);
  const resetFilters = useTransactionFilterStore(state => state.resetFilters);

  const [isFiltersOpen, setIsFiltersOpen] = React.useState<boolean>(false);

  const hasActiveFilters = React.useMemo(() => {
    const hasMin = !!(minInput || '').trim();
    const hasMax = !!(maxInput || '').trim();
    return tokenFilter !== 'all' || hasMin || hasMax;
  }, [tokenFilter, minInput, maxInput]);

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-sm text-muted-foreground shrink-0">Type:</span>
          <div className="flex flex-wrap items-center gap-2 min-w-0" role="group">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`h-9 px-4 py-2 text-sm font-medium ${typeBtnClass('all')}`}
              onClick={() => setTxType('all')}
            >
              All
              <Badge
                variant="secondary"
                className={`${txType === 'all' ? 'bg-white/20 text-white border-white/20' : 'bg-muted text-muted-foreground border-border'} ml-2`}
              >
                {getTypeBadge('all') ?? '—'}
              </Badge>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`h-9 px-4 py-2 text-sm font-medium ${typeBtnClass('incoming')}`}
              onClick={() => setTxType('incoming')}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Incoming
              <Badge
                variant="secondary"
                className={`${txType === 'incoming' ? 'bg-white/20 text-white border-white/20' : 'bg-muted text-muted-foreground border-border'} ml-2`}
              >
                {getTypeBadge('incoming') ?? '—'}
              </Badge>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`h-9 px-4 py-2 text-sm font-medium ${typeBtnClass('outgoing')}`}
              onClick={() => setTxType('outgoing')}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Outgoing
              <Badge
                variant="secondary"
                className={`${txType === 'outgoing' ? 'bg-white/20 text-white border-white/20' : 'bg-muted text-muted-foreground border-border'} ml-2`}
              >
                {getTypeBadge('outgoing') ?? '—'}
              </Badge>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`h-9 px-4 py-2 text-sm font-medium ${typeBtnClass('swap')}`}
              onClick={() => setTxType('swap')}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Swap
              <Badge
                variant="secondary"
                className={`${txType === 'swap' ? 'bg-white/20 text-white border-white/20' : 'bg-muted text-muted-foreground border-border'} ml-2`}
              >
                {getTypeBadge('swap') ?? '—'}
              </Badge>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`h-9 px-4 py-2 text-sm font-medium ${typeBtnClass('staking')}`}
              onClick={() => setTxType('staking')}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Staking
              <Badge
                variant="secondary"
                className={`${txType === 'staking' ? 'bg-white/20 text-white border-white/20' : 'bg-muted text-muted-foreground border-border'} ml-2`}
              >
                {getTypeBadge('staking') ?? '—'}
              </Badge>
            </Button>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 px-4 py-2 text-sm font-medium rounded-full border-border bg-card text-foreground/70 hover:bg-muted"
          onClick={() => setIsFiltersOpen((v) => !v)}
          aria-expanded={isFiltersOpen}
          aria-controls="tx-filters-panel"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasActiveFilters ? (
            <Badge variant="secondary" className="ml-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              On
            </Badge>
          ) : null}
        </Button>

        {hasActiveFilters && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 px-4 text-xs text-muted-foreground hover:text-foreground"
            onClick={resetFilters}
          >
            Reset All
          </Button>
        )}
      </div>

      <div
        id="tx-filters-panel"
        className={`overflow-hidden transition-all duration-300 ${isFiltersOpen ? 'max-h-[420px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="rounded-lg border border-border bg-muted p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Token:</span>
              <select
                className="h-9 px-3 text-sm border border-border rounded-md bg-card text-foreground hover:bg-muted"
                value={tokenFilter}
                onChange={(e) => setTokenFilter(e.target.value)}
                title="Filter by token contract"
              >
                {tokenOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col md:flex-row gap-6 w-full">
              <div className="flex flex-wrap items-start gap-6">
                <div className="flex flex-col">
                  <label className="mb-1 text-sm text-muted-foreground" htmlFor="min-reef-input">
                    Min {selectedTokenLabel}:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="min-reef-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 10, 10000"
                      value={minInput}
                      onChange={(e) => setMinInput(e.target.value)}
                      disabled={isAllMode}
                      title={isAllMode ? 'Select a token to enable amount filter' : undefined}
                      className={`h-9 w-40 px-3 border rounded-md focus:outline-none focus:ring-2 ${isAllMode ? 'bg-muted text-muted-foreground cursor-not-allowed border-border' : (isMinInvalid ? 'border-red-400 focus:ring-red-500' : 'border-border bg-background text-foreground focus:ring-blue-500')}`}
                      aria-invalid={isMinInvalid}
                    />
                    {minInput ? (
                      <button
                        type="button"
                        className="h-9 px-3 text-xs bg-card text-foreground border border-border rounded-md hover:bg-muted"
                        onClick={() => setMinInput('')}
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>

                  {isMinInvalid ? (
                    <p className="mt-1 text-xs text-red-600">
                      Enter a number with . or , separator (up to {selectedTokenDecimals} decimal places)
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col">
                  <label className="mb-1 text-sm text-muted-foreground" htmlFor="max-reef-input">
                    Max {selectedTokenLabel}:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="max-reef-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 1000, 50000"
                      value={maxInput}
                      onChange={(e) => setMaxInput(e.target.value)}
                      disabled={isAllMode}
                      title={isAllMode ? 'Select a token to enable amount filter' : undefined}
                      className={`h-9 w-40 px-3 border rounded-md focus:outline-none focus:ring-2 ${isAllMode ? 'bg-muted text-muted-foreground cursor-not-allowed border-border' : (isMaxInvalid ? 'border-red-400 focus:ring-red-500' : 'border-border bg-background text-foreground focus:ring-blue-500')}`}
                      aria-invalid={isMaxInvalid}
                    />
                    {maxInput ? (
                      <button
                        type="button"
                        className="h-9 px-3 text-xs bg-card text-foreground border border-border rounded-md hover:bg-muted"
                        onClick={() => setMaxInput('')}
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>

                  {isMaxInvalid ? (
                    <p className="mt-1 text-xs text-red-600">
                      Enter a number with . or , separator (up to {selectedTokenDecimals} decimal places)
                    </p>
                  ) : null}
                </div>
              </div>

              {isReefMode && (
                <div className="flex flex-col gap-2 ml-auto">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground min-w-[35px]">Min:</span>
                    <div className="flex gap-1.5">
                      {['100', '1000', '10000', '100000'].map((v) => (
                        <button
                          key={`min-${v}`}
                          type="button"
                          className="px-2.5 py-1 text-xs font-medium rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                          onClick={() => setMinInput(v)}
                        >
                          {v === '1000' ? '1k' : v === '10000' ? '10k' : v === '100000' ? '100k' : v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground min-w-[35px]">Max:</span>
                    <div className="flex gap-1.5">
                      {['100', '1000', '10000', '100000'].map((v) => (
                        <button
                          key={`max-${v}`}
                          type="button"
                          className="px-2.5 py-1 text-xs font-medium rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                          onClick={() => setMaxInput(v)}
                        >
                          {v === '1000' ? '1k' : v === '10000' ? '10k' : v === '100000' ? '100k' : v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {isRangeInvalid ? (
                <div className="text-xs text-red-600">
                  Min {selectedTokenLabel} must be less than or equal to Max {selectedTokenLabel}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
