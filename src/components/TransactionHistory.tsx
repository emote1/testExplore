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
    from: string;
    to: string;
    timestamp: string; 
    type: string; 
    extrinsicHash?: string; 
    extrinsicId?: string; 
    signer: string; 
    section: string;
    method: string;
    recipient: string;
    amount: string | number;
    status?: string; 
    displayType?: string;
    tokenSymbol?: string; 
    tokenDecimals?: number; 
    signedData?: SignedData; // Добавлено для комиссии
}

// Интерфейсы для signedData
interface SignedDataFee {
  partialFee: string;
}

interface SignedData {
  fee: SignedDataFee;
}
// Вспомогательные функции
const getDisplayType = (type: string, from: string, to: string, currentAddress: string): string => {
  const lowerCurrentAddress = currentAddress.toLowerCase();
  // Сначала проверяем на строгое равенство для входящих и исходящих
  if (to.toLowerCase() === lowerCurrentAddress && from.toLowerCase() !== lowerCurrentAddress) {
    return 'Входящая';
  }
  if (from.toLowerCase() === lowerCurrentAddress && to.toLowerCase() !== lowerCurrentAddress) {
    return 'Исходящая';
  }
  // Если перевод самому себе
  if (from.toLowerCase() === lowerCurrentAddress && to.toLowerCase() === lowerCurrentAddress) {
    return 'Самому себе'; // или 'Исходящая', или 'Входящая' - на ваше усмотрение
  }

  // Если не строго входящая/исходящая, используем маппинг или исходный тип
  const typeMapping: { [key: string]: string } = {
    'NATIVE_TRANSFER': 'Перевод REEF',
    'REEF20_TRANSFER': 'Перевод токена',
    'CONTRACT_CALL': 'Вызов контракта',
    'EVM_EXECUTE': 'EVM Выполнение',
    // Добавьте другие типы по мере необходимости
  };
  return typeMapping[type] || type;
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
    const TRANSACTIONS_PER_PAGE = 12;
    const [apiCursors, setApiCursors] = useState<string[]>([]);
    const [hasNextPageApi, setHasNextPageApi] = useState<boolean>(false);

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
            {
              headers: {
                'Content-Type': 'application/json'
              },
              timeout: 10000, // 10 секунд таймаут для API запросов
            }
          );
          const accountResult = accountResponse.data;

          if (accountResult.errors) {
            throw new Error(`GraphQL error fetching account: ${accountResult.errors.map((e: any) => e.message).join(', ')}`);
          }

          if (accountResult.data?.accounts && accountResult.data.accounts.length > 0) {
            targetAddress = accountResult.data.accounts[0].id;
          } else {
            setLoading(false);
            setError("Не найден нативный аккаунт для указанного EVM адреса.");
            setTransactions([]);
            setTotalTransactions(0);
            setCurrentPage(1);
            return;
          }
        }

        // Шаг 2: Запросить все транзакции (входящие и исходящие) одним запросом
        const gqlQuery = `
          query GetTransactionsData(
            $targetAddress: String!, 
            $first: Int!, 
            $after: String
          ) {
            allTransactionsData: transfersConnection(
              orderBy: timestamp_DESC,
              where: {
                AND: [
                  { success_eq: true },
                  { OR: [
                      { from: { id_eq: $targetAddress } }, 
                      { to: { id_eq: $targetAddress } } 
                    ]
                  }
                ]
              },
              first: $first,
              after: $after
            ) {
              edges {
                node {
                  id timestamp denom amount success extrinsicHash extrinsicId type
                  token { id name }
                  from { id evmAddress }
                  to { id evmAddress }
                  signedData
                } # closes node
              } # closes edges
              pageInfo {
                hasNextPage
                endCursor
              }
              totalCount
            } # closes transfersConnection (allTransactionsData)
          } # closes query ReefHistory
        `;

        const variables = {
          targetAddress: targetAddress, 
          first: TRANSACTIONS_PER_PAGE, // Используем 'first' для connections
          after: apiCursors[pageToFetch - 1] || null, 
        };

        const response = await axios.post(API_URL, {
          query: gqlQuery,
          variables: variables
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000, // 10 секунд таймаут для API запросов
        });

        const result = response.data.data; 

        if (!result || !result.allTransactionsData) {
          setError("Данные не найдены для этого адреса.");
          setTransactions([]);
          setTotalTransactions(0);
          setHasNextPageApi(false); // Сбрасываем hasNextPageApi
          setLoading(false);
          return;
        }

        // Устанавливаем общее количество транзакций из нового запроса
        setTotalTransactions(result.allTransactionsData?.totalCount || 0);

        const pageInfo = result.allTransactionsData?.pageInfo;
        setHasNextPageApi(pageInfo?.hasNextPage || false);

        // Транзакции теперь напрямую в result.allTransactionsData.edges
        // и они уже должны быть отсортированы по timestamp из-за orderBy в запросе
        const fetchedTransactions = result.allTransactionsData?.edges?.map((edge: any) => {
          // Определяем направление транзакции
          const direction = edge.node.from.id.toLowerCase() === targetAddress.toLowerCase() ? 'out' : 'in';
          return { ...edge.node, direction };
        }) || [];

        // Так как API уже сортирует и пагинирует единый список,
        // дополнительная сортировка на клиенте по дате не нужна.
        // Логика удаления дубликатов также не нужна, если API корректно обрабатывает OR.
        
        const processedTransactions: Transaction[] = fetchedTransactions.map((transferNode: any) => {
          const displayType = getDisplayType(transferNode.type, transferNode.from.id, transferNode.to.id, targetAddress.toLowerCase());

          const knownDecimals: { [key: string]: number } = {
            REEF: 18,
            MRD: 18,
          };

          let amountDisplay: string;
          let tokenSymbolDisplay: string = transferNode.denom || transferNode.token?.name || 'Unknown Token';
          let tokenDecimalsValue: number | undefined = knownDecimals[tokenSymbolDisplay.toUpperCase()];

          if (transferNode.amount != null) {
            const rawAmount = BigInt(transferNode.amount);
            if (tokenDecimalsValue !== undefined) {
              const divisor = BigInt(10) ** BigInt(tokenDecimalsValue);
              const integerPart = rawAmount / divisor;
              const fractionalPart = rawAmount % divisor;
              const fractionalString = fractionalPart.toString().padStart(tokenDecimalsValue, '0').substring(0, Math.min(tokenDecimalsValue, 4));
              amountDisplay = `${integerPart}.${fractionalString} ${tokenSymbolDisplay}`;
            } else {
              amountDisplay = `${rawAmount.toString()} ${tokenSymbolDisplay} (raw)`;
              tokenSymbolDisplay = `${tokenSymbolDisplay} (raw)`;
            }
          } else {
            amountDisplay = "N/A";
          }

          let formattedTimestamp = "Неверная дата";
          if (transferNode.timestamp) {
            const tsString = String(transferNode.timestamp).trim();
            const dateObj = new Date(tsString);
            const timeValue = dateObj.getTime();
            const isValidDate = !isNaN(timeValue);
            if (isValidDate) {
              try {
                formattedTimestamp = dateObj.toLocaleString('ru-RU', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
              } catch (e: any) {
                formattedTimestamp = "Ошибка форматирования";
              }
            } else {
              formattedTimestamp = "Неверная дата";
            }
          }

          let parsedSignedDataForTx: SignedData | undefined = undefined;
          if (transferNode.signedData) {
            try {
              const rawSignedData = typeof transferNode.signedData === 'string'
                ? JSON.parse(transferNode.signedData)
                : transferNode.signedData;

              if (rawSignedData && rawSignedData.fee && typeof rawSignedData.fee.partialFee === 'string') {
                parsedSignedDataForTx = { 
                  fee: { 
                    partialFee: rawSignedData.fee.partialFee 
                  } 
                };
              } else if (rawSignedData && typeof rawSignedData.partialFee === 'string') {
                 parsedSignedDataForTx = { fee: { partialFee: rawSignedData.partialFee } };
              } else {
                // console.warn("signedData does not have the expected fee structure:", rawSignedData);
              }
            } catch (e) {
              console.error("Error processing signedData:", e, transferNode.signedData);
            }
          }

          return {
            id: transferNode.id,
            from: transferNode.from.id,
            to: transferNode.to.id,
            timestamp: formattedTimestamp,
            type: transferNode.type,
            extrinsicHash: transferNode.extrinsicHash,
            extrinsicId: transferNode.extrinsicId,
            signer: transferNode.from.id,
            section: 'balances',
            method: 'transfer',
            recipient: transferNode.to.id,
            amount: amountDisplay,
            status: transferNode.success ? 'Успешно' : 'Не удалось',
            displayType: displayType,
            tokenSymbol: tokenSymbolDisplay,
            tokenDecimals: tokenDecimalsValue,
            signedData: parsedSignedDataForTx
          };
        });

        if (processedTransactions.length === 0 && pageToFetch === 1) {
          setError("Транзакции не найдены для этого адреса.");
          setTransactions([]);
        } else {
          setTransactions(processedTransactions);
          // setCurrentPage(pageToFetch); // Устанавливаем текущую страницу
        }

        // Сохраняем курсор для следующей страницы
        if (pageInfo?.hasNextPage && pageInfo.endCursor) {
          setApiCursors(prevCursors => {
            // Обновляем только если значение курсора для этой страницы действительно изменилось
            if (prevCursors[pageToFetch] !== pageInfo.endCursor) {
              const newCursors = [...prevCursors];
              newCursors[pageToFetch] = pageInfo.endCursor;
              return newCursors;
            }
            return prevCursors; // Если курсор не изменился, возвращаем старый массив
          });
        }

      } catch (err: any) {
        console.error('Error fetching transactions:', err);
        const errorMessage = err.response?.data?.errors?.[0]?.message || err.message || 'Неизвестная ошибка';
        setError(`Ошибка при получении транзакций: ${errorMessage}`);
        setTransactions([]); 
        setHasNextPageApi(false); // Сбрасываем hasNextPageApi при ошибке
      } finally {
        setLoading(false);
      }
    }, [address, apiCursors]); 

    const handleNextPage = () => {
      if (hasNextPageApi) { 
        setCurrentPage(prevPage => prevPage + 1);
      }
    };

    const handlePreviousPage = () => {
      setCurrentPage(prevPage => Math.max(1, prevPage - 1));
    };

    useEffect(() => {
      if (address) {
        // При изменении адреса всегда запрашиваем первую страницу
        setApiCursors([]); // Сбрасываем курсоры для нового адреса
        setHasNextPageApi(false); // Сбрасываем hasNextPageApi
        fetchTransactions(1);
      } else {
        // Если адрес очищен, сбрасываем транзакции и пагинацию
        setTransactions([]);
        setTotalTransactions(0);
        setCurrentPage(1);
        setApiCursors([]); // Сбрасываем курсоры
        setHasNextPageApi(false); // Сбрасываем hasNextPageApi
        setError(null); 
      }
    }, [address]); 

    useEffect(() => {
      // console.log('[PAGINATION] useEffect triggered for currentPage change. Current page:', currentPage, 'Total transactions:', totalTransactions);
      if (address) { // Убедимся что адрес есть
        fetchTransactions(currentPage);
      }
    }, [currentPage, address]); 

    // Обработчики для кнопок пагинации

    const sortedTransactions = useMemo(() => {
      let sortableItems = [...transactions];
      if (sortConfig.key !== null) {
        sortableItems.sort((a, b) => {
          if (sortConfig.key === 'amount') {
            const extractNumber = (item: Transaction): number => {
              const amountVal = item.amount;
              if (typeof amountVal === 'number') return amountVal;
              if (typeof amountVal === 'string') {
                const numStrPart = amountVal.split(' ')[0];
                const cleanedNumStr = numStrPart.replace(/[^0-9.-]+/g, ""); // Оставляем цифры, точку, минус
                const parsed = parseFloat(cleanedNumStr);
                return isNaN(parsed) ? 0 : parsed;
              }
              return 0;
            };
            const numA = extractNumber(a);
            const numB = extractNumber(b);

            if (numA < numB) {
              return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (numA > numB) {
              return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
          }

          const aValue = a[sortConfig.key!];
          const bValue = b[sortConfig.key!];

          if (aValue == null && bValue == null) return 0;
          if (aValue == null) return sortConfig.direction === 'asc' ? -1 : 1;
          if (bValue == null) return sortConfig.direction === 'asc' ? 1 : -1;

          if (typeof aValue === 'string' && typeof bValue === 'string') {
            const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
            return sortConfig.direction === 'asc' ? comparison : -comparison;
          }

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
      if (key !== 'timestamp' && key !== 'amount') {
        return; // Ничего не делаем для других столбцов
      }

      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
      }
      setSortConfig({ key, direction });
    }, [sortConfig]); 

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
                    <th
                      onClick={() => handleSort('timestamp')}
                      className="py-3 px-6 text-left cursor-pointer whitespace-nowrap"
                    >
                      Дата {sortConfig.key === 'timestamp' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
                    </th>
                    <th className="py-3 px-6 text-left whitespace-nowrap">
                      Тип
                    </th>
                    <th className="py-3 px-6 text-left whitespace-nowrap">
                      Хеш
                    </th>
                    <th className="py-3 px-6 text-left whitespace-nowrap">
                      От кого
                    </th>
                    <th className="py-3 px-6 text-left whitespace-nowrap">
                      Кому
                    </th>
                    <th
                      onClick={() => handleSort('amount')}
                      className="py-3 px-6 text-right cursor-pointer whitespace-nowrap"
                    >
                      Сумма {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
                    </th>
                    <th className="py-3 px-6 text-right whitespace-nowrap">
                      Комиссия
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
                    {!loading && error && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-red-500">
                          {error}
                        </td>
                      </tr>
                    )}
                    {!loading && sortedTransactions.length > 0 && !error && sortedTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {tx.timestamp} {/* Отображаем уже отформатированную дату */}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                          {tx.type} {/* Отображаем тип транзакции как есть */}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                          {tx.extrinsicHash ? (
                            (() => {
                              let reefscanUrl = '';
                              if (tx.extrinsicId) {
                                const rawParts = tx.extrinsicId.split('-');
                                const cleanedParts = rawParts.map(p => p.replace(/,/g, ''));

                                if (cleanedParts.length === 3) {
                                  const p0 = cleanedParts[0];
                                  const p1 = cleanedParts[1];
                                  const p2 = cleanedParts[2];

                                  const isP0Decimal = /^\d+$/.test(p0);
                                  const isP2Decimal = /^\d+$/.test(p2);
                                  const isP1Hex = /^[0-9a-fA-F]+$/.test(p1); // Check if middle part is hex
                                  const isP1Decimal = /^\d+$/.test(p1);    // Check if middle part is decimal

                                  if (isP0Decimal && isP1Hex && isP2Decimal) {
                                    // Format: BLOCK-HEX-EVENT_IDX (e.g., 0012580519-cf30d-000001)
                                    // Assumed to map to URL: /transfer/BLOCK/1/EVENT_IDX
                                    reefscanUrl = `https://reefscan.com/transfer/${parseInt(p0, 10)}/1/${parseInt(p2, 10)}`;
                                  } else if (isP0Decimal && isP1Decimal && isP2Decimal) {
                                    // Format: BLOCK-DECIMAL_EXT_IDX-EVENT_IDX
                                    reefscanUrl = `https://reefscan.com/transfer/${parseInt(p0, 10)}/${parseInt(p1, 10)}/${parseInt(p2, 10)}`;
                                  }
                                } else if (cleanedParts.length === 2) {
                                  const p0 = cleanedParts[0];
                                  const p1 = cleanedParts[1];
                                  if (/^\d+$/.test(p0) && /^\d+$/.test(p1)) {
                                    // Format: BLOCK-DECIMAL_EXT_IDX
                                    // Assumed to map to URL: /transfer/BLOCK/DECIMAL_EXT_IDX/1
                                    reefscanUrl = `https://reefscan.com/transfer/${parseInt(p0, 10)}/${parseInt(p1, 10)}/1`;
                                  }
                                }
                              }
                              
                              if (!reefscanUrl && tx.extrinsicHash) { // Fallback to extrinsicHash
                                let cleanHash = tx.extrinsicHash;
                                // Проверяем и очищаем хеш, если он длиннее стандартного или содержит лишнее
                                if (cleanHash.startsWith('0x') && cleanHash.length > 66) {
                                  const potentialHashPart = cleanHash.substring(0, 66);
                                  if (/^0x[0-9a-fA-F]{64}$/.test(potentialHashPart)) {
                                    cleanHash = potentialHashPart;
                                  }
                                }
                                reefscanUrl = `https://reefscan.com/extrinsic/${cleanHash}`;
                              }

                              if (reefscanUrl) {
                                return (
                                  <a
                                    href={reefscanUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:text-indigo-900 hover:underline"
                                    title={tx.extrinsicHash} // Tooltip остается полным хешем
                                  >
                                    {`${tx.extrinsicHash.substring(0, 6)}...${tx.extrinsicHash.substring(tx.extrinsicHash.length - 4)}`}
                                  </a>
                                );
                              } else {
                                // Если по какой-то причине URL не сформирован, показываем текст
                                return <span title={tx.extrinsicHash}>{`${tx.extrinsicHash.substring(0, 6)}...${tx.extrinsicHash.substring(tx.extrinsicHash.length - 4)}`}</span>;
                              }
                            })()
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700" title={tx.signer}>
                          {tx.signer ? `${tx.signer.substring(0, 6)}...${tx.signer.substring(tx.signer.length - 4)}` : 'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700" title={tx.recipient}>
                          {tx.recipient ? `${tx.recipient.substring(0, 6)}...${tx.recipient.substring(tx.recipient.length - 4)}` : 'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-right">
                          {tx.amount != null ? String(tx.amount) : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-right">
                          {
                            tx.signedData?.fee?.partialFee ? 
                            `${(Number(BigInt(tx.signedData.fee.partialFee)) / 1e18).toFixed(4)} REEF` : 
                            '-'
                          }
                        </td>
                      </tr>
                    ))}
                  </motion.tbody>
                </AnimatePresence>
              </table>
            </div>
          )}

          {/* Элементы управления пагинацией */}
          {totalTransactions > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1 || loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Назад
              </button>
              <span className="text-sm text-gray-700">
                Страница {currentPage} из {Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE)}
              </span>
              <button
                onClick={handleNextPage}
                disabled={
                  loading ||
                  (totalTransactions > 0 && currentPage * TRANSACTIONS_PER_PAGE >= totalTransactions)
                }
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
