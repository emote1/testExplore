import React, { useState, useMemo, useCallback } from 'react';
import axios from 'axios';

// ... (остальные импорты и константы, если есть)

// Пример интерфейса для транзакции (адаптируйте под ваши реальные данные)
interface Transaction {
    id: string;
    hash: string;
    signer?: string; // Может быть undefined, если не получен
    section: string;
    method: string;
    timestamp: string; // Используем строку для простоты, потом можно Date
    status?: string; // Добавим статус
    // Добавьте другие поля, если они есть (например, сумма, получатель)
    recipient?: string;
    amount?: string | number;
}

// Определим интерфейс для сырых данных, получаемых из API
interface RawExtrinsicData {
  id: string;
  hash: string;
  signer: string;
  status: string; // Используем status из рабочего примера
  section: string;
  method: string;
  args?: any;
  // Другие возможные поля из GraphQL...
}

// Вспомогательная функция для проверки формата EVM-адреса с помощью Regex
const isValidEvmAddressFormat = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

const TransactionHistory: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [address, setAddress] = useState<string>(''); // Состояние для адреса
    type SortConfig = { key: keyof Transaction | null; direction: 'asc' | 'desc' };
const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
    // const [tab, setTab] = useState<number>(0); // Состояние вкладок, если нужно

    const fetchTransactions = useCallback(async () => {
      if (!address) {
        setError("Пожалуйста, введите адрес Reef.");
        setTransactions([]);
        return;
      }
      setLoading(true);
      setError(null);
      setTransactions([]);

      let targetAddress = address; // Адрес для запроса

      try {
        // Шаг 1: Если введен EVM адрес, получить нативный ID
        if (isValidEvmAddressFormat(address)) {
          console.log(`Input is EVM address: ${address}. Fetching native ID...`);
          const accountQuery = `
            query GetAccountByEvm($evmAddress: String!) {
              accounts(where: { evmAddress_eq: $evmAddress }, limit: 1) {
                id # Нативный адрес
              }
            }
          `;
          // Используем axios для единообразия
          const accountResponse = await axios.post(
            'https://squid.subsquid.io/reef-explorer/graphql',
            {
              query: accountQuery,
              variables: { evmAddress: address }
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
            setLoading(false); // Завершаем загрузку
            setError("Не найден нативный адрес Reef, связанный с этим EVM-адресом.");
            return; // Выходим, транзакций не будет
          }
        } else {
          console.log(`Input is assumed to be native address: ${address}`);
          // targetAddress уже равен address
        }

        // Шаг 2: Если есть адрес (нативный или исходный), запросить extrinsics
        const extrinsicsQuery = `
            query GetExtrinsics($signerAddress: String!) {
              extrinsics(
                limit: 20 # Оставим 20, как было
                orderBy: id_DESC # Используем id_DESC из рабочего примера
                where: { signer_eq: $signerAddress }
              ) {
                id
                hash
                signer
                status # Используем status
                section
                method
                args
              }
            }
          `;

        const extrinsicsResponse = await axios.post(
            'https://squid.subsquid.io/reef-explorer/graphql',
            {
                query: extrinsicsQuery,
                variables: { signerAddress: targetAddress } // Используем найденный/исходный адрес
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        const extrinsicsResult = extrinsicsResponse.data;
        console.log('Subsquid extrinsics response:', extrinsicsResult);

        if (extrinsicsResult.errors) {
            console.error('GraphQL Errors fetching extrinsics:', extrinsicsResult.errors);
            throw new Error(`GraphQL error fetching extrinsics: ${extrinsicsResult.errors.map((e: any) => e.message).join(', ')}`);
        }

        if (!extrinsicsResult.data || !extrinsicsResult.data.extrinsics) {
            console.log('No extrinsics data found in response for address:', targetAddress);
            setError("Транзакции не найдены для этого адреса.");
            // Оставляем transactions пустым
        } else {
            // Обработка полученных extrinsics (взята из рабочего примера с адаптацией)
            const processedTransactions: Transaction[] = extrinsicsResult.data.extrinsics.map((extrinsic: RawExtrinsicData) => {
                let amount: string | number | undefined = undefined;
                let recipient: string | undefined = undefined;
                let displayMethod = extrinsic.method; // Используем метод как есть по умолчанию

                const sectionLower = extrinsic.section.toLowerCase();
                const methodLower = extrinsic.method.toLowerCase();

                 // Обработка для transfer/transferKeepAlive из balances
                 if (sectionLower === 'balances' && (methodLower === 'transferkeepalive' || methodLower === 'transfer')) {
                  try {
                    const argsParsed = typeof extrinsic.args === 'string' ? JSON.parse(extrinsic.args) : extrinsic.args;
                    // В Subsquid структура args может отличаться, проверяем типичные поля
                    const destArg = argsParsed?.dest?.value || argsParsed?.to?.value || (Array.isArray(argsParsed) && argsParsed[0]?.value);
                    const valueArg = argsParsed?.value || (Array.isArray(argsParsed) && argsParsed[1]);

                    recipient = destArg;

                    if (valueArg) {
                        try {
                           const rawAmount = BigInt(String(valueArg)); // Преобразуем в строку на всякий случай
                           amount = Number(rawAmount) / 1e18; // Просто число без ' REEF'
                           // Можно добавить форматирование
                           amount = parseFloat(amount.toFixed(4));
                       } catch (e) {
                           console.warn(`Could not parse amount from args: ${valueArg}`, e);
                           amount = 'Invalid Amount';
                       }
                    }
                    // Улучшаем отображение метода
                    displayMethod = extrinsic.signer === targetAddress ? 'Отправка' : 'Получение';

                  } catch (parseError) {
                    console.warn('Could not parse args for transfer:', extrinsic.args, parseError);
                  }
              }
              // Добавьте здесь обработку других секций/методов, если нужно (staking, vesting и т.д.)

                 return {
                     id: extrinsic.id,
                     hash: extrinsic.hash,
                     signer: extrinsic.signer,
                     status: extrinsic.status === 'success' ? 'Успешно' : 'Ошибка', // Преобразуем статус
                     section: extrinsic.section,
                     method: displayMethod,
                     timestamp: extrinsic.id.split('-')[0], // Используем блок из ID как timestamp?
                     recipient: recipient,
                     amount: amount,
                 };
            });
            console.log('Processed extrinsics:', processedTransactions);
            setTransactions(processedTransactions);
             if (processedTransactions.length === 0) {
                 setError("Транзакции не найдены для этого адреса (но данные получены).");
             }
        }
    } catch (err: any) {
        console.error('Error fetching transactions:', err);
        // Улучшаем сообщение об ошибке
        const errorMessage = err.response?.data?.errors?.[0]?.message || err.message || 'Неизвестная ошибка';
        setError(`Ошибка при получении транзакций: ${errorMessage}`);
        setTransactions([]); // Убедимся, что массив пуст при ошибке
    } finally {
        setLoading(false);
    }
}, [address]);

    // Мемоизация отсортированного массива транзакций
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
    }, [sortConfig]); // Зависимость от sortConfig

     // Функция форматирования времени (можно улучшить)
     const formatTimestamp = (timestamp: string): string => {
         try {
            const date = new Date(timestamp);
             // Проверка на валидность даты
             if (isNaN(date.getTime())) {
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
             return timestamp; // Возвращаем исходную строку в случае ошибки
         }
     };

    return (
        // Внешний div: теперь без собственного фона (будет виден фон страницы), полноэкранный, вертикально центрирует
        <div className="min-h-screen w-full flex flex-col justify-center">
            {/* Внутренний контейнер: белый, полноэкранный, с отступами, тенью и скруглениями */}
            <div 
                className="w-full p-4 md:p-6 bg-white rounded-lg shadow-xl" 
            >
                <h2 className="text-2xl font-bold mb-4 text-center">История транзакций Reef</h2> {/* Центрированный заголовок */}
                <div className="mb-4 flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-2"> {/* Центрирование инпута и кнопки */} 
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
                         onClick={fetchTransactions}
                         disabled={loading || !address} // Блокируем, если идет загрузка или адрес пуст
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

                 {/* Отображение ошибки */}
                 {error && !loading && (
                     <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-center">
                         Ошибка: {error}
                     </div>
                 )}

                {/* Таблица транзакций */}
                <div className="overflow-x-auto bg-white rounded-lg shadow">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                 {/* Заголовки таблицы с сортировкой */}
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('hash')}>
                                    Хеш {sortConfig.key === 'hash' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('method')}>
                                    Тип {sortConfig.key === 'method' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                 {/* Добавим колонку Сумма */}
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('amount')}>
                                    Сумма {sortConfig.key === 'amount' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('timestamp')}>
                                    Время {sortConfig.key === 'timestamp' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('status')}>
                                    Статус {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                 {/* Можно добавить другие колонки: Отправитель, Получатель */}
                                 {/*
                                 <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('signer')}>
                                     Отправитель {sortConfig.key === 'signer' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                 </th>
                                 <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('recipient')}>
                                     Получатель {sortConfig.key === 'recipient' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                 </th>
                                 */}
                            </tr>
                        </thead>
                         <tbody className="bg-white divide-y divide-gray-200">
                            {/* Сообщение во время загрузки */}
                            {loading && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">Загрузка транзакций...</td>
                                </tr>
                            )}
                             {/* Сообщение, если нет транзакций и не идет загрузка */}
                            {!loading && sortedTransactions.length === 0 && !error && address && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">Транзакции не найдены для этого адреса.</td>
                                </tr>
                            )}
                             {/* Сообщение, если адрес не введен */}
                             {!loading && !address && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">Введите адрес Reef для поиска транзакций.</td>
                                </tr>
                             )}

                            {/* Рендеринг строк таблицы */}
                            {!loading && sortedTransactions.length > 0 && sortedTransactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-gray-50 transition-colors duration-150">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline">
                                         {/* Ссылка на Reefscan или обрезка хеша */}
                                         <a href={`https://reefscan.com/extrinsic/${tx.hash}`} target="_blank" rel="noopener noreferrer" title={tx.hash}>
                                             {tx.hash.substring(0, 6)}...{tx.hash.substring(tx.hash.length - 4)}
                                         </a>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{tx.method}</td>
                                     {/* Отображаем сумму */}
                                     <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                         {tx.amount != null ? String(tx.amount) : '-'} {/* Используем != null для проверки и на null, и на undefined */}
                                     </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{formatTimestamp(tx.timestamp)}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            tx.status === 'Успешно' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {tx.status}
                                        </span>
                                    </td>
                                    {/*
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{tx.signer ? `${tx.signer.substring(0, 6)}...` : '-'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{tx.recipient ? `${tx.recipient.substring(0, 6)}...` : '-'}</td>
                                    */}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TransactionHistory;
