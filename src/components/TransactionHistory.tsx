import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTimestamp, shortenHash } from '../utils/formatters';
import { generateReefscanUrl } from '../utils/reefscan-helpers';

import { useTransactionData } from '../hooks/use-transaction-data';
import { Transaction } from '../types/transaction-types'; // Только Transaction, остальное в хуке
import { PAGINATION_CONFIG } from '../constants/pagination';

const TransactionHistory: React.FC = () => {
    const {
        userInputAddress,
        currentSearchAddress,
        transactions, // This will be sortedTransactions from the hook
        error,
        sortConfig,
        currentPage,
        totalTransactions,
        hasNextPage,
        handleSort,
        handleNextPage,
        handlePreviousPage,
        handleFirstPage,
        handleLastPage,
        setUserInputAddress,
        handleAddressSubmit, // Corrected name
        isFetchingTransactions,
        isNavigatingToLastPage,
        isResolvingAddress // Added for completeness, though not used in current JSX
    } = useTransactionData();

    const isLoading = isFetchingTransactions || isNavigatingToLastPage || isResolvingAddress;
    const actualTotalPages = totalTransactions > 0 ? Math.ceil(totalTransactions / PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE) : 0;

    // Функция для форматирования суммы с токеном
    const formatAmountWithToken = (amount: string | number, tokenSymbol?: string): string => {
      const token = tokenSymbol || 'REEF';
      return `${amount} ${token}`;
    };



    return (
      // Внешний div: теперь без собственного фона (будет виден фон страницы), полноэкранный, вертикально центрирует
      <div className="min-h-screen flex flex-col items-center justify-start pt-12 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-800 text-white font-sans">
        {/* Контейнер для основного контента, с отступами и максимальной шириной */}
        <div className="container mx-auto p-4 md:p-8 max-w-6xl w-full">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
              История транзакций Reef Chain
            </h1>
          </motion.div>

          {/* Форма для ввода адреса */}
          <motion.form 
            onSubmit={(e) => { e.preventDefault(); handleAddressSubmit(userInputAddress); }} // Используем handleAddressSubmit из хука
            className="mb-8 p-6 bg-white/10 backdrop-blur-md rounded-xl shadow-2xl flex flex-col sm:flex-row items-center gap-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <input
              type="text"
              value={userInputAddress} // Используем userInputAddress из хука
              onChange={(e) => setUserInputAddress(e.target.value)}
              placeholder="Введите адрес Reef (нативный или EVM)"
              className="flex-grow p-3 border-2 border-purple-500 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all duration-300 shadow-md"
            />
            <button 
              type="submit" 
              disabled={isLoading} 
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Загрузка...
                </>
              ) : 'Поиск'}
            </button>
          </motion.form>

          {error && (
            <motion.div 
              className="mb-6 p-4 bg-red-500/20 border border-red-700 text-red-300 rounded-lg shadow-md"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {error}
            </motion.div>
          )}

          {/* Сообщение "Нет транзакций для адреса" */} 
          {currentSearchAddress && !isLoading && !error && transactions.length === 0 && totalTransactions === 0 && (
            <motion.div 
              className="mb-6 p-4 bg-blue-500/20 border border-blue-700 text-blue-300 rounded-lg shadow-md text-center"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              Для указанного адреса транзакции не найдены.
            </motion.div>
          )}

          {/* Сообщение "Введите адрес для поиска" - если currentSearchAddress пуст и не было ошибки */} 
          {!currentSearchAddress && !isLoading && !error && (
            <motion.div
              className="mb-6 p-4 bg-gray-700/30 border border-gray-600 text-gray-400 rounded-lg shadow-md text-center"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              Введите адрес Reef для просмотра истории транзакций.
            </motion.div>
          )}

          {/* Таблица транзакций */} 
          {currentSearchAddress && !isLoading && !error && transactions.length > 0 && (
            <motion.div 
              className="overflow-x-auto bg-white/5 backdrop-blur-sm rounded-xl shadow-2xl"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800/50 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-white/20" onClick={() => handleSort('timestamp')}>Дата {sortConfig?.key === 'timestamp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Хэш</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">От кого</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Кому</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-white/20" onClick={() => handleSort('amount')}>Сумма {sortConfig?.key === 'amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Комиссия</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-white/20" onClick={() => handleSort('status')}>Статус {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800/30 divide-y divide-gray-700/50">
                  <AnimatePresence>
                    {transactions.length > 0 ? transactions.map((tx: Transaction, index: number) => (
                      <motion.tr
                        key={tx.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.02 }}
                        className="hover:bg-purple-800/30"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-sm">{formatTimestamp(tx.timestamp)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-pink-400 text-sm">
                          <a href={generateReefscanUrl(tx) ?? undefined} target="_blank" rel="noopener noreferrer" className="hover:underline" title={tx.extrinsicHash ?? tx.extrinsicId ?? undefined}>
                            {shortenHash(tx.extrinsicHash || tx.extrinsicId || 'N/A')}
                          </a>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-sm" title={tx.from}>{shortenHash(tx.from)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-sm" title={tx.to}>{shortenHash(tx.to)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-sm">
                          {formatAmountWithToken(tx.amount, tx.tokenSymbol)}
                          {tx.tokenDecimals === undefined && tx.tokenSymbol && <span className="text-yellow-400 text-xs ml-1">(Raw)</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-300">
                          {tx.feeAmount ? `${tx.feeAmount.toFixed(4)} ${tx.feeTokenSymbol || 'REEF'}` : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                           <span className={`px-2 py-1 text-xs font-semibold rounded-full ${tx.status === 'Success' ? 'bg-green-500/30 text-green-200' : 'bg-red-500/30 text-red-200'}`}>
                            {tx.status}
                          </span>
                        </td>
                      </motion.tr>
                    )) : (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-gray-400">
                          Транзакции не найдены или адрес не указан.
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </motion.div>
          )}

          {/* Сообщение о загрузке */} 
          {currentSearchAddress && !isLoading && !error && transactions.length === 0 && (
             <motion.div 
              className="text-center py-10 text-gray-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Загрузка транзакций...
            </motion.div>
          )}

          {/* Пагинация */} 
          {totalTransactions > 0 && (
            <motion.div 
              className="mt-8 flex justify-between items-center text-sm text-gray-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="flex gap-2">
                <button 
                  onClick={handleFirstPage} 
                  disabled={currentPage === 1 || isLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                  title="Перейти на первую страницу"
                >
                  ⏮️ Первая
                </button>
                <button 
                  onClick={handlePreviousPage} 
                  disabled={currentPage === 1 || isLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                  title="Предыдущая страница"
                >
                  ⬅️ Назад
                </button>
              </div>
              
              <span className="font-medium">
                Страница {currentPage} из {actualTotalPages}
              </span>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleNextPage} 
                  disabled={!hasNextPage || isLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                  title="Следующая страница"
                >
                  Вперед ➡️
                </button>
                <button 
                  onClick={handleLastPage} 
                  disabled={!hasNextPage || isLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                  title="Перейти на последнюю страницу"
                >
                  Последняя ⏭️
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  };
  
  export default TransactionHistory;
