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
  debouncedMinInput: string;
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
  debouncedMinInput,
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">Type:</span>
          <div className="inline-flex items-center gap-2" role="group">
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
                className={`${txType === 'all' ? 'bg-white/20 text-white border-white/20' : 'bg-gray-100 text-gray-600 border-gray-200'} ml-2`}
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
                className={`${txType === 'incoming' ? 'bg-white/20 text-white border-white/20' : 'bg-gray-100 text-gray-600 border-gray-200'} ml-2`}
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
                className={`${txType === 'outgoing' ? 'bg-white/20 text-white border-white/20' : 'bg-gray-100 text-gray-600 border-gray-200'} ml-2`}
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
                className={`${txType === 'swap' ? 'bg-white/20 text-white border-white/20' : 'bg-gray-100 text-gray-600 border-gray-200'} ml-2`}
              >
                {getTypeBadge('swap') ?? '—'}
              </Badge>
            </Button>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 px-4 py-2 text-sm font-medium rounded-full border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          onClick={() => setIsFiltersOpen((v) => !v)}
          aria-expanded={isFiltersOpen}
          aria-controls="tx-filters-panel"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasActiveFilters ? (
            <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-700 border border-blue-200">
              On
            </Badge>
          ) : null}
        </Button>
        {hasActiveFilters && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 px-4 text-xs text-gray-500 hover:text-gray-900"
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
        <div className="rounded-lg border border-gray-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">Token:</span>
              <select
                className="h-9 px-3 text-sm border border-gray-200 rounded-md bg-white text-gray-700 hover:bg-gray-50"
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

            <div className="flex flex-wrap items-start gap-6">
              <div className="flex flex-col">
                <label className="mb-1 text-sm text-gray-600" htmlFor="min-reef-input">
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
                    className={`h-9 w-40 px-3 border rounded-md focus:outline-none focus:ring-2 ${isAllMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : (isMinInvalid ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500')}`}
                    aria-invalid={isMinInvalid}
                  />
                  {minInput ? (
                    <button
                      type="button"
                      className="h-9 px-3 text-xs bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                      onClick={() => setMinInput('')}
                    >
                      Reset
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {['100', '1000', '10000', '100000'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${!isReefMode
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : (debouncedMinInput === v
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-600'
                          : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50')}`}
                      onClick={() => { if (isReefMode) setMinInput(v); }}
                      disabled={!isReefMode}
                    >
                      {v === '1000' ? '1k' : v === '10000' ? '10k' : v === '100000' ? '100k' : v}
                    </button>
                  ))}
                </div>

                {isMinInvalid ? (
                  <p className="mt-1 text-xs text-red-600">
                    Введите число с разделителем . или , (до {selectedTokenDecimals} знаков после запятой)
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col">
                <label className="mb-1 text-sm text-gray-600" htmlFor="max-reef-input">
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
                    className={`h-9 w-40 px-3 border rounded-md focus:outline-none focus:ring-2 ${isAllMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : (isMaxInvalid ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500')}`}
                    aria-invalid={isMaxInvalid}
                  />
                  {maxInput ? (
                    <button
                      type="button"
                      className="h-9 px-3 text-xs bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                      onClick={() => setMaxInput('')}
                    >
                      Reset
                    </button>
                  ) : null}
                </div>

                {isMaxInvalid ? (
                  <p className="mt-1 text-xs text-red-600">
                    Введите число с разделителем . или , (до {selectedTokenDecimals} знаков после запятой)
                  </p>
                ) : null}
              </div>

              {isRangeInvalid ? (
                <div className="mt-1 text-xs text-red-600">
                  Min {selectedTokenLabel} должен быть меньше или равен Max {selectedTokenLabel}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
