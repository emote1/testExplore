import React from 'react';
import { Loader2, AlertTriangle, ArrowDownRight, ArrowUpRight, Award } from 'lucide-react';
import { useTanstackTransactionAdapter } from '../hooks/useTanstackTransactionAdapter';
import type { UiTransfer } from '../data/transfer-mapper';
import { useTransferSubscription } from '../hooks/useTransferSubscription';
import { isValidEvmAddressFormat, isValidSubstrateAddressFormat } from '../utils/address-helpers';
import { useAddressResolver } from '../hooks/use-address-resolver';
import { formatAmount } from '../utils/formatters';
import { AddressDisplay } from './AddressDisplay';

const TransactionTableWithTanStack = React.lazy(() =>
  import('./TransactionTableWithTanStack').then(m => ({ default: m.TransactionTableWithTanStack }))
);

const NftGallery = React.lazy(() =>
  import('./NftGallery').then(m => ({ default: m.NftGallery }))
);

const RewardsTable = React.lazy(() =>
  import('./RewardsTable').then(m => ({ default: m.RewardsTable }))
);

// Top-level TransactionsView so it does not remount on each parent render.
function TransactionsView({ addr }: { addr: string }) {
  const { table, isLoading, error, showNewItems, goToPage, isPageLoading, pageLoadProgress, hasExactTotal, fastModeActive } = useTanstackTransactionAdapter(addr);
  const [newTransfers, setNewTransfers] = React.useState<string[]>([]);
  const [toastTransfer, setToastTransfer] = React.useState<UiTransfer | null>(null);
  const toastTimerRef = React.useRef<number | undefined>(undefined);

  const onNewTransfer = React.useCallback((newTransfer: UiTransfer) => {
    if (!newTransfer) return;
    // Highlight newly detected transfer; Apollo cache will bring it via next fetch/page
    setNewTransfers(prev => {
      if (!prev.includes(newTransfer.id)) return [newTransfer.id, ...prev];
      return prev;
    });
    // If пользователь на первой странице — обновим якорь, иначе сохраним текущую позицию
    const isOnFirstPage = table.getState().pagination.pageIndex === 0;
    if (isOnFirstPage) {
      showNewItems(newTransfer.id);
    }

    // Show bottom-right toast with info about the transfer
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = undefined;
    }
    setToastTransfer(newTransfer);
    toastTimerRef.current = window.setTimeout(() => setToastTransfer(null), 6000);

    setTimeout(() => {
      setNewTransfers(prev => prev.filter(id => id !== newTransfer.id));
    }, 10000);
  }, [showNewItems, table]);

  useTransferSubscription({
    address: addr,
    onNewTransfer,
    // Avoid race: start polling only after initial paginated query has loaded
    // so cache.updateQuery can prepend into an existing connection entry
    isEnabled: !!addr && !isLoading,
  });

  React.useEffect(() => {
    setNewTransfers([]);
    setToastTransfer(null);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = undefined;
    }
  }, [addr]);

  return (
    <>
      {error && (
        <div className="flex items-center gap-4 p-4 mb-4 text-red-700 bg-red-100 rounded-lg shadow">
          <AlertTriangle className="h-6 w-6" />
          <div>
            <h3 className="font-bold">Error Fetching Transactions</h3>
            <p>{error.message}</p>
          </div>
        </div>
      )}
      {toastTransfer && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm w-[360px] p-4 rounded-lg shadow-lg border ${toastTransfer.type === 'INCOMING' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}
          data-testid="new-transfer-toast"
        >
          <div className="flex items-start gap-3">
            <div className={`rounded-full p-2 ${toastTransfer.type === 'INCOMING' ? 'bg-green-100' : 'bg-red-100'}`}>
              {toastTransfer.type === 'INCOMING' ? (
                <ArrowDownRight className="h-6 w-6" />
              ) : (
                <ArrowUpRight className="h-6 w-6" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1">
                {toastTransfer.type === 'INCOMING' ? 'Incoming' : 'Outgoing'} transfer
              </div>
              <div className="text-lg font-bold mb-1">
                {formatAmount(toastTransfer.amount, toastTransfer.token.decimals, toastTransfer.token.name)}
              </div>
              <div className="text-sm">
                {toastTransfer.type === 'INCOMING' ? (
                  <span>from <AddressDisplay address={toastTransfer.from} /></span>
                ) : (
                  <span>to <AddressDisplay address={toastTransfer.to} /></span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
        <TransactionTableWithTanStack
          table={table}
          isLoading={isLoading}
          newTransfers={newTransfers}
          goToPage={goToPage}
          isPageLoading={isPageLoading}
          pageLoadProgress={pageLoadProgress}
          hasExactTotal={hasExactTotal}
          fastModeActive={fastModeActive}
        />
      </React.Suspense>
    </>
  );
}

interface TransactionHistoryWithBlocksProps {
  initialAddress?: string;
}

export function TransactionHistoryWithBlocks({ initialAddress = '' }: TransactionHistoryWithBlocksProps) {
  const [viewMode, setViewMode] = React.useState<'transactions' | 'nfts' | 'rewards'>('transactions');
  const [address, setAddress] = React.useState(initialAddress);
  const [submittedAddress, setSubmittedAddress] = React.useState(initialAddress);

  const [addressError, setAddressError] = React.useState<string | null>(null);
  const { validateAddress, isResolving } = useAddressResolver();

  // Enable owner-based infinite NFTs mode for E2E via URL flag: ?infiniteOwner=1
  const enableOwnerInfiniteFlag = React.useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('infiniteOwner') ?? params.get('ownerInfinite');
      return raw === '1' || raw === 'true' || raw === 'yes';
    } catch {
      return false;
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = address.trim();
    const isValid = isValidEvmAddressFormat(input) || isValidSubstrateAddressFormat(input);
    if (!isValid) {
      setAddressError('Некорректный адрес');
      // Clear previously submitted address to avoid showing stale NFTs/transactions
      setSubmittedAddress('');
      return;
    }

    setAddressError(null);
    try {
      const exists = await validateAddress(input);
      if (!exists) {
        setAddressError('Адрес не найден в сети Reef');
        setSubmittedAddress('');
        return;
      }
    } catch {
      // Network or resolver error: keep UX predictable and do not submit
      setAddressError('Не удалось проверить адрес. Попробуйте ещё раз.');
      setSubmittedAddress('');
      return;
    }

    // If this is NOT the first submission (adapter already mounted), clear sticky page params
    if (submittedAddress) {
      try {
        const url = new URL(window.location.href);
        const params = url.searchParams;
        params.delete('page');
        params.delete('p');
        params.delete('pageIndex');
        const search = params.toString();
        const newUrl = `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
        window.history.replaceState({}, '', newUrl);
      } catch {}
    }

    setSubmittedAddress(input);
  };

  // Subcomponent removed from inline scope; using top-level TransactionsView instead.

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Transaction History</h1>
        <p className="text-gray-600 mb-6">
          Enter a Reef address to view its transaction history.
        </p>

                <form onSubmit={handleSubmit} className="flex items-center gap-4 mb-6 p-4 bg-white rounded-lg shadow">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter Reef address"
            className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="address-input"
          />
          <button
            type="submit"
            disabled={isResolving}
            className="flex items-center justify-center px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            data-testid="search-button"
          >
            {'Search'}
          </button>
        </form>

        {addressError && (
          <div className="flex items-center gap-4 p-3 mb-4 text-yellow-800 bg-yellow-100 rounded" data-testid="address-error">
            <AlertTriangle className="h-5 w-5" />
            <p>{addressError}</p>
          </div>
        )}

        {/* Network-error box moved into TransactionsView context */}

                {submittedAddress && (
          <div className="flex mb-4 border-b">
            <button
              className={`px-4 py-2 -mb-px font-semibold border-b-2 ${
                viewMode === 'transactions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setViewMode('transactions')}
            >
              Transactions
            </button>
            <button
              className={`px-4 py-2 -mb-px font-semibold border-b-2 ${
                viewMode === 'nfts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setViewMode('nfts')}
              data-testid="tab-nfts"
            >
              NFTs
            </button>
            <button
              className={`px-4 py-2 -mb-px font-semibold border-b-2 ${
                viewMode === 'rewards'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setViewMode('rewards')}
              data-testid="tab-rewards"
            >
              <span className="inline-flex items-center gap-2"><Award className="h-4 w-4" /> Rewards</span>
            </button>
          </div>
        )}

        {submittedAddress ? (
          viewMode === 'transactions' ? (
            <TransactionsView addr={submittedAddress} />
          ) : viewMode === 'nfts' ? (
            <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              <NftGallery address={submittedAddress} enableOwnerInfinite={enableOwnerInfiniteFlag} />
            </React.Suspense>
          ) : (
            <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              <RewardsTable address={submittedAddress} />
            </React.Suspense>
          )
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">Please enter an address to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
