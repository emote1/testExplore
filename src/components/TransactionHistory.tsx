import React, { useState } from 'react';

// Типизация для extrinsics из Subsquid (расширенная)
interface Transaction {
  id: string;
  hash: string;
  signer: string;
  status: string;
  section: string; // Добавлено
  method: string;  // Добавлено
  args?: any;      // Добавлено (тип JSON)
  amount?: string | number; // Возвращено
  recipient?: string; // Возвращено
}

// Определим интерфейс для сырых данных, получаемых из API
interface RawExtrinsicData {
  id: string;
  hash: string;
  signer: string;
  status: string;
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
  const [address, setAddress] = useState<string>('');
  const [tab, setTab] = useState<number>(0); // 0 - Transactions, 1 - Tokens, 2 - NFTs
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Получение extrinsics через расширенный Subsquid GraphQL
  const fetchTransactions = async () => {
    setLoading(true);
    setError('');
    setTransactions([]); // Очищаем предыдущие результаты

    try {
      let targetAddress = address; // Адрес для запроса extrinsics

      // Шаг 1: Если введен EVM адрес, получить нативный ID
      if (address && isValidEvmAddressFormat(address)) {
        console.log(`Input is EVM address: ${address}. Fetching native ID...`);
        const accountQuery = `
          query GetAccountByEvm($evmAddress: String!) {
            accounts(where: { evmAddress_eq: $evmAddress }, limit: 1) {
              id # Нативный адрес
            }
          }
        `;
        const accountResponse = await fetch('https://squid.subsquid.io/reef-explorer/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: accountQuery,
            variables: { evmAddress: address }
          })
        });
        const accountResult = await accountResponse.json();

        if (accountResult.errors) {
          console.error('GraphQL Errors fetching account:', accountResult.errors);
          throw new Error(`GraphQL error fetching account: ${accountResult.errors.map((e: any) => e.message).join(', ')}`);
        }

        if (accountResult.data?.accounts && accountResult.data.accounts.length > 0) {
          targetAddress = accountResult.data.accounts[0].id;
          console.log(`Native address found: ${targetAddress}`);
        } else {
          console.log(`No native account found linked to EVM address: ${address}`);
          // Если аккаунт не найден, транзакций по этому EVM быть не может
          setLoading(false);
          return; // Выходим, транзакций нет
        }
      } else if (address) {
        console.log(`Input is assumed to be native address: ${address}`);
        targetAddress = address;
      }

      // Шаг 2: Если есть адрес (нативный или полученный из EVM), запросить extrinsics
      if (targetAddress) {
          const extrinsicsQuery = `
            query GetExtrinsics($signerAddress: String!) {
              extrinsics(
                limit: 10
                orderBy: id_DESC
                where: { signer_eq: $signerAddress }
              ) {
                id
                hash
                signer
                status
                section
                method
                args
              }
            }
          `;

          const extrinsicsResponse = await fetch('https://squid.subsquid.io/reef-explorer/graphql', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  query: extrinsicsQuery,
                  variables: { signerAddress: targetAddress }
              })
          });

          const extrinsicsResult = await extrinsicsResponse.json();
          console.log('Subsquid extrinsics response:', extrinsicsResult);

          if (extrinsicsResult.errors) {
              console.error('GraphQL Errors fetching extrinsics:', extrinsicsResult.errors);
              throw new Error(`GraphQL error fetching extrinsics: ${extrinsicsResult.errors.map((e: any) => e.message).join(', ')}`);
          }

          if (!extrinsicsResult.data || !extrinsicsResult.data.extrinsics) {
              console.log('No extrinsics data found in response for address:', targetAddress);
              // Оставляем transactions пустым
          } else {
              // Обработка полученных extrinsics 
              const processedTransactions: Transaction[] = extrinsicsResult.data.extrinsics.map((extrinsic: RawExtrinsicData) => {
                  let amount: string | number | undefined = undefined;
                  let recipient: string | undefined = undefined;

                  // Проверяем регистронезависимо и учитываем возможные варианты названий
                  const sectionLower = extrinsic.section.toLowerCase();
                  const methodLower = extrinsic.method.toLowerCase();

                  if (sectionLower === 'balances' && (methodLower === 'transferkeepalive' || methodLower === 'transfer')) {
                      // Структура args: [ { value: recipient_address, __kind: 'Id' }, amount_string ]
                       if (Array.isArray(extrinsic.args) && extrinsic.args.length >= 2) {
                           recipient = extrinsic.args[0]?.value; 
                           const amountRaw = extrinsic.args[1]; // Правильно: берем второй элемент напрямую

                           if (amountRaw && typeof amountRaw === 'string') {
                               try {
                                  // Используем BigInt для точности
                                  const amountBigInt = BigInt(amountRaw);
                                  const divisor = 10n**18n; // 10^18 для REEF
                                  // Делим и форматируем. Преобразуем BigInt в Number для toFixed, 
                                  // но это может потерять точность для ОЧЕНЬ больших чисел, 
                                  // для REEF должно быть нормально.
                                  amount = (Number(amountBigInt * 10000n / divisor) / 10000).toFixed(4); // Форматируем до 4 знаков
                                  // Альтернативно, можно оставить как строку или использовать библиотеку для Decimal
                              } catch (e) {
                                  console.error(`Error formatting amount ${amountRaw}:`, e);
                                  amount = 'Error'; // Или оставить undefined
                              }
                          } 
                      } 
                  }

                   return {
                       id: extrinsic.id,
                       hash: extrinsic.hash,
                       signer: extrinsic.signer,
                       status: extrinsic.status,
                       section: extrinsic.section,
                       method: extrinsic.method,
                       args: extrinsic.args,
                       recipient: recipient,
                       amount: amount,
                   };
              });
              console.log('Processed extrinsics:', processedTransactions);
              setTransactions(processedTransactions);
          }
      } else {
          // Случай, когда адрес не был введен изначально
          console.log('No address provided.');
      }
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError('Failed to fetch transactions. ' + (err.message || '') + (err.response?.errors ? JSON.stringify(err.response.errors) : ''));
    } finally {
      setLoading(false);
    }
  };

  // Копировать в буфер
  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  // Открыть в explorer
  const openInExplorer = (hash: string) => {
    if (hash) {
      window.open(`https://reefscan.com/extrinsic/${hash}`, '_blank');
    }
  };

   return (
     <div style={{ padding: 24 }}>
       <h2>История транзакций</h2>
       <div style={{ marginBottom: 16 }}>
         <input
           type="text"
           placeholder="Введите адрес Reef"
           value={address}
           onChange={e => setAddress(e.target.value)}
           style={{ width: '80%', padding: 8, marginRight: 8 }}
         />
         <button
           onClick={fetchTransactions}
           disabled={loading}
         >
           Показать
         </button>
       </div>
       {loading && <p>Загрузка...</p>}
       {error && <p style={{ color: 'red' }}>{error}</p>}
       <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
         <button onClick={() => setTab(0)} style={{ fontWeight: tab === 0 ? 'bold' : undefined }}>Transactions</button>
         <button onClick={() => setTab(1)} style={{ fontWeight: tab === 1 ? 'bold' : undefined }}>Tokens</button>
         <button onClick={() => setTab(2)} style={{ fontWeight: tab === 2 ? 'bold' : undefined }}>NFTs</button>
       </div>
       {tab === 0 && (
         <div>

           <ul style={{ marginTop: 20 }}>
             {transactions.length === 0 && !loading && <li>Нет транзакций для этого адреса</li>}
             {transactions.map((tx: Transaction) => (
             <li
               key={tx.id}
               style={{ marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 8 }}
             >
               <div>
                 <b>Hash:</b> {tx.hash}{' '}
                 <button onClick={() => copyToClipboard(tx.hash)}>Копировать</button>{' '}
                 <button onClick={() => openInExplorer(tx.hash)}>Открыть</button>
               </div>
               <div>
                 <b>ID:</b> {tx.id}
               </div>
               <div>
                 <b>Signer (Sender):</b> {tx.signer || '—'}
               </div>
               <div>
                 <b>Status:</b> <span style={{ color: tx.status === 'success' ? 'green' : 'red' }}>{tx.status}</span>
               </div>
               {tx.recipient && ( 
                 <div>
                   <b>Recipient:</b> {tx.recipient}
                 </div>
               )}
               {tx.amount !== undefined && ( 
                 <div>
                   <b>Amount:</b> {tx.amount.toLocaleString()} REEF
                 </div>
               )}
             </li>
             ))}
           </ul>
         </div>
       )}
       {tab === 1 && (
         <div style={{ color: '#888', margin: '16px 0' }}>Вкладка Tokens в разработке</div>
       )}
       {tab === 2 && (
         <div style={{ color: '#888', margin: '16px 0' }}>Вкладка NFTs в разработке</div>
       )}
     </div>
   );
};

export default TransactionHistory;
