import React, { useState, useMemo, useCallback, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion'; 

// Вспомогательная функция для проверки формата EVM-адреса с помощью Regex
const isValidEvmAddressFormat = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Пример интерфейса для транзакции (адаптируйте под ваши реальные данные)
interface Transaction {
    id: string;
    hash?: string; 
    signer?: string; 
    section: string;
    method: string;
    timestamp: string; 
    status?: string; 
    recipient?: string;
    amount?: string | number;
    displayType?: string;
}

// Вспомогательные функции
const getDisplayType = (transfer: any, viewingAddress: string): string => {
  if (transfer.from?.id?.toLowerCase() === viewingAddress.toLowerCase() && transfer.to?.id?.toLowerCase() === viewingAddress.toLowerCase()) {
    return 'На себя'; 
  } else if (transfer.from?.id?.toLowerCase() === viewingAddress.toLowerCase()) {
    return 'Исходящая';
  } else if (transfer.to?.id?.toLowerCase() === viewingAddress.toLowerCase()) {
    return 'Входящая';
  } 
  return 'Неизвестно';
};

const getRecipient = (transfer: any, viewingAddress: string, displayType: string ): string => {
  if (displayType === 'Исходящая') {
    return transfer.to?.id || 'N/A';
  } else if (displayType === 'Входящая') {
    return transfer.from?.id || 'N/A';
  } else if (displayType === 'На себя') {
    return viewingAddress; 
  }
  return 'N/A';
};

const TransactionHistory: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const API_URL = 'https://squid.subsquid.io/reef-explorer/graphql'; 
    const [address, setAddress] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    type SortConfig = { key: keyof Transaction | null; direction: 'asc' | 'desc' };
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });

    // Состояния для пагинации
    const [totalTransactions, setTotalTransactions] = useState<number>(0);
    const TRANSACTIONS_PER_PAGE = 10;

    const fetchTransactions = useCallback(async (pageToFetch: number = 1) => {
      if (!address) {
        setError("Пожалуйста, введите адрес Reef.");
        setTransactions([]);
        setTotalTransactions(0);
        setCurrentPage(1);
        return;
      }
      setLoading(true);
      setError(null);
      // Не очищаем транзакции сразу, чтобы избежать мигания, если пользователь быстро кликает
      // setTransactions([]); 

      let targetAddress = address; 

      try {
        // Шаг 1: Если введен EVM адрес, получить нативный ID
        if (isValidEvmAddressFormat(address)) {
          console.log(`Input is EVM address: ${address}. Fetching native ID...`);
          const accountQuery = `
            query GetAccountByEvm($evmAddress: String!) {
              accounts(where: { evmAddress_eq: $evmAddress }, limit: 1) {
                id 
              }
            }
          `;
          const accountResponse = await axios.post(
            API_URL,
            {
              query: accountQuery,
              variables: { evmAddress: address.toLowerCase() } 
            },
            { headers: { 'Content-Type': 'application/json' } }
          );
          const accountResult = accountResponse.data;

          if (accountResult.errors) {
            console.error('GraphQL Errors fetching account:', accountResult.errors);
            throw new Error(`GraphQL error fetching account: ${accountResult.errors.map((e: any) => e.message).join(', ')}`);
          }

          if (accountResult.data?.accounts && accountResult.data.accounts.length > 0) {
            targetAddress = accountResult.data.accounts[0].id;
            console.log(`Native address found: ${targetAddress}`);
          } else {
            console.log(`No native account found linked to EVM address: ${address}`);
            setLoading(false);
            setError("Не найден нативный аккаунт для указанного EVM адреса.");
            setTransactions([]);
            setTotalTransactions(0);
            setCurrentPage(1);
            return;
          }
        }

        // Шаг 2: Запросить данные по транзакциям (входящие и исходящие раздельно)
        const gqlQuery = `
          query GetTransactionsData($targetAddress: String!, $limit: Int!, $offset: Int!) {
            fromCount: transfersConnection(
              orderBy: timestamp_DESC,
              where: { from: { id_eq: $targetAddress }, success_eq: true }
            ) {
              totalCount
            }
            toCount: transfersConnection(
              orderBy: timestamp_DESC,
              where: { to: { id_eq: $targetAddress }, success_eq: true }
            ) {
              totalCount
            }
            outgoingTransfers: transfers(
              orderBy: timestamp_DESC,
              where: { from: { id_eq: $targetAddress }, success_eq: true },
              limit: $limit,
              offset: $offset
            ) {
              id timestamp denom amount success extrinsicHash token { id name } from { id evmAddress } to { id evmAddress }
            }
            incomingTransfers: transfers(
              orderBy: timestamp_DESC,
              where: { to: { id_eq: $targetAddress }, success_eq: true },
              limit: $limit,
              offset: $offset
            ) {
              id timestamp denom amount success extrinsicHash token { id name } from { id evmAddress } to { id evmAddress }
            }
          }
        `;

        const variables = {
          targetAddress: targetAddress, // Используем нативный адрес
          limit: TRANSACTIONS_PER_PAGE, 
          offset: (pageToFetch - 1) * TRANSACTIONS_PER_PAGE
        };

        const response = await axios.post(API_URL, {
          query: gqlQuery,
          variables: variables
        });

        const result = response.data;

        if (result.errors) {
          console.error('GraphQL Errors:', result.errors);
          throw new Error(`GraphQL error: ${result.errors.map((e: any) => e.message).join(', ')}`);
        }

        if (!result.data) {
          console.log('No data found in response for address:', targetAddress);
          setError("Данные не найдены для этого адреса.");
          setTransactions([]);
          setTotalTransactions(0);
          return;
        }

        const fromTotal = result.data.fromCount?.totalCount || 0;
        const toTotal = result.data.toCount?.totalCount || 0;
        setTotalTransactions(fromTotal + toTotal); // Это может быть больше реального из-за дубликатов, но для пагинации сойдет

        const outgoing = result.data.outgoingTransfers || [];
        const incoming = result.data.incomingTransfers || [];

        // Объединяем, удаляем дубликаты и сортируем
        const combinedTransfers: any[] = [];
        const seenIds = new Set();

        [...outgoing, ...incoming].forEach(transfer => {
          if (!seenIds.has(transfer.id)) {
            combinedTransfers.push(transfer);
            seenIds.add(transfer.id);
          }
        });

        combinedTransfers.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        // Обрабатываем транзакции для отображения
        const processedTransactions: Transaction[] = combinedTransfers.map((transfer: any) => {
          console.log('Denom:', transfer.denom, 'Token Obj:', transfer.token, 'Amount:', transfer.amount);
          const displayType = getDisplayType(transfer, targetAddress.toLowerCase());
          const recipient = getRecipient(transfer, targetAddress.toLowerCase(), displayType);
          let amountReef: string | number = '-';

          const tokenSymbol = transfer.denom ? transfer.denom.toUpperCase() : '';

          const knownDecimals: { [key: string]: number } = {
            'REEF': 18,
            'MRD': 18
          };

          if (tokenSymbol && transfer.amount && knownDecimals[tokenSymbol] !== undefined) {
             try {
               const rawAmount = BigInt(transfer.amount);
               const decimals = knownDecimals[tokenSymbol];
               const divisor = BigInt(10**decimals);
               const value = Number(rawAmount / divisor) + Number(rawAmount % divisor) / (10**decimals); // Более точное деление для UI
               amountReef = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: (decimals > 0 ? Math.min(decimals, 6) : 2) }) + ' ' + tokenSymbol; // Показываем до 6 знаков или сколько есть, если меньше
             } catch (e) {
                console.warn(`Could not parse ${tokenSymbol} amount: ${transfer.amount}`, e);
                amountReef = 'Ошибка суммы';
             }
          } else if (tokenSymbol && transfer.amount) { // Токен есть в denom, но decimals неизвестны
            amountReef = `${transfer.amount} ${tokenSymbol} (сырое значение - неизв. децимал)`;
           } else if (transfer.amount) {
             // Общий случай, если не REEF и нет информации о токене, но есть сумма
             amountReef = `${transfer.amount} (неизв. единицы)`;
           }

          return {
            id: transfer.id,
            hash: transfer.extrinsicHash,
            timestamp: transfer.timestamp,
            status: transfer.success ? 'Успешно' : 'Ошибка',
            method: 'Перевод', // Общий метод для transfer, displayType уточнит
            section: 'balances', // Предполагаем, что это всегда balances для transfers
            amount: amountReef,
            displayType: displayType,
            recipient: recipient,
            signer: transfer.from?.id // Добавляем отправителя
          };
        });

        if (processedTransactions.length === 0 && pageToFetch === 1) {
          setError("Транзакции не найдены для этого адреса.");
          setTransactions([]);
        } else {
          setTransactions(processedTransactions);
          // setCurrentPage(pageToFetch); // Устанавливаем текущую страницу
        }

      } catch (err: any) {
        console.error('Error fetching transactions:', err);
        // Улучшаем сообщение об ошибке
        const errorMessage = err.response?.data?.errors?.[0]?.message || err.message || 'Неизвестная ошибка';
        setError(`Ошибка при получении транзакций: ${errorMessage}`);
        setTransactions([]); 
      } finally {
        setLoading(false);
      }
    }, [address]);

    useEffect(() => {
      if (address) {
        // При изменении адреса всегда запрашиваем первую страницу
        fetchTransactions(1);
      } else {
        // Если адрес очищен, сбрасываем транзакции и пагинацию
        setTransactions([]);
        setTotalTransactions(0);
        setCurrentPage(1);
        setError(null); 
      }
    }, [address, fetchTransactions]); 

    // Вычисляемое значение для общего количества страниц
    const totalPages = Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE);

    // Обработчики для кнопок пагинации
    const handlePreviousPage = () => {
      if (currentPage > 1) {
        fetchTransactions(currentPage - 1);
      }
    };

    const handleNextPage = () => {
      if (currentPage < totalPages) {
        fetchTransactions(currentPage + 1);
      }
    };

    const sortedTransactions = useMemo(() => {
      let sortableItems = [...transactions];
      if (sortConfig.key !== null) {
        sortableItems.sort((a, b) => {
          const aValue = a[sortConfig.key!];
          const bValue = b[sortConfig.key!];

          // Обработка null/undefined или других типов данных при сортировке
          if (aValue == null && bValue == null) return 0;
          if (aValue == null) return sortConfig.direction === 'asc' ? -1 : 1;
          if (bValue == null) return sortConfig.direction === 'asc' ? 1 : -1;

          // Сравнение строк (case-insensitive)
          if (typeof aValue === 'string' && typeof bValue === 'string') {
            const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
            return sortConfig.direction === 'asc' ? comparison : -comparison;
          }

          // Сравнение чисел или дат (если timestamp - Date)
          if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        });
      }
      return sortableItems;
    }, [transactions, sortConfig]);

    // Функция для обработки клика по заголовку и обновления сортировки
    const handleSort = useCallback((key: keyof Transaction) => {
      let direction: 'asc' | 'desc' = 'asc';
      // Если кликнули по той же колонке, меняем направление
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
      }
      setSortConfig({ key, direction });
    }, [sortConfig]); 

    // Функция форматирования времени (можно улучшить)
    const formatTimestamp = (timestamp: string): string => {
      try {
        const date = new Date(timestamp);
        // Проверка на валидность даты
        if (isNaN(date.getTime())) {
          console.error("Invalid date from timestamp in formatTimestamp:", timestamp); 
          return 'Неверная дата';
        }
        // Можно использовать библиотеки типа date-fns или moment для лучшего форматирования
        return date.toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        console.error("Error formatting date:", e, timestamp);
        return timestamp; 
      }
    };

    return (
      // Внешний div: теперь без собственного фона (будет виден фон страницы), полноэкранный, вертикально центрирует
      <div className="min-h-screen w-full flex flex-col justify-center">
        {/* Внутренний контейнер: белый, 70% ширины экрана, центрирован, с отступами, тенью и скруглениями */}
        <div 
          className="w-[70%] mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl" 
        >
          <h2 className="text-2xl font-bold mb-4 text-center">История транзакций Reef</h2> 
          <div className="mb-4 flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-2"> 
            {/* Поиск по адресу */}
            <div className="flex-grow min-w-[250px]">
              <label htmlFor="address-search" className="sr-only">Поиск по адресу Reef</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {/* Иконка поиска (можно использовать SVG или библиотеку иконок) */}
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="address-search"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Введите адрес Reef для поиска"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Кнопка поиска */}
            <button
              onClick={() => fetchTransactions()} 
              disabled={loading || !address} 
              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                loading || !address ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }`}
            >
              {loading ? 'Загрузка...' : 'Показать'}
            </button>

            {/* Заглушки для фильтров */}
            {/* TODO: Заменить на реальные dropdown компоненты */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Фильтры:</span>
              <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50">Токен</button>
              <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50">Тип транзакции</button>
              <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50">Статус</button>
            </div>
          </div>

          {/* Блок для графика Активности */}
          {/* TODO: Добавить реальный график */}
          <div className="mb-6 p-4 bg-gray-800 text-white rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-3 text-center">Активность</h2>
            <div className="h-60 flex items-center justify-center text-gray-400">
              [Здесь будет график активности]
            </div>
          </div>

          {/* Область для отображения таблицы транзакций, ошибок или загрузки */}
          
          {/* Глобальная ошибка отображается над таблицей */}
          <AnimatePresence mode="wait">
            {!loading && error && (
              <motion.div
                key="error-message-global"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
                className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-center"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Таблица (thead статичен, tbody анимируется) */}
          {/* Показываем таблицу, если нет глобальной ошибки или если идет первоначальная загрузка (когда еще нет ошибки) */}
          {(!error || (loading && !transactions.length && !error) ) && (
            <div className="overflow-x-auto table-container"> 
              <table className="min-w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" style={{ width: '30%' }} onClick={() => handleSort('hash')}>
                      Хеш {sortConfig.key === 'hash' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" style={{ width: '20%' }} onClick={() => handleSort('method')}>
                      Тип {sortConfig.key === 'method' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" style={{ width: '15%' }} onClick={() => handleSort('amount')}>
                      Сумма {sortConfig.key === 'amount' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" style={{ width: '25%' }} onClick={() => handleSort('timestamp')}>
                      Время {sortConfig.key === 'timestamp' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" style={{ width: '10%' }} onClick={() => handleSort('status')}>
                      Статус {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" style={{ width: '10%' }} onClick={() => handleSort('displayType')}>
                      Тип операции {sortConfig.key === 'displayType' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" style={{ width: '15%' }} onClick={() => handleSort('recipient')}>
                      Кому/От кого {sortConfig.key === 'recipient' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                  </tr>
                </thead>
                <AnimatePresence mode="wait">
                  <motion.tbody
                    key={currentPage + (loading ? '_loading' : '_data')} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }} 
                    className="bg-white divide-y divide-gray-200"
                  >
                    {loading && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                          Загрузка транзакций...
                        </td>
                      </tr>
                    )}
                    {!loading && transactions.length === 0 && !error && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                          Транзакции не найдены для этого адреса на текущей странице.
                        </td>
                      </tr>
                    )}
                    {!loading && sortedTransactions.length > 0 && !error && sortedTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <div className="text-gray-900 truncate w-32" title={tx.hash}>
                            {(typeof tx.hash === 'string' && tx.hash.length > 0) ? `${tx.hash.substring(0, 6)}...${tx.hash.substring(tx.hash.length - 4)}` : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{tx.method}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {tx.amount != null ? String(tx.amount) : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTimestamp(tx.timestamp)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            tx.status === 'Успешно' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{tx.displayType}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{tx.recipient || '-'}</td>
                      </tr>
                    ))}
                  </motion.tbody>
                </AnimatePresence>
              </table>
            </div>
          )}

          {/* Элементы управления пагинацией */}
          {totalTransactions > 0 && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1 || loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Назад
              </button>
              <span className="text-sm text-gray-700">
                Страница {currentPage} из {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages || loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Вперед
              </button>
            </div>
          )}
        </div>
      </div>
    );
};

export default TransactionHistory;
