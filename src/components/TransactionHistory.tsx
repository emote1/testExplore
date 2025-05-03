import React, { useState } from 'react';
// Возвращаем импорт утилит из @polkadot/util-crypto
import { isEthereumAddress, evmToAddress } from '@polkadot/util-crypto';

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
    try {
      let queryAddress = address;
      // Проверяем и конвертируем EVM адрес в нативный Reef адрес
      if (address && isEthereumAddress(address)) {
        try {
          queryAddress = evmToAddress(address, 42);
          console.log(`Converted EVM address ${address} to Reef address ${queryAddress}`);
        } catch (convertError) {
          console.error('Error converting EVM address:', convertError);
          setError('Invalid EVM address or conversion failed.');
          setLoading(false);
          return; // Прерываем выполнение, если адрес EVM невалидный
        }
      } 

      // Формируем GraphQL-запрос с фильтром по адресу, если он введён
      const query: string = queryAddress
        ? `
      query {
        extrinsics(
          limit: 10
          orderBy: id_DESC
          where: { signer_eq: "${queryAddress}" }
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
      `
        : `
      query {
        extrinsics(
          limit: 10
          orderBy: id_DESC
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
      const response = await fetch('https://squid.subsquid.io/reef-explorer/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      const result = await response.json();
      console.log('Subsquid extrinsics response:', result);

      if (result.errors) {
        console.error('GraphQL Errors:', result.errors);
        setError('Error fetching data from Subsquid.');
        setLoading(false);
        return;
      }

      // Применяем тип к сырым данным
      const allExtrinsicsRaw: RawExtrinsicData[] = Array.isArray(result.data?.extrinsics) ? result.data.extrinsics : [];

      // Обработка extrinsics для извлечения amount, recipient
      const processedExtrinsics: Transaction[] = allExtrinsicsRaw.map((extrinsic: RawExtrinsicData) => {
        let recipient: string | undefined;
        let amount: number | undefined;

        // Логика для balances.transfer
        if (extrinsic.section === 'Balances' && extrinsic.method === 'transfer' && Array.isArray(extrinsic.args) && extrinsic.args.length >= 2) {
           try {
              recipient = extrinsic.args[0]?.value; 
              amount = parseFloat(extrinsic.args[1]) / 1e18; 
              if (isNaN(amount)) amount = undefined; 
           } catch(e) {
              console.error("Error parsing args for transfer:", extrinsic.hash, extrinsic.args, e);
              recipient = undefined;
              amount = undefined;
           }
        }
        
        return {
          ...extrinsic,
          amount: amount,       
          recipient: recipient, 
        };
      });

      console.log('Processed extrinsics:', processedExtrinsics);

      // Убираем placeholder extrinsics с id = "-1"
      const validExtrinsics = processedExtrinsics.filter((tx: Transaction) => tx.id !== "-1");
      setTransactions(validExtrinsics);
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
