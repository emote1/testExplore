import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatUnits } from 'ethers';
import { useTransactionDataWithBlocks } from '../hooks/use-transaction-data-with-blocks';
import type { Transaction } from '../types/transaction-types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Loader2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { generateReefscanUrl } from '../utils/reefscan-helpers';

interface TransactionHistoryWithBlocksProps {
  initialAddress?: string;
}

export function TransactionHistoryWithBlocks({ initialAddress = '' }: TransactionHistoryWithBlocksProps) {
  const {
    transactions,
    currentPage,
    hasNextPage,
    totalTransactions,
    error,
    isFetchingTransactions,
    isNavigatingToLastPage,
    isLastPageNavigable,
    userInputAddress,
    nativeAddressForCurrentSearch,
    handleFirstPage,
    handlePreviousPage,
    handleNextPage,
    handleLastPage,
    handleAddressSubmit,
    setUserInputAddress,
    cacheStats,
    blockStats
  } = useTransactionDataWithBlocks(initialAddress);

  const [showDebugInfo, setShowDebugInfo] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddressSubmit(userInputAddress);
  };

  const formatAmount = (amount: string, tokenDecimals: number, tokenSymbol: string): string => {
    try {
      // For tokens with 0 decimals, the amount is already in the correct unit.
      // We just need to format it for display.
      if (tokenDecimals === 0) {
        const numberAmount = parseFloat(amount);
        return `${numberAmount.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 4 })} ${tokenSymbol}`;
      }

      const formatted = formatUnits(amount, tokenDecimals);
      const number = parseFloat(formatted);

      // Use toLocaleString for thousands separators and appropriate decimal representation
      const displayAmount = number.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4, 
      });

      return `${displayAmount} ${tokenSymbol || 'REEF'}`;
    } catch (error) {
      console.error('Failed to format amount:', error);
      return `0 ${tokenSymbol || 'REEF'}`; // Fallback on error
    }
  };

  const formatFee = (feeAmount?: string, feeTokenSymbol?: string): string => {
    const symbol = feeTokenSymbol || 'REEF';
    if (!feeAmount || feeAmount === '0') return `0 ${symbol}`;

    try {
      // Assume fee is always in REEF with 18 decimals
      const formattedFee = formatUnits(feeAmount, 18);
      const displayFee = parseFloat(formattedFee).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      });
      return `${displayFee} ${symbol}`;
    } catch (error) {
      console.error("Failed to format fee:", error);
      return `0 ${symbol}`;
    }
  };

  const getTransactionType = (transaction: Transaction, currentAddress: string | null | undefined): string => {
    if (!currentAddress || (!transaction.from && !transaction.to)) return ''; // Or some default/unknown type
    // Ensure addresses are compared case-insensitively and handle potential nulls
    const currentAddrLower = currentAddress.toLowerCase();
    const fromLower = transaction.from?.toLowerCase();
    const toLower = transaction.to?.toLowerCase();

    if (fromLower === currentAddrLower && toLower === currentAddrLower) {
      // Self-transaction, could be marked as 'Self' or based on other logic if needed
      return 'Исходящая транзакция'; // Or 'Self-transfer', defaulting to Outgoing for now
    }
    if (fromLower === currentAddrLower) {
      return 'Исходящая транзакция'; // Outgoing
    }
    if (toLower === currentAddrLower) {
      return 'Входящая транзакция'; // Incoming
    }
    return ''; // Address not directly involved as sender or receiver
  };

  const formatDate = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateHash = (hash: string, start: number = 6, end: number = 4): string => {
    if (!hash) return '';
    return `${hash.substring(0, start)}...${hash.substring(hash.length - end)}`;
  };

  const isNftTransfer = (tokenSymbol: string): boolean => {
    if (!tokenSymbol) return false;
    const upperSymbol = tokenSymbol.toUpperCase();
    return upperSymbol.includes('ERC1155') || upperSymbol.includes('ERC721');
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">
          Transaction History (Block Pagination)
        </h1>
        <p className="text-gray-600">
          Enhanced with block-based pagination for improved performance
        </p>
      </div>

      {/* Address Search Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            value={userInputAddress}
            onChange={(e) => setUserInputAddress(e.target.value)}
            placeholder="Enter wallet address..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isFetchingTransactions}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFetchingTransactions ? 'Loading...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Debug Toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowDebugInfo(!showDebugInfo)}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          {showDebugInfo ? 'Hide' : 'Show'} Debug Info
        </button>
      </div>

      {/* Debug Information */}
      <AnimatePresence>
        {showDebugInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm"
          >
            <h3 className="font-semibold text-gray-900">Debug Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-700">Block Stats</h4>
                <ul className="text-gray-600">
                  <li>Has Current Block: {blockStats.hasCurrentBlock ? 'Yes' : 'No'}</li>
                  <li>Block Start Page: {blockStats.currentBlockStartPage}</li>
                  <li>Transactions in Block: {blockStats.transactionsInBlock}</li>
                  <li>Pages in Block: {blockStats.pagesInBlock}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-700">Cache Stats</h4>
                <ul className="text-gray-600">
                  <li>Cache Size: {cacheStats.size}/{cacheStats.maxSize}</li>
                  <li>Access Order Length: {cacheStats.accessOrderLength}</li>
                </ul>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700">Current State</h4>
              <ul className="text-gray-600">
                <li>Current Address: {nativeAddressForCurrentSearch || 'None'}</li>
                <li>Current Page: {currentPage}</li>
                <li>Total Transactions: {totalTransactions}</li>
                <li>Has Next Page: {hasNextPage ? 'Yes' : 'No'}</li>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Results Summary */}
      {nativeAddressForCurrentSearch && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
          <p>
            Showing transactions for: <span className="font-mono">{nativeAddressForCurrentSearch}</span>
          </p>
          <p>
            Total transactions: {totalTransactions} | Page {currentPage}
          </p>
        </div>
      )}

      {/* Loading State */}
      {isFetchingTransactions && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading transactions...</span>
        </div>
      )}

      {/* Transactions Table */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Тип
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hash
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    От кого
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Кому
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fee
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <AnimatePresence>
                  {transactions.map((transaction) => {
                    const transactionType = getTransactionType(transaction, nativeAddressForCurrentSearch);
                    return (
                      <motion.tr
                        key={transaction.id} // Use a stable, unique key for each transaction
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(transaction.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {transactionType === 'Входящая транзакция' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <ArrowDownLeft className="mr-1.5 h-4 w-4" />
                              Входящая
                            </span>
                          )}
                          {transactionType === 'Исходящая транзакция' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <ArrowUpRight className="mr-1.5 h-4 w-4" />
                              Исходящая
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                          <a 
                            href={generateReefscanUrl(transaction)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {truncateHash(transaction.hash)}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                          {truncateHash(transaction.from)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                          {truncateHash(transaction.to)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {isNftTransfer(transaction.tokenSymbol)
                            ? 'NFT'
                            : formatAmount(transaction.amount, transaction.tokenDecimals, transaction.tokenSymbol)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatFee(transaction.feeAmount.toString(), transaction.feeTokenSymbol)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              transaction.status === 'Success'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {transaction.status}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {nativeAddressForCurrentSearch && (
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={handleFirstPage}
              disabled={currentPage === 1 || isFetchingTransactions}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1 || isFetchingTransactions}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
          </div>

          <span className="text-sm text-gray-600">
            Page {currentPage}
          </span>

          <div className="flex gap-2">
            <button
              onClick={handleNextPage}
              disabled={!hasNextPage || isFetchingTransactions}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-24">
                    <button
                      onClick={handleLastPage}
                      disabled={!hasNextPage || isFetchingTransactions || isNavigatingToLastPage || !isLastPageNavigable}
                      className="w-full"
                    >
                      {isNavigatingToLastPage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Последняя'
                      )}
                    </button>
                  </div>
                </TooltipTrigger>
                {!isLastPageNavigable && (
                  <TooltipContent>
                    <p>Переход на последнюю страницу отключен для кошельков с очень большим количеством транзакций</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isFetchingTransactions && transactions.length === 0 && nativeAddressForCurrentSearch && (
        <div className="text-center py-12">
          <p className="text-gray-500">No transactions found for this address.</p>
        </div>
      )}
    </div>
  );
}
