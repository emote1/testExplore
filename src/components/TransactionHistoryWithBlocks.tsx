import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useTanstackTransactionAdapter } from '../hooks/useTanstackTransactionAdapter';
import type { UiTransfer } from '../data/transfer-mapper';
import { useTransferSubscription } from '../hooks/useTransferSubscription';
import { isValidEvmAddressFormat, isValidSubstrateAddressFormat } from '../utils/address-helpers';

const TransactionTableWithTanStack = React.lazy(() =>
  import('./TransactionTableWithTanStack').then(m => ({ default: m.TransactionTableWithTanStack }))
);

const NftGallery = React.lazy(() =>
  import('./NftGallery').then(m => ({ default: m.NftGallery }))
);

interface TransactionHistoryWithBlocksProps {
  initialAddress?: string;
}

export function TransactionHistoryWithBlocks({ initialAddress = '' }: TransactionHistoryWithBlocksProps) {
  const [viewMode, setViewMode] = React.useState<'transactions' | 'nfts'>('transactions');
  const [address, setAddress] = React.useState(initialAddress);
  const [submittedAddress, setSubmittedAddress] = React.useState(initialAddress);

  const [addressError, setAddressError] = React.useState<string | null>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
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
    setSubmittedAddress(input);
  };

  // Subcomponent renders only in transactions mode to avoid running heavy hooks when viewing NFTs
  function TransactionsView({ addr }: { addr: string }) {
    const { table, isLoading, error } = useTanstackTransactionAdapter(addr);
    const [newTransfers, setNewTransfers] = React.useState<string[]>([]);

    const onNewTransfer = React.useCallback((newTransfer: UiTransfer) => {
      if (!newTransfer) return;
      // Highlight newly detected transfer; Apollo cache will bring it via next fetch/page
      setNewTransfers(prev => {
        if (!prev.includes(newTransfer.id)) return [newTransfer.id, ...prev];
        return prev;
      });
      setTimeout(() => {
        setNewTransfers(prev => prev.filter(id => id !== newTransfer.id));
      }, 10000);
    }, []);

    useTransferSubscription({
      address: addr,
      onNewTransfer,
      isEnabled: !!addr,
    });

    React.useEffect(() => {
      setNewTransfers([]);
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
        <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
          <TransactionTableWithTanStack table={table} isLoading={isLoading} newTransfers={newTransfers} />
        </React.Suspense>
      </>
    );
  }

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
            disabled={false}
            className="flex items-center justify-center px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            data-testid="search-button"
          >
            {'Search'}
          </button>
        </form>

        {addressError && (
          <div className="flex items-center gap-4 p-3 mb-4 text-yellow-800 bg-yellow-100 rounded">
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
          </div>
        )}

        {submittedAddress ? (
          viewMode === 'transactions' ? (
            <TransactionsView addr={submittedAddress} />
          ) : (
            <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              <NftGallery address={submittedAddress} enableOwnerInfinite={enableOwnerInfiniteFlag} />
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
