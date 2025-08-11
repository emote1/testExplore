import React from 'react';
import { useTanstackTransactionAdapter } from '../hooks/useTanstackTransactionAdapter';
import type { UiTransfer } from '../data/transfer-mapper';
import { useTransferSubscription } from '../hooks/useTransferSubscription';
import { TransactionTableWithTanStack } from './TransactionTableWithTanStack';
import { Loader2, AlertTriangle } from 'lucide-react';
import { NftGallery } from './NftGallery';

interface TransactionHistoryWithBlocksProps {
  initialAddress?: string;
}

export function TransactionHistoryWithBlocks({ initialAddress = '' }: TransactionHistoryWithBlocksProps) {
  const [viewMode, setViewMode] = React.useState<'transactions' | 'nfts'>('transactions');
  const [address, setAddress] = React.useState(initialAddress);
  const [submittedAddress, setSubmittedAddress] = React.useState(initialAddress);

  const { table, isLoading, error, addTransaction } = useTanstackTransactionAdapter(submittedAddress);
  const [newTransfers, setNewTransfers] = React.useState<string[]>([]);

  const onNewTransfer = React.useCallback((newTransfer: UiTransfer) => {
    if (newTransfer) {
      addTransaction(newTransfer);
      setNewTransfers(prev => {
        // Only add if not already in the list
        if (!prev.includes(newTransfer.id)) {
          return [newTransfer.id, ...prev];
        }
        return prev;
      });
      
      // Auto-remove highlight after 10 seconds
      setTimeout(() => {
        setNewTransfers(prev => prev.filter(id => id !== newTransfer.id));
      }, 10000);
    }
  }, [addTransaction]);

  useTransferSubscription({
    address: submittedAddress,
    onNewTransfer,
    isEnabled: !!submittedAddress,
  });

  React.useEffect(() => {
    setNewTransfers([]);
    setViewMode('transactions'); // Reset to transactions view on new address submission
  }, [submittedAddress]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedAddress(address);
  };

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
          />
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Search'}
          </button>
        </form>

        {error && (
          <div className="flex items-center gap-4 p-4 mb-4 text-red-700 bg-red-100 rounded-lg shadow">
            <AlertTriangle className="h-6 w-6" />
            <div>
              <h3 className="font-bold">Error Fetching Transactions</h3>
              <p>{error.message}</p>
            </div>
          </div>
        )}

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
            <TransactionTableWithTanStack table={table} isLoading={isLoading} newTransfers={newTransfers} />
          ) : (
            <NftGallery address={submittedAddress} />
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
